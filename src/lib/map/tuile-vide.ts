/**
 * Tuile neutre servie quand le fournisseur de fond de carte ne répond pas.
 *
 * Un PNG transparent d'un pixel. Renvoyer une erreur ferait afficher à Leaflet
 * une mosaïque de cases cassées, ce qui ressemble à un site en panne ; une
 * tuile vide laisse les marqueurs lisibles sur un fond uni. La carte perd son
 * décor, pas son information — et les positions des spots, elles, ne viennent
 * pas du fournisseur.
 *
 * ── Ce blob a été FAUX depuis son écriture ────────────────────────────────
 *
 * Le précédent décodait en (0, 255, 0, 127) : du vert vif à moitié opaque.
 * Chaque tuile manquante peignait donc un carré vert par-dessus la carte — le
 * contraire exact de ce que ce repli promet. Une panne partielle du
 * fournisseur aurait éclaboussé l'écran.
 *
 * Personne ne pouvait le voir en développement, où les tuiles répondent. Il a
 * fallu un environnement qui les bloque TOUTES pour que la carte devienne
 * entièrement verte et rende le défaut visible.
 *
 * Ce fichier existe séparément du gestionnaire de route pour une raison
 * technique : Next.js interdit à un `route.ts` d'exporter autre chose que ses
 * verbes HTTP, et un blob que rien ne peut importer est un blob que rien ne
 * peut tester. `tuile-vide.test.ts` le décode et vérifie ses quatre
 * composantes — un base64 ne se relit pas à l'œil.
 */
export const TUILE_VIDE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNgYGBgAAAABQABeqhXUAAAAABJRU5ErkJggg==',
  'base64',
);
