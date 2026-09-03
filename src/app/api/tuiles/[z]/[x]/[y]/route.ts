import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Relais des tuiles de la carte.
 *
 * ─── Pourquoi le navigateur ne joint PAS le serveur de tuiles ─────────────
 *
 * Une carte à tuiles ordinaire fait charger 20 à 40 images par le navigateur
 * depuis un tiers. Ce tiers reçoit alors, sans que personne l'ait décidé :
 * l'adresse IP du visiteur, la zone qu'il regarde — donc approximativement où
 * il pêche — et la page d'où vient la demande.
 *
 * `/confidentialite` affirme qu'AUCUNE requête ne part du navigateur vers un
 * tiers. Brancher la carte en direct rendrait cette phrase fausse, et
 * `privacy-claims.test.ts` échouerait — ce qui est exactement son rôle.
 *
 * Le relais renverse la chose : le navigateur ne parle qu'à notre origine,
 * c'est NOTRE serveur qui va chercher la tuile. Le fournisseur voit une
 * poignée de requêtes venant d'une seule machine, et rien du visiteur.
 *
 * ─── Ce que ça coûte, et pourquoi c'est acceptable ici ────────────────────
 *
 * De la bande passante et un cache. Douze spots sur une zone fixe, un cache
 * d'un mois : le volume est très petit. Ça ne le resterait pas si la carte
 * couvrait le monde à tous les niveaux de zoom — d'où les bornes ci-dessous,
 * qui ne sont pas décoratives.
 */

/**
 * Bornes de zoom.
 *
 * Sans elles, la route serait un proxy d'images ouvert : n'importe qui
 * pourrait faire tirer à votre serveur des tuiles du monde entier, à vos
 * frais, en s'abritant derrière votre domaine. Le plafond couvre le niveau
 * « on voit la plage », au-delà duquel une carte de repérage n'apporte rien —
 * et ce site ne prétend pas remplacer une carte marine.
 */
const ZOOM_MIN = 3;
const ZOOM_MAX = 13;

/** Un mois côté client, un an côté cache partagé. Les côtes bougent peu. */
const CACHE = 'public, max-age=2592000, s-maxage=31536000, immutable';

/**
 * Fond de carte.
 *
 * OpenStreetMap demande deux choses en retour de son usage gratuit : une
 * attribution VISIBLE — elle est sous la carte, pas cachée dans un repli — et
 * un agent utilisateur identifiant. Un relais anonyme se fait bloquer, et il
 * le mérite.
 */
const AMONT_DEFAUT = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Fournisseur de tuiles, remplaçable par `TILE_URL`.
 *
 * Le gabarit accepte `{z}`, `{x}` et `{y}`. Trois usages, dans l'ordre de
 * probabilité : pointer un stub local pour vérifier la carte hors ligne,
 * basculer vers un fournisseur à clé le jour où la fréquentation dépasse ce que
 * la politique d'usage d'OpenStreetMap tolère, et servir ses propres tuiles.
 *
 * La clé éventuelle reste ICI, côté serveur : c'est l'autre bénéfice du relais.
 * Une carte branchée en direct exposerait la clé dans le paquet du navigateur,
 * où n'importe qui peut la lire et la dépenser.
 */
function AMONT(z: number, x: number, y: number): string {
  const gabarit = process.env.TILE_URL?.trim() || AMONT_DEFAUT;
  return gabarit
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}

const AGENT = 'Moonfish/1.0 (carte de spots de pêche du bord; contact@nssbelhaj.com)';

/**
 * Tuile neutre servie quand l'amont ne répond pas.
 *
 * Un PNG transparent d'un pixel. Renvoyer une erreur ferait afficher à Leaflet
 * une mosaïque de cases cassées, ce qui ressemble à un site en panne ; une
 * tuile vide laisse les marqueurs lisibles sur un fond uni. La carte perd son
 * décor, pas son information — et les positions des spots, elles, ne viennent
 * pas de l'amont.
 */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function vide(): NextResponse {
  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      // Cache COURT : une panne d'amont est passagère, et la figer un mois
      // laisserait la carte grise longtemps après le rétablissement.
      'cache-control': 'public, max-age=60',
      'x-moonfish-tuile': 'indisponible',
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<NextResponse> {
  const { z, x, y } = await params;

  const zoom = Number(z);
  const colonne = Number(x);
  const ligne = Number(y);

  if (!Number.isInteger(zoom) || zoom < ZOOM_MIN || zoom > ZOOM_MAX) {
    return NextResponse.json({ message: 'Niveau de zoom hors bornes.' }, { status: 400 });
  }

  /*
    À un zoom donné, la grille fait 2^z tuiles de côté. Une coordonnée hors de
    cette grille ne désigne aucune tuile : la refuser ici évite d'aller
    déranger l'amont pour rien, et ferme la porte au balayage.
  */
  const cote = 2 ** zoom;
  if (
    !Number.isInteger(colonne) ||
    !Number.isInteger(ligne) ||
    colonne < 0 ||
    ligne < 0 ||
    colonne >= cote ||
    ligne >= cote
  ) {
    return NextResponse.json({ message: 'Coordonnées hors grille.' }, { status: 400 });
  }

  try {
    const amont = await fetch(AMONT(zoom, colonne, ligne), {
      headers: { 'user-agent': AGENT, accept: 'image/png,image/*' },
      // Le cache de Next évite de redemander la même tuile à chaque visiteur.
      next: { revalidate: 2592000 },
      signal: AbortSignal.timeout(8000),
    });

    if (!amont.ok) return vide();

    const corps = await amont.arrayBuffer();

    return new NextResponse(corps, {
      status: 200,
      headers: {
        'content-type': amont.headers.get('content-type') ?? 'image/png',
        'cache-control': CACHE,
      },
    });
  } catch {
    // Amont injoignable ou trop lent. On ne journalise pas : une carte
    // consultée par plusieurs personnes produirait des centaines de lignes
    // pour un incident unique.
    return vide();
  }
}
