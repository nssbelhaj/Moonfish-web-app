'use client';

// Feuille de style de Leaflet, servie depuis NOTRE paquet. La charger depuis un
// CDN ferait joindre un tiers au navigateur — exactement ce que la page de
// confidentialité affirme ne jamais se produire.
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

import { separatePoints, type MarkerShape } from '@/lib/map/projection';

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
 *   · aucune image de marqueur n'est chargée : ce sont des éléments HTML, ce
 *     qui supprime au passage la douzaine de requêtes que Leaflet ferait pour
 *     ses icônes par défaut.
 *
 * ─── Les trois canaux du score, tenus ici aussi ───────────────────────────
 *
 * Le chiffre, la couleur du palier et la forme selon le type de spot disent la
 * même chose de trois façons indépendantes. Une carte lue en niveaux de gris,
 * ou par un œil qui distingue mal les couleurs, reste exploitable — c'est la
 * règle du site, et une carte n'en est pas dispensée.
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

const RAYON_TERRE_ZOOM = { min: 4, max: 13 } as const;

/** Rayon de bord arrondi selon la forme, pour distinguer sans image. */
const ARRONDI: Record<MarkerShape, string> = {
  cercle: '50%',
  carre: '4px',
  triangle: '4px',
};

function marqueurHtml(point: PointCarte): string {
  const texte = point.score === null ? '—' : point.score.toFixed(1).replace('.', ',');

  /*
    Le triangle est dessiné par une rotation de 45° du carré, avec le chiffre
    remis d'aplomb par une rotation inverse. Un `clip-path` triangulaire
    rognerait le texte, et une image ferait une requête de plus par marqueur.
  */
  const rotation = point.forme === 'triangle' ? 'transform:rotate(45deg);' : '';
  const antiRotation = point.forme === 'triangle' ? 'transform:rotate(-45deg);' : '';

  /*
    La couche `carte-decalage` existe pour porter l'écartement calculé à chaque
    zoom. Elle est séparée de la pastille parce que celle-ci porte déjà une
    rotation pour les triangles : deux transformations sur le même élément se
    remplaceraient l'une l'autre.
  */
  return `
    <span class="carte-decalage">
      <span class="carte-marqueur" style="background:${point.couleur};border-radius:${ARRONDI[point.forme]};${rotation}">
        <span style="${antiRotation}">${texte}</span>
      </span>
      ${point.danger ? '<span class="carte-danger" aria-hidden="true">!</span>' : ''}
    </span>
  `;
}

