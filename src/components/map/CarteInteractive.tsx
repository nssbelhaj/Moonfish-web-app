'use client';

// Feuille de style de Leaflet, servie depuis NOTRE paquet. La charger depuis un
// CDN ferait joindre un tiers au navigateur — exactement ce que la page de
// confidentialité affirme ne jamais se produire.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef, useState } from 'react';

import type { MarkerShape } from '@/lib/map/projection';
import { regrouper } from '@/lib/map/regroupement';

/**
 * Carte à tuiles, avec un marqueur cliquable par spot.
 *
 * ─── Le seul composant client de cette page, et pourquoi il est justifié ──
 *
 * Le projet rend tout au serveur. Une carte que l'on déplace et que l'on zoome
 * ne peut pas l'être : l'interaction EST la fonctionnalité. Le coût est donc
 * assumé plutôt que subi, et borné :
 *
 *   · le composant n'est chargé que sur `/carte`, jamais ailleurs ;
 *   · sans JavaScript, la page rend une carte dessinée au serveur, qui donne
 *     la même information — positions, scores, liens — sans interaction ;
 *   · aucune image de marqueur n'est chargée : ce sont des éléments HTML.
 *
 * ─── Ce qu'on voit à chaque échelle ───────────────────────────────────────
 *
 * À l'échelle où France et Maroc tiennent ensemble, quarante-deux pastilles
 * ne se lisent pas : elles se regroupent en quelques pastilles chiffrées.
 * Un clic sur l'une d'elles zoome jusqu'à ce que ses membres se séparent ;
 * chaque marqueur revient alors exactement sur sa position.
 *
 * La carte s'ouvre là où on l'a laissée — le dernier cadre est gardé dans
 * le navigateur, et nulle part ailleurs. Le bouton « Autour de moi » demande
 * la position au clic, jamais au chargement, et elle ne quitte pas l'appareil.
 *
 * ─── Les trois canaux du score, tenus ici aussi ───────────────────────────
 *
 * Le chiffre, la couleur du palier et la forme selon le type de spot disent la
 * même chose de trois façons indépendantes. Une carte lue en niveaux de gris,
 * ou par un œil qui distingue mal les couleurs, reste exploitable.
 */

export interface PointCarte {
  slug: string;
  nom: string;
  region: string;
  lat: number;
  lng: number;
  /** Chemin de la page du spot. */
  href: string;
  /** Score du créneau en cours, `null` si aucune donnée. */
  score: number | null;
  /** Texte du palier : « Bon », « Danger »… */
  palier: string;
  /** Variable CSS de la couleur du palier. */
  couleur: string;
  forme: MarkerShape;
  /** Vrai si la règle de sécurité s'applique — elle prime sur le score. */
  danger: boolean;
}

const ZOOM = { min: 4, max: 13 } as const;

/** En deçà de cette distance en pixels, deux marqueurs se fondent. */
const RAYON_GROUPE = 44;

/** Zoom donné à « Autour de moi » : une côte entière, pas une rue. */
const ZOOM_AUTOUR = 9;

const CLE_VUE = 'luna-marea:carte:vue';

/** Rayon de bord arrondi selon la forme, pour distinguer sans image. */
const ARRONDI: Record<MarkerShape, string> = {
  cercle: '50%',
  carre: '4px',
  triangle: '4px',
};

function texteScore(score: number | null): string {
  return score === null ? '—' : score.toFixed(1).replace('.', ',');
}

function marqueurHtml(point: PointCarte): string {
  /*
    Le triangle est dessiné par une rotation de 45° du carré, avec le chiffre
    remis d'aplomb par une rotation inverse. Un `clip-path` triangulaire
    rognerait le texte, et une image ferait une requête de plus par marqueur.
  */
  const rotation = point.forme === 'triangle' ? 'transform:rotate(45deg);' : '';
  const antiRotation = point.forme === 'triangle' ? 'transform:rotate(-45deg);' : '';

  return `
    <span class="carte-marqueur" style="background:${point.couleur};border-radius:${ARRONDI[point.forme]};${rotation}">
      <span style="${antiRotation}">${texteScore(point.score)}</span>
    </span>
    ${point.danger ? '<span class="carte-danger" aria-hidden="true">!</span>' : ''}
  `;
}

/**
 * Pastille d'un groupe : le nombre, et le MEILLEUR score du groupe en couleur
 * de fond. « Six spots ici, dont le meilleur est bon » se lit d'un coup d'œil
 * sans ouvrir le groupe ; un danger dans le groupe garde son point rouge.
 */
