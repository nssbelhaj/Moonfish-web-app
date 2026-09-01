'use client';

import Link from 'next/link';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { requestSignInLink } from '@/lib/auth/actions';

/**
 * Connexion par lien reçu par courriel. Pas de mot de passe : rien à retenir,
 * rien à voler chez nous, rien à réutiliser ailleurs.
 */
export function SignInForm({ next = '/compte' }: { next?: string }) {
  return (
    <ActionForm action={requestSignInLink} submitLabel="Recevoir un lien de connexion">
      <input type="hidden" name="next" value={next} />

      <Field label="Adresse e-mail" hint="Elle sert à vous reconnaître, et à rien d’autre.">
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="vous@exemple.fr"
          className={INPUT_CLASS}
        />
      </Field>

      {/*
        Case NON pré-cochée, et le consentement porte sur un texte daté que
        l'on peut lire avant de cocher. Une case pré-cochée n'est pas un
        consentement : elle est l'absence de refus.
      */}
      <label className="mt-4 flex max-w-prose items-start gap-3">
        <input
          type="checkbox"
          name="consentement"
          value="oui"
          required
          className="mt-1 h-5 w-5 shrink-0 rounded-[4px] border border-edge-strong"
        />
        <span className="text-body text-fg-muted">
          J’accepte que mon adresse e-mail et mes contributions soient conservées comme l’explique
          la{' '}
          <Link href="/confidentialite" className="underline decoration-dotted underline-offset-4">
            politique de confidentialité
          </Link>
          . Je peux effacer mon compte, et tout ce qu’il contient, à tout moment.
        </span>
      </label>
    </ActionForm>
  );
}