export function CarteInteractive({ points }: { points: PointCarte[] }) {
  const conteneur = useRef<HTMLDivElement>(null);

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
        minZoom: RAYON_TERRE_ZOOM.min,
        maxZoom: RAYON_TERRE_ZOOM.max,
        attributionControl: false,
      });

      /*
        Chemin RELATIF : le navigateur ne joint que notre origine, qui relaie.
        Une URL de tuiles écrite en dur ici ferait échouer le test de vie
        privée, et à raison — ce serait un tiers non déclaré.
      */
      L.tileLayer('/api/tuiles/{z}/{x}/{y}', {
        minZoom: RAYON_TERRE_ZOOM.min,
        maxZoom: RAYON_TERRE_ZOOM.max,
        // Sans cela, Leaflet demande des tuiles hors grille aux bords du monde
        // et notre relais les refuse, ce qui laisse des cases vides.
        noWrap: true,
        className: 'carte-tuiles',
      }).addTo(carte);

      const limites = L.latLngBounds([]);
      const marqueurs: import('leaflet').Marker[] = [];

      for (const point of points) {
        limites.extend([point.lat, point.lng]);

        const icone = L.divIcon({
          html: marqueurHtml(point),
          className: 'carte-icone',
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marqueur = L.marker([point.lat, point.lng], {
          icon: icone,
          // Annoncé aux lecteurs d'écran et atteignable au clavier : un
          // marqueur qu'on ne peut pas tabuler n'existe pas pour tout le monde.
          keyboard: true,
          title: `${point.nom} — ${point.palier}`,
          alt: `${point.nom}, ${point.region}. Score ${point.score ?? 'indisponible'}. ${point.palier}.`,
        }).addTo(carte as import('leaflet').Map);

        marqueurs.push(marqueur);

        marqueur.bindPopup(
          `<p class="carte-popup-titre">${point.nom}</p>
           <p class="carte-popup-lieu">${point.region}</p>
           <p class="carte-popup-score" style="color:${point.couleur}">
             ${point.score === null ? 'Score indisponible' : `${point.score.toFixed(1).replace('.', ',')} / 10 · ${point.palier}`}
           </p>
           <a class="carte-popup-lien" href="${point.href}">Voir le spot</a>`,
          { closeButton: true, maxWidth: 220 },
        );
      }

      /*
        ─── Écarter ce qui se recouvre ───────────────────────────────────────

        Agadir et Taghazout sont à quinze kilomètres. À l'échelle où France et
        Maroc tiennent ensemble, cela fait moins d'un marqueur d'écart : l'un
        recouvrait l'autre AU POINT DE LE RENDRE INCLIQUABLE. Vérifié dans un
        navigateur — un clic sur Taghazout atterrissait sur Agadir.

        L'écartement est recalculé à chaque zoom, en pixels, et il DISPARAÎT
        dès que les marqueurs cessent de se toucher : en s'approchant, chacun
        revient exactement sur sa position réelle. C'est ce qui le distingue
        d'un décalage figé, qui mentirait sur la carte à toutes les échelles.
      */
      const ecarter = (): void => {
        const vue = carte;
        if (vue === null) return;

        /*
          Le calcul repart TOUJOURS des positions d'origine, jamais des
          positions déjà écartées : sinon chaque zoom repousserait un peu plus
          les marqueurs, et ils dériveraient jusqu'à quitter leur région.
        */
        const bruts = points.map((point) => {
          const p = vue.latLngToContainerPoint([point.lat, point.lng]);
          return { x: p.x, y: p.y };
        });

        const ecartes = separatePoints(bruts, 38);

        marqueurs.forEach((marqueur, index) => {
          const depart = bruts[index];
          const arrivee = ecartes[index];
          const point = points[index];
          if (depart === undefined || arrivee === undefined || point === undefined) return;

          const dx = arrivee.x - depart.x;
          const dy = arrivee.y - depart.y;
          const deplace = Math.abs(dx) >= 1 || Math.abs(dy) >= 1;

          /*
            On déplace le MARQUEUR, pas seulement son dessin.

            Une première version décalait la pastille par une transformation
            CSS. Visuellement c'était juste — et parfaitement inutile : Leaflet
            garde la zone cliquable sur l'élément parent, resté en place. Un
            clic sur Taghazout continuait d'atteindre Agadir, sauf que
            maintenant l'écran ne le montrait plus. Un défaut invisible est
            pire que le défaut d'origine.
          */
          marqueur.setLatLng(
            deplace ? vue.containerPointToLatLng([arrivee.x, arrivee.y]) : [point.lat, point.lng],
          );

          const couche = marqueur.getElement()?.querySelector<HTMLElement>('.carte-decalage');
          // Un marqueur écarté n'est plus exactement sur sa position : le
          // liseré pointillé le dit, plutôt que de laisser croire au contraire.
          if (couche) couche.dataset['ecarte'] = deplace ? 'oui' : '';
        });
      };

      carte.on('zoomend', ecarter);
      carte.on('moveend', ecarter);

      if (points.length > 0) carte.fitBounds(limites, { padding: [42, 42], maxZoom: 9 });
      ecarter();
    });

    return () => {
      annule = true;
      carte?.remove();
    };
  }, [points]);

  return (
    <div
      ref={conteneur}
      className="h-[420px] w-full overflow-hidden rounded-[12px] md:h-[560px]"
      // La carte est un complément : la même information existe dans la liste
      // qui la suit, laquelle est, elle, entièrement rendue au serveur.
      role="application"
      aria-label="Carte des spots. Chaque marqueur porte le score du créneau en cours et mène à la page du spot."
    />
  );
}