function groupeHtml(membres: readonly PointCarte[]): string {
  const meilleur = membres.reduce<PointCarte | null>(
    (acc, p) => (acc === null || (p.score ?? -1) > (acc.score ?? -1) ? p : acc),
    null,
  );
  const danger = membres.some((p) => p.danger);
  const couleur = meilleur?.couleur ?? 'var(--edge-strong)';

  return `
    <span class="carte-groupe" style="box-shadow:0 0 0 3px ${couleur}, var(--ombre-marqueur)">
      <span class="carte-groupe-nombre">${membres.length}</span>
      <span class="carte-groupe-meilleur" style="color:${couleur}">${texteScore(meilleur?.score ?? null)}</span>
    </span>
    ${danger ? '<span class="carte-danger" aria-hidden="true">!</span>' : ''}
  `;
}

interface Vue {
  lat: number;
  lng: number;
  zoom: number;
}

function lireVue(): Vue | null {
  try {
    const brut = localStorage.getItem(CLE_VUE);
    if (brut === null) return null;
    const v = JSON.parse(brut) as Partial<Vue>;
    if (typeof v.lat !== 'number' || typeof v.lng !== 'number' || typeof v.zoom !== 'number') return null;
    if (!Number.isFinite(v.lat) || !Number.isFinite(v.lng)) return null;
    return { lat: v.lat, lng: v.lng, zoom: Math.min(ZOOM.max, Math.max(ZOOM.min, v.zoom)) };
  } catch {
    return null;
  }
}

function ecrireVue(vue: Vue): void {
  try {
    localStorage.setItem(CLE_VUE, JSON.stringify(vue));
  } catch {
    // Navigation privée, stockage plein ou bloqué : la carte s'ouvrira sur
    // le cadre par défaut. Ce n'est pas une erreur à montrer.
  }
}

type EtatPosition = 'repos' | 'demande' | 'refus' | 'introuvable';

