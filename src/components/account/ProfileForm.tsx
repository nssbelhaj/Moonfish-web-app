'use client';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { createProfile, renameProfile } from '@/lib/auth/actions';

/**
 * Nom affiché — la seule information de profil que nous demandons.
 *
 * Ni photo, ni biographie, ni localisation : chacune serait une donnée
 * personnelle de plus à protéger, à exporter et à effacer, pour un site qui n'en
 * a aucun usage.
 */
export function ProfileForm({
  mode,
  currentName,
}: {
  mode: 'create' | 'rename';
  currentName?: string;
}) {
  return (
    <ActionForm
      action={mode === 'create' ? createProfile : renameProfile}
      submitLabel={mode === 'create' ? 'Choisir ce nom' : 'Changer de nom'}
      variant={mode === 'create' ? 'primary' : 'secondary'}
    >
      <Field
        label="Nom affiché"
        hint="Il apparaîtra sous vos avis et vos prises. Un pseudonyme convient parfaitement."
      >
        <input
          type="text"
          name="display_name"
          required
          minLength={2}
          maxLength={40}
          defaultValue={currentName ?? ''}
          autoComplete="nickname"
          className={INPUT_CLASS}
        />
      </Field>
    </ActionForm>
  );
}
