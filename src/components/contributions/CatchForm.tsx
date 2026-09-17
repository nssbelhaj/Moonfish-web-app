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

export interface SpotChoice {
  slug: string;
  name: string;
  /** Groupe d'option : la région, pour retrouver un spot dans une longue liste. */
  regionName: string;
}

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
  speciesSuggestions,
  spotChoices,
  formId,
}: {
  spotSlug?: string;
  spotPath?: string;
  speciesSuggestions: readonly string[];
  /**
   * Liste de spots à choisir, quand la déclaration ne part PAS d'une page de
   * spot — depuis le carnet, par exemple, où l'on rattrape une sortie passée.
   * Fournie, elle remplace le spot fixe par un menu déroulant.
   */
  spotChoices?: readonly SpotChoice[];
  /**
   * Suffixe des identifiants internes. Deux exemplaires du formulaire sur une
   * même page partageraient sinon le même `id` de `datalist`, et le second
   * n'aurait plus de suggestions.
   */
  formId?: string;
}) {
  const [photo, setPhoto] = useState<PhotoState>({ kind: 'none' });
  const listeEspeces = `especes-connues${formId ? `-${formId}` : ''}`;

  // Les régions dans l'ordre de la liste, sans doublon : `Map` conserve
  // l'ordre d'insertion, ce qu'un objet ne garantit pas pour des clés
  // quelconques.
  const parRegion = new Map<string, SpotChoice[]>();
  for (const choix of spotChoices ?? []) {
    const groupe = parRegion.get(choix.regionName);
    if (groupe) groupe.push(choix);
    else parRegion.set(choix.regionName, [choix]);
  }

  // Valeur par défaut : maintenant, dans le fuseau du navigateur. La plupart des
  // prises se déclarent dans la foulée.
  const offsetMinutes = new Date().getTimezoneOffset();
  const nowLocal = isoToLocalDateTime(new Date(), offsetMinutes);

  async function handlePhoto(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return setPhoto({ kind: 'none' });

    setPhoto({ kind: 'working' });
    const result = await uploadCatchPhoto(file);
    setPhoto(result.ok ? { kind: 'ready', path: result.path } : { kind: 'error', message: result.message });
  }

  return (
    <ActionForm action={addCatch} submitLabel="Déclarer cette prise">
      {spotChoices === undefined && (
        <>
          <input type="hidden" name="spot_slug" value={spotSlug ?? ''} />
          <input type="hidden" name="spot_path" value={spotPath ?? ''} />
        </>
      )}
      <input type="hidden" name="tz_offset" value={offsetMinutes} />
      {photo.kind === 'ready' && <input type="hidden" name="photo_path" value={photo.path} />}

      {spotChoices !== undefined && (
        <Field label="Spot">
          <select name="spot_slug" required defaultValue="" className={INPUT_CLASS}>
            <option value="" disabled>
              Choisissez un spot
            </option>
            {[...parRegion].map(([region, choix]) => (
              <optgroup key={region} label={region}>
                {choix.map((spot) => (
                  <option key={spot.slug} value={spot.slug}>
                    {spot.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      )}

      <Field label="Espèce">
        <input
          type="text"
          name="species"
          required
          list={listeEspeces}
          maxLength={60}
          className={INPUT_CLASS}
        />
      </Field>
      <datalist id={listeEspeces}>
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

      {/*
        Publier est un GESTE, pas une conséquence : la case part décochée, et
        une prise non publiée ne quitte jamais votre carnet. Le choix est ici,
        au moment de la déclaration, et se change ensuite depuis le carnet.
      */}
      <label className="mt-3 flex max-w-prose items-start gap-3">
        <input
          type="checkbox"
          name="visibility"
          value="publique"
          className="mt-1 h-5 w-5 shrink-0 rounded-[4px] border border-edge-strong"
        />
        <span className="text-body text-fg">
          Publier sur la page du spot
          <span className="mt-0.5 block text-meta text-fg-muted">
            Sous votre nom affiché, avec la photo si vous en joignez une. Sans cette case, la prise
            reste dans votre carnet et vous seul la voyez.
          </span>
        </span>
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
