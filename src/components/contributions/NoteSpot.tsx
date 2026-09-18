import Link from 'next/link';

import type { SpotRating } from '@/lib/providers';

/**
 * La note d'un spot : les étoiles, la moyenne, le nombre d'avis.
 *
 * ─── Ce que les étoiles ne disent pas ─────────────────────────────────────
 *
 * Elles notent un LIEU — son accès, son stationnement, sa sécurité, ce qu'on
 * y voit — pas les conditions du jour. Une pointe à 4,5 étoiles reste
 * impraticable par houle d'ouest, et c'est le score qui le dit, pas la note.
 * Confondre les deux est le seul vrai risque de cette fonctionnalité : la
 * page les sépare donc visuellement, et le texte le dit à côté du bloc.
 *
 * Le chiffre porte l'information, les étoiles le renforcent — la règle des
 * trois canaux du site vaut ici aussi : `aria-hidden` sur les glyphes,
 * « 4,2 sur 5 » pour un lecteur d'écran, et une lecture en niveaux de gris
 * qui reste exacte.
 */

/** Étoiles pleines jusqu'à l'arrondi au demi-point le plus proche. */
function glyphes(moyenne: number): string {
  const pleines = Math.round(moyenne);
  return '★'.repeat(pleines) + '☆'.repeat(5 - pleines);
}

export function formatNote(moyenne: number): string {
  return moyenne.toFixed(1).replace('.', ',');
}

/** Ligne compacte, sous le titre d'un spot. Rend `null` sans aucun avis. */
export function NoteCompacte({ note, href }: { note: SpotRating; href: string }) {
  if (note.average === null) return null;

  return (
    <Link href={href} className="note-compacte" aria-label={`${formatNote(note.average)} sur 5, ${note.count} avis. Lire les avis.`}>
      <span aria-hidden="true" className="note-etoiles">
        {glyphes(note.average)}
      </span>
      <span aria-hidden="true" className="nums font-600 text-fg">
        {formatNote(note.average)}
      </span>
      <span aria-hidden="true" className="nums text-fg-muted">
        {note.count} avis
      </span>
    </Link>
  );
}

/** Bloc complet : moyenne à gauche, répartition à droite. */
export function NoteDetaillee({ note }: { note: SpotRating }) {
  if (note.average === null) return null;

  const maximum = Math.max(1, ...([1, 2, 3, 4, 5] as const).map((v) => note.breakdown[v]));

  return (
    <div className="note-bloc">
      <div className="note-resume">
        <p className="note-moyenne nums" data-numeric="">
          {formatNote(note.average)}
        </p>
        <p aria-hidden="true" className="note-etoiles note-etoiles-grandes">
          {glyphes(note.average)}
        </p>
        <p className="note-compte nums">
          {note.count} avis
        </p>
        <p className="sr-only">{formatNote(note.average)} sur 5, sur {note.count} avis.</p>
      </div>

      {/*
        La répartition, et pas seulement la moyenne : 4,0 peut vouloir dire
        « tout le monde a mis 4 » ou « la moitié a mis 5 et l'autre 3 ». Les
        deux spots ne se valent pas, et seule la répartition le montre.
      */}
      <ul className="note-repartition">
        {([5, 4, 3, 2, 1] as const).map((valeur) => (
          <li key={valeur} className="note-ligne">
            <span className="note-ligne-valeur nums" aria-hidden="true">
              {valeur}
            </span>
            <span aria-hidden="true" className="note-barre">
              <i
                className="note-barre-pleine"
                style={{ width: `${(note.breakdown[valeur] / maximum) * 100}%` }}
              />
            </span>
            <span className="note-ligne-compte nums" data-numeric="">
              {note.breakdown[valeur]}
            </span>
            <span className="sr-only">
              {note.breakdown[valeur]} avis à {valeur} étoile{valeur > 1 ? 's' : ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
