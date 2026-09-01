'use client';

import { useState } from 'react';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { addCatch } from '@/lib/auth/actions';
import { isoToLocalDateTime } from '@/lib/auth/local-time';
import { uploadCatchPhoto } from '@/lib/photo/upload';

type PhotoState =
  | { kind: 'none' }
  | { kind: 'working' }
  | { kind: 'ready'; path: string }
  | { kind: 'error'; message: string };

/**
 * Déclaration d'une prise.
 *
 * La photo est traitée AVANT la soumission : métadonnées retirées dans le
 * navigateur, puis envoi au stockage, et seul le chemin obtenu part avec le
 * formulaire. L'original ne quitte jamais l'appareil — c'est la seule façon de
 * garantir qu'aucune coordonnée GPS ne nous parvient, même par accident.
 */
export function CatchForm({
  spotSlug,
  spotPath,
  userId,
  speciesSuggestions,
}: {
  spotSlug: string;
  spotPath: string;
  userId: string;
  speciesSuggestions: readonly string[];
}) {
  const [photo, setPhoto] = useState<PhotoState>({ kind: 'none' });

  // Valeur par défaut : maintenant, dans le fuseau du navigateur. La plupart des
  // prises se déclarent dans la foulée.
  const offsetMinutes = new Date().getTimezoneOffset();
  const nowLocal = isoToLocalDateTime(new Date(), offsetMinutes);

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return setPhoto({ kind: 'none' });

    setPhoto({ kind: 'working' });
    const result = await uploadCatchPhoto(file, userId);
    setPhoto(result.ok ? { kind: 'ready', path: result.path } : { kind: 'error', message: result.message });
  }

  return (
    <ActionForm action={addCatch} submitLabel="Déclarer cette prise">
      <input type="hidden" name="spot_slug" value={spotSlug} />
      <input type="hidden" name="spot_path" value={spotPath} />
      <input type="hidden" name="tz_offset" value={offsetMinutes} />
      {photo.kind === 'ready' && <input type="hidden" name="photo_path" value={photo.path} />}

      <Field label="Espèce">
        <input
          type="text"
          name="species"
          required
          list="especes-connues"
          maxLength={60}
          className={INPUT_CLASS}
        />
      </Field>
      <datalist id="especes-connues">
        {speciesSuggestions.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Longueur en cm (facultatif)">
          <input type="number" name="length_cm" min={1} max={400} className={INPUT_CLASS} />
        </Field>
        <Field label="Poids en grammes (facultatif)">
          <input type="number" name="weight_g" min={1} max={200000} className={INPUT_CLASS} />
        </Field>
      </div>

      <Field label="Date et heure de la prise">
        <input
          type="datetime-local"
          name="caught_at"
          required
          defaultValue={nowLocal}
          className={INPUT_CLASS}
        />
      </Field>

      <label className="mt-4 flex items-center gap-3">
        <input
          type="checkbox"
          name="released"
          value="oui"
          className="h-5 w-5 rounded-[4px] border border-edge-strong"
        />
        <span className="text-body text-fg">Poisson remis à l’eau</span>
      </label>

      <Field
        label="Note (facultatif)"
        hint="Montage, moment de la marée, ce qui a fonctionné."
      >
        <textarea name="note" rows={3} maxLength={600} className={`${INPUT_CLASS} min-h-[90px] py-2`} />
      </Field>

      <Field
        label="Photo (facultatif)"
        hint="Les métadonnées, coordonnées GPS comprises, sont retirées sur votre appareil avant tout envoi."
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          onChange={handlePhoto}
          className="block w-full text-body text-fg file:mr-3 file:min-h-tap file:rounded-ctl file:border file:border-edge-strong file:bg-surface-2 file:px-4 file:text-body file:text-fg"
        />
      </Field>

      {photo.kind === 'working' && (
        <p role="status" className="mt-2 text-body text-fg-muted">
          Nettoyage des métadonnées et envoi…
        </p>
      )}
      {photo.kind === 'ready' && (
        <p role="status" className="mt-2 text-body text-fg-muted">
          Photo prête, sans métadonnées.
        </p>
      )}
      {photo.kind === 'error' && (
        <p role="alert" className="mt-2 text-body text-danger">
          {photo.message} Vous pouvez déclarer la prise sans photo.
        </p>
      )}
    </ActionForm>
  );
}