export function CarteInteractive({ points }: { points: PointCarte[] }) {
  const conteneur = useRef<HTMLDivElement>(null);
  const carteRef = useRef<import('leaflet').Map | null>(null);
  const [position, setPosition] = useState<EtatPosition>('repos');

  useEffect(() => {
    const cible = conteneur.current;
    if (cible === null) return;

    let carte: import('leaflet').Map | null = null;
    let annule = false;

    /*
      Import tardif : Leaflet touche `window` au chargement du module et casse
      le rendu serveur s'il est importé en haut du fichier. Le charger ici le
      met aussi dans un paquet séparé, téléchargé seulement par qui ouvre la
      carte.
    */
    void import('leaflet').then((L) => {
      if (annule || cible === null) return;

      carte = L.map(cible, {
        // La molette zoome la PAGE par défaut chez beaucoup de monde ; qu'elle
        // zoome la carte piège le défilement quand on ne fait que passer.
        // Ctrl + molette et les boutons restent disponibles.
        scrollWheelZoom: false,
        minZoom: ZOOM.min,
        maxZoom: ZOOM.max,
        attributionControl: false,
      });
      carteRef.current = carte;

      /*
        Chemin RELATIF : le navigateur ne joint que notre origine, qui relaie.
        Une URL de tuiles écrite en dur ici ferait échouer le test de vie
        privée, et à raison — ce serait un tiers non déclaré.
      */
      L.tileLayer('/api/tuiles/{z}/{x}/{y}', {
        minZoom: ZOOM.min,
        maxZoom: ZOOM.max,
        // Sans cela, Leaflet demande des tuiles hors grille aux bords du monde
        // et notre relais les refuse, ce qui laisse des cases vides.
        noWrap: true,
        className: 'carte-tuiles',
      }).addTo(carte);

      const calque = L.layerGroup().addTo(carte);

      const popupDe = (point: PointCarte): string =>
        `<p class="carte-popup-titre">${point.nom}</p>
         <p class="carte-popup-lieu">${point.region}</p>
         <p class="carte-popup-score" style="color:${point.couleur}">
           ${point.score === null ? 'Score indisponible' : `${texteScore(point.score)} / 10 · ${point.palier}`}
         </p>
         <a class="carte-popup-lien" href="${point.href}">Voir le spot</a>`;

      /*
        ─── Reconstruit à chaque zoom, jamais au déplacement ─────────────────

        Le regroupement dépend de la distance en pixels entre les spots, qui
        ne change qu'avec le zoom. On projette donc en coordonnées de CALQUE
        (`project`), indépendantes du cadre, et on ne recalcule qu'au
        `zoomend` : faire glisser la carte ne redessine rien.
      */
      const dessiner = (): void => {
        const vue = carte;
        if (vue === null) return;
        calque.clearLayers();

        const zoom = vue.getZoom();
        const pixels = points.map((p) => {
          const q = vue.project([p.lat, p.lng], zoom);
          return { x: q.x, y: q.y };
        });

        for (const groupe of regrouper(pixels, RAYON_GROUPE)) {
          const membres = groupe.membres
            .map((i) => points[i])
            .filter((p): p is PointCarte => p !== undefined);
          if (membres.length === 0) continue;

          const seul = membres.length === 1 ? membres[0] : undefined;

          if (seul !== undefined) {
            L.marker([seul.lat, seul.lng], {
              icon: L.divIcon({
                html: marqueurHtml(seul),
                className: 'carte-icone',
                iconSize: [34, 34],
                iconAnchor: [17, 17],
              }),
              // Annoncé aux lecteurs d'écran et atteignable au clavier : un
              // marqueur qu'on ne peut pas tabuler n'existe pas pour tout le monde.
              keyboard: true,
              title: `${seul.nom} — ${seul.palier}`,
              alt: `${seul.nom}, ${seul.region}. Score ${seul.score ?? 'indisponible'}. ${seul.palier}.`,
            })
              .bindPopup(popupDe(seul), { closeButton: true, maxWidth: 220 })
              .addTo(calque);
            continue;
          }

          const centre = vue.unproject([groupe.x, groupe.y], zoom);
          const limites = L.latLngBounds(membres.map((p) => [p.lat, p.lng] as [number, number]));
          const noms = membres.map((p) => p.nom).join(', ');

          L.marker(centre, {
            icon: L.divIcon({
              html: groupeHtml(membres),
              className: 'carte-icone',
              iconSize: [44, 44],
              iconAnchor: [22, 22],
            }),
            keyboard: true,
            title: `${membres.length} spots — cliquer pour les séparer`,
            alt: `${membres.length} spots regroupés : ${noms}. Activer pour zoomer.`,
          })
            .on('click', () => {
              // Jusqu'à ce que les membres se séparent, sans dépasser le zoom
              // où une rue apparaît : ce n'est pas une carte marine.
              vue.fitBounds(limites, { padding: [48, 48], maxZoom: 12 });
            })
            .on('keypress', (e) => {
              const touche = (e as unknown as { originalEvent: KeyboardEvent }).originalEvent;
              if (touche.key === 'Enter' || touche.key === ' ') {
                vue.fitBounds(limites, { padding: [48, 48], maxZoom: 12 });
              }
            })
            .addTo(calque);
        }
      };

      carte.on('zoomend', dessiner);
      carte.on('moveend', () => {
        const vue = carte;
        if (vue === null) return;
        const c = vue.getCenter();
        ecrireVue({ lat: c.lat, lng: c.lng, zoom: vue.getZoom() });
      });

      // Là où on l'a laissée ; sinon, tout le catalogue dans le cadre.
      const souvenir = lireVue();
      if (souvenir !== null) {
        carte.setView([souvenir.lat, souvenir.lng], souvenir.zoom);
      } else if (points.length > 0) {
        carte.fitBounds(
          L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
          { padding: [32, 32], maxZoom: 9 },
        );
      } else {
        carte.setView([44, -2], ZOOM.min);
      }
      dessiner();
    });

    return () => {
      annule = true;
      carteRef.current = null;
      carte?.remove();
    };
  }, [points]);

  /*
    ═══ La position ne quitte JAMAIS le navigateur. ═══

    Demandée au CLIC, jamais au chargement : un site qui réclame la position
    à l'arrivée entraîne au refus réflexe. Elle sert à cadrer la carte, puis
    n'est ni gardée, ni envoyée — il n'existe aucun point d'accès serveur qui
    accepterait une position.
  */
  function autourDeMoi(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return setPosition('introuvable');
    setPosition('demande');

    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition('repos');
        carteRef.current?.setView([p.coords.latitude, p.coords.longitude], ZOOM_AUTOUR);
      },
      (erreur) => setPosition(erreur.code === 1 ? 'refus' : 'introuvable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  function toutVoir(): void {
    const vue = carteRef.current;
    if (vue === null || points.length === 0) return;
    void import('leaflet').then((L) => {
      vue.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [32, 32],
        maxZoom: 9,
      });
    });
  }

  return (
    <div className="relative">
      <div
        ref={conteneur}
        className="carte-cadre h-[60vh] min-h-[420px] max-h-[760px] w-full overflow-hidden rounded-[12px]"
        // La carte est un complément : la même information existe dans la liste
        // qui la suit, laquelle est, elle, entièrement rendue au serveur.
        role="application"
        aria-label="Carte des spots. Les spots proches se regroupent en une pastille chiffrée ; chaque marqueur porte le score du créneau en cours et mène à la page du spot."
      />

      <div className="carte-controles" role="group" aria-label="Cadrage de la carte">
        <button type="button" className="carte-controle" onClick={autourDeMoi} disabled={position === 'demande'}>
          {position === 'demande' ? 'Recherche…' : 'Autour de moi'}
        </button>
        <button type="button" className="carte-controle" onClick={toutVoir}>
          Tout voir
        </button>
      </div>

      {position === 'refus' && (
        <p className="mt-2 text-meta text-fg-muted" role="status">
          Position non partagée. La carte reste telle quelle — rien n’a été envoyé.
        </p>
      )}
      {position === 'introuvable' && (
        <p className="mt-2 text-meta text-fg-muted" role="status">
          Position introuvable. Cela arrive à l’intérieur d’un bâtiment ou sans signal.
        </p>
      )}
    </div>
  );
}
