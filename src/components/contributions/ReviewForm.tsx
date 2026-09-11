'use client';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { saveReview } from '@/lib/auth/actions';

const RATINGS = [1, 2, 3, 4, 5] as const;

/**
 * Note et commentaire sur un spot.
 *
 * La note est un groupe de boutons radio, pas un composant d'étoiles piloté au
 * JavaScript : c'est navigable au clavier, annoncé correctement par un lecteur
 * d'écran, et cela fonctionne avant même que le script de la page soit chargé.
 */
export function ReviewForm({
  spotSlug,
  spotPath,
  existing,
}: {
  spotSlug: string;
  spotPath: string;
  existing?: { rating: number; comment: string | null };
}) {
  return (
    <ActionForm
      action={saveReview}
      submitLabel={existing ? 'Mettre à jour mon avis' : 'Publier mon avis'}
    >
      <input type="hidden" name="spot_slug" value={spotSlug} />
      <input type="hidden" name="spot_path" value={spotPath} />

      <fieldset>
        <legend className="text-meta text-fg-muted">Votre note</legend>
        {/*
          Cinq étoiles, qui sont cinq boutons radio : navigables au clavier,
          annoncées par leur chiffre, fonctionnelles avant tout script. Le
          remplissage jusqu'à l'étoile choisie est du CSS (`:has`), et sans
          lui l'étoile cochée reste seule pleine — toujours lisible.
        */}
        <div className="etoiles mt-2">
          {RATINGS.map((value) => (
            <label key={value} className="etoile" title={`${value} sur 5`}>
              <input
                type="radio"
                name="rating"
                value={value}
                required
                defaultChecked={existing?.rating === value}
                className="sr-only"
              />
              <span aria-hidden="true" className="etoile-glyphe">
                ★
              </span>
              <span className="sr-only">{value} sur 5</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-meta text-fg-muted">1 = décevant, 5 = excellent.</p>
      </fieldset>

      <Field
        label="Commentaire (facultatif)"
        hint="Accès, stationnement, sécurité, ce que vous y avez vu. Ce qui aide quelqu’un qui n’y est jamais allé."
      >
        <textarea
          name="comment"
          rows={4}
          maxLength={1200}
          defaultValue={existing?.comment ?? ''}
          className={`${INPUT_CLASS} min-h-[120px] py-2`}
        />
      </Field>
    </ActionForm>
  );
}
