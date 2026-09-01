'use client';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { deleteAccount } from '@/lib/auth/actions';

/**
 * Effacement du compte.
 *
 * La confirmation se tape à la main. Ce n'est pas un ornement : le bouton
 * voisin est « se déconnecter », et les deux ne se rattrapent pas de la même
 * façon.
 */
export function DeleteAccountForm() {
  return (
    <ActionForm action={deleteAccount} submitLabel="Supprimer définitivement" variant="secondary">
      <Field label="Confirmation" hint="Recopiez le mot « supprimer » pour confirmer.">
        <input
          type="text"
          name="confirmation"
          required
          autoComplete="off"
          spellCheck={false}
          placeholder="supprimer"
          className={INPUT_CLASS}
        />
      </Field>
    </ActionForm>
  );
}
