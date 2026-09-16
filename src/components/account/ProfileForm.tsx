'use client';

import Link from 'next/link';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { AGE_MINIMUM } from '@/data/schemas-compte';
import { createProfile, renameProfile } from '@/lib/auth/actions';

/**
 * Nom affiché — et, à la création, ce que l'inscription par mot de passe a
 * déjà demandé : la date de naissance et le consentement.
 *
 * Ce formulaire est le passage obligé de qui arrive par Google ou par le lien
 * courriel. Sans lui, ces deux chemins ouvraient un compte sans vérifier
 * l'âge ni recueillir de consentement — le seuil doit être le même quel que
 * soit le bouton pressé.
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

      {mode === 'create' && (
        <>
          <Field
            label="Date de naissance"
            hint={`Pour vérifier les ${AGE_MINIMUM} ans. Jamais affichée.`}
          >
            <input type="date" name="birth_date" autoComplete="bday" required className={INPUT_CLASS} />
          </Field>

          {/* Case NON pré-cochée : une case pré-cochée n'est pas un consentement. */}
          <label className="mt-4 flex max-w-prose items-start gap-3">
            <input
              type="checkbox"
              name="consentement"
              value="oui"
              required
              className="mt-1 h-5 w-5 shrink-0 rounded-[4px] border border-edge-strong"
            />
            <span className="text-body text-fg-muted">
              J’accepte que mes informations et mes contributions soient conservées comme
              l’explique la{' '}
              <Link href="/confidentialite" className="underline decoration-dotted underline-offset-4">
                politique de confidentialité
              </Link>
              . Je peux effacer mon compte, et tout ce qu’il contient, à tout moment.
            </span>
          </label>
        </>
      )}
    </ActionForm>
  );
}
