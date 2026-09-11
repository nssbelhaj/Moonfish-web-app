'use client';

import Link from 'next/link';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { CHAMP_PIEGE } from '@/lib/auth/piege';
import {
  definirNouveauMotDePasse,
  demanderNouveauMotDePasse,
  inscrire,
  seConnecter,
} from '@/lib/auth/actions-compte';
import { AGE_MINIMUM } from '@/data/schemas-compte';
import { MOT_DE_PASSE_MIN } from '@/lib/auth/password-regles';

/**
 * Formulaires de compte : connexion, inscription, mot de passe oublié.
 *
 * `autoComplete` est renseigné partout, et ce n'est pas décoratif : c'est ce
 * qui permet à un gestionnaire de mots de passe de proposer puis d'enregistrer
 * un mot de passe fort. Sans `new-password` sur l'inscription, le navigateur
 * propose l'ancien au lieu d'en générer un.
 */

export function ConnexionForm() {
  return (
    <ActionForm action={seConnecter} submitLabel="Se connecter" pendingLabel="Connexion…">
      <Field label="Adresse e-mail">
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="vous@exemple.fr"
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Mot de passe">
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={INPUT_CLASS}
        />
      </Field>

      <p className="text-body text-fg-muted">
        <Link
          href="/compte/mot-de-passe-oublie"
          className="underline decoration-dotted underline-offset-4"
        >
          Mot de passe oublié ?
        </Link>
      </p>
    </ActionForm>
  );
}

export function InscriptionForm() {
  return (
    <ActionForm action={inscrire} submitLabel="Créer mon compte" pendingLabel="Création…">
      {/*
        Champ-piège : hors écran, hors clavier, hors lecteur d'écran. Un robot
        qui remplit tout se dénonce en le remplissant. Voir `lib/auth/piege.ts`
        pour ce que cela vaut, et pourquoi ce n'est pas un CAPTCHA d'un tiers.
      */}
      <div aria-hidden="true" className="piege-robot">
        <label htmlFor="champ-site-web">Laissez ce champ vide</label>
        <input
          type="text"
          id="champ-site-web"
          name={CHAMP_PIEGE}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/*
        Prénom et nom sur une ligne dès qu'il y a la place : ce sont deux
        champs courts, et les empiler allongeait le formulaire sans raison.
        `min-w-0` empêche la grille de déborder quand le libellé est long.
      */}
      <div className="grid gap-3 sm:grid-cols-2 [&>label]:mt-0 [&>label]:min-w-0">
        <Field label="Prénom">
          <input
            type="text"
            name="first_name"
            autoComplete="given-name"
            required
            maxLength={60}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Nom">
          <input
            type="text"
            name="last_name"
            autoComplete="family-name"
            required
            maxLength={60}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field
        label="Date de naissance"
        hint={`Pour vérifier les ${AGE_MINIMUM} ans. Jamais affichée.`}
      >
        <input type="date" name="birth_date" autoComplete="bday" required className={INPUT_CLASS} />
      </Field>

      <Field label="Adresse e-mail">
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="vous@exemple.fr"
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Mot de passe" hint={`${MOT_DE_PASSE_MIN} caractères au minimum.`}>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MOT_DE_PASSE_MIN}
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Confirmation">
        <input
          type="password"
          name="password_confirm"
          autoComplete="new-password"
          required
          className={INPUT_CLASS}
        />
      </Field>

      {/*
        Case NON pré-cochée, et le consentement porte sur un texte daté qu'on
        peut lire avant de cocher. Une case pré-cochée n'est pas un
        consentement : elle est l'absence de refus.
      */}
      <label className="mt-2 flex max-w-prose items-start gap-3">
        <input
          type="checkbox"
          name="consentement"
          value="oui"
          required
          className="mt-1 h-5 w-5 shrink-0 rounded-[4px] border border-edge-strong"
        />
        <span className="text-body text-fg-muted">
          J’accepte que mes informations et mes contributions soient conservées comme l’explique la{' '}
          <Link href="/confidentialite" className="underline decoration-dotted underline-offset-4">
            politique de confidentialité
          </Link>
          . Je peux effacer mon compte, et tout ce qu’il contient, à tout moment.
        </span>
      </label>
    </ActionForm>
  );
}

export function MotDePasseOublieForm() {
  return (
    <ActionForm
      action={demanderNouveauMotDePasse}
      submitLabel="Recevoir un lien"
      pendingLabel="Envoi…"
    >
      <Field
        label="Adresse e-mail"
        hint="Celle de votre compte. Si elle n’est pas connue, rien ne sera envoyé — et la réponse sera la même."
      >
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          placeholder="vous@exemple.fr"
          className={INPUT_CLASS}
        />
      </Field>
    </ActionForm>
  );
}

export function NouveauMotDePasseForm({ jeton }: { jeton: string }) {
  return (
    <ActionForm
      action={definirNouveauMotDePasse}
      submitLabel="Changer mon mot de passe"
      pendingLabel="Enregistrement…"
    >
      <input type="hidden" name="jeton" value={jeton} />

      <Field label="Nouveau mot de passe" hint={`${MOT_DE_PASSE_MIN} caractères au minimum.`}>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          minLength={MOT_DE_PASSE_MIN}
          className={INPUT_CLASS}
        />
      </Field>

      <Field label="Confirmez le nouveau mot de passe">
        <input
          type="password"
          name="password_confirm"
          autoComplete="new-password"
          required
          className={INPUT_CLASS}
        />
      </Field>

      <p className="text-body text-fg-muted">
        Toutes vos sessions ouvertes seront fermées : c’est le but, si quelqu’un d’autre était
        entré.
      </p>
    </ActionForm>
  );
}
