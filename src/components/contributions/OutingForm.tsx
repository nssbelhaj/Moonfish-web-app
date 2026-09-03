'use client';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { addOuting } from '@/lib/auth/actions';
import { isoToLocalDateTime } from '@/lib/auth/local-time';

/**
 * Programmer une sortie sur ce spot.
 *
 * L'alerte est cochée par défaut, et ce n'est pas une ruse d'engagement :
 * c'est la raison d'être de la fonction. Une sortie programmée SANS courriel
 * n'est qu'une ligne de calendrier ; avec, c'est le site qui vient dire la
 * veille « la houle sera à trois mètres, n'y allez pas ». La case reste
 * décochable, en un clic, et chaque sortie décide pour elle-même.
 */
export function OutingForm({ spotSlug, spotPath }: { spotSlug: string; spotPath: string }) {
  const offsetMinutes = new Date().getTimezoneOffset();

  // Défaut : demain, même heure, arrondi à l'heure. Une sortie se prévoit
  // rarement pour tout de suite.
  const demain = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 24 * 3_600_000);
  const defaut = isoToLocalDateTime(demain, offsetMinutes);

  return (
    <ActionForm action={addOuting} submitLabel="Programmer cette sortie" variant="secondary">
      <input type="hidden" name="spot_slug" value={spotSlug} />
      <input type="hidden" name="spot_path" value={spotPath} />
      <input type="hidden" name="tz_offset" value={offsetMinutes} />

      <Field label="Quand">
        <input
          type="datetime-local"
          name="planned_at"
          required
          defaultValue={defaut}
          className={INPUT_CLASS}
        />
      </Field>

      <Field
        label="Seuil de score (facultatif)"
        hint="En dessous, le courriel de la veille vous le dira en premier. Le danger, lui, est toujours signalé."
      >
        <input
          type="number"
          name="min_score"
          min={1}
          max={10}
          step={1}
          inputMode="numeric"
          placeholder="ex. 6"
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Note (facultatif)">
        <input
          type="text"
          name="note"
          maxLength={300}
          placeholder="Matériel, marée visée, qui vient…"
          className={INPUT_CLASS}
        />
      </Field>

      <label className="mt-4 flex items-start gap-3 text-body text-fg">
        <input type="checkbox" name="alerte" value="oui" defaultChecked className="mt-1" />
        <span>
          Me prévenir par courriel la veille, avec les conditions prévues.
          <span className="block text-meta text-fg-muted">
            Un seul message par sortie, jamais d’autre envoi. Décochez pour n’en recevoir aucun.
          </span>
        </span>
      </label>
    </ActionForm>
  );
}
