import { mailleFor, mailleReferenceOf, type SpeciesInfo, type Sea } from '@/data/species';
import { BOTTOM_LABELS } from '@/data/spots';
import type { SpotBottom } from '@/data/schemas';

/**
 * Une espèce connue sur ce spot, avec sa réglementation (D5).
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  CE QUE CETTE CARTE NE FAIT PLUS, ET POURQUOI.
 *
 *  Elle portait un indice d'activité et une fenêtre de marée par espèce
 *  (« bar : 2,5 h avant PM → 1 h après PM »). Cette donnée n'existe nulle
 *  part : ni le SHOM, ni les fournisseurs météo, ni aucune source publique ne
 *  la produisent. Elle était donc fabriquée par un modèle, et affichée avec la
 *  même autorité qu'un coefficient de marée mesuré.
 *
 *  Ce qu'on sait honnêtement d'une espèce sur un spot, c'est : qu'elle y est
 *  connue, sur quel fond elle se tient, ce qu'on lui présente, et sa taille
 *  légale. Le reste viendra des prises déclarées par les pêcheurs, pas d'un
 *  modèle qui aurait deviné à leur place.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function SpeciesCard({
  species,
  countrySlug,
  sea,
  spotBottom,
}: {
  species: SpeciesInfo;
  /** Le pays décide du texte applicable — nos chiffres ne couvrent que la France. */
  countrySlug: string;
  sea: Sea;
  spotBottom: SpotBottom;
}) {
  const reference = mailleReferenceOf(countrySlug);
  const maille = mailleFor(species, countrySlug, sea);
  const onThisBottom = species.bottoms.includes(spotBottom);

  return (
    <article className="surface flex flex-col gap-3 p-[14px]">
      <div className="flex flex-col gap-[3px]">
        <h3 className="font-serif text-[19px] font-semibold">{species.name}</h3>
        <p className="font-serif text-[13px] italic text-fg-muted">{species.latin}</p>
      </div>

      <p className="text-body text-fg-muted">{species.moment}</p>

      <p className="text-body text-fg-muted">
        <span className="font-semibold text-fg">Fonds : </span>
        {species.bottoms.map((b) => BOTTOM_LABELS[b].toLowerCase()).join(', ')}.
        {!onThisBottom && (
          <> Le fond de ce spot n’en fait pas partie : cherchez plutôt les structures voisines.</>
        )}
      </p>

      <p className="text-body text-fg-muted">
        <span className="font-semibold text-fg">Montage : </span>
        {species.rig}
      </p>

      <p className="card-source">
        {maille === null ? (
          <>
            Maille non vérifiée dans nos données ici — consultez{' '}
            <a
              href={reference.url}
              className="underline decoration-dotted underline-offset-4"
              rel="noopener noreferrer"
              target="_blank"
            >
              {reference.authority}
            </a>{' '}
            avant de garder une prise.
          </>
        ) : (
          <>
            Maille <span className="nums">{maille} cm</span>
            {species.dailyLimit ? ` · ${species.dailyLimit}` : ''} · {reference.label}
          </>
        )}
      </p>
    </article>
  );
}
