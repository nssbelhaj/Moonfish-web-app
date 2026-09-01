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
        <div className="mt-2 flex flex-wrap gap-2">
          {RATINGS.map((value) => (
            <label
              key={value}
              className="flex min-h-tap min-w-tap cursor-pointer items-center justify-center gap-2 rounded-ctl border border-edge-strong px-4 text-body text-fg has-[:checked]:bg-surface-2 has-[:checked]:font-600"
            >
              <input
                type="radio"
                name="rating"
                value={value}
                required
                defaultChecked={existing?.rating === value}
                className="h-4 w-4"
              />
              <span className="nums">{value}</span>
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
