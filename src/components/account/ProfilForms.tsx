'use client';

import { useRef, useState } from 'react';

import { ActionForm, Field, INPUT_CLASS } from '@/components/forms/ActionForm';
import { Button } from '@/components/ui/Button';
import { enregistrerPreferences, enregistrerProfil } from '@/lib/auth/actions-compte';
import type { Profile } from '@/data/schemas';

/**
 * Formulaires du profil : identité déclarative, préférences, photo.
 *
 * Rien ici n'est obligatoire. Un compte sert à tenir un carnet de prises, pas
 * à remplir une fiche : chaque champ vide reste vide, et le site ne réclame
 * jamais.
 */

export function ProfilForm({ profil }: { profil: Profile }) {
  return (
    <ActionForm action={enregistrerProfil} submitLabel="Enregistrer" pendingLabel="Enregistrement…">
      <div className="grid gap-3 sm:grid-cols-2 [&>label]:mt-0 [&>label]:min-w-0">
        <Field label="Prénom">
          <input
            type="text"
            name="first_name"
            autoComplete="given-name"
            maxLength={60}
            defaultValue={profil.firstName ?? ''}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Nom">
          <input
            type="text"
            name="last_name"
            autoComplete="family-name"
            maxLength={60}
            defaultValue={profil.lastName ?? ''}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 [&>label]:mt-0 [&>label]:min-w-0">
        <Field label="Ville">
          <input
            type="text"
            name="city"
            autoComplete="address-level2"
            maxLength={80}
            defaultValue={profil.city ?? ''}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Pays">
          <input
            type="text"
            name="country"
            autoComplete="country-name"
            maxLength={60}
            defaultValue={profil.country ?? ''}
            className={INPUT_CLASS}
          />
        </Field>
      </div>

      <Field
        label="Présentation"
        hint="Deux lignes sur votre pêche. Visible à côté de vos contributions. 280 caractères."
      >
        <textarea
          name="bio"
          rows={3}
          maxLength={280}
          defaultValue={profil.bio ?? ''}
          className={`${INPUT_CLASS} min-h-[84px] py-2`}
        />
      </Field>
    </ActionForm>
  );
}

export function PreferencesForm({ profil }: { profil: Profile }) {
  return (
    <ActionForm
      action={enregistrerPreferences}
      submitLabel="Enregistrer les préférences"
      pendingLabel="Enregistrement…"
    >
      <Case
        nom="notify_outings"
        coche={profil.notifyOutings}
        titre="Conditions de mes sorties, la veille"
        detail="Uniquement pour les sorties que vous avez programmées vous-même, et seulement si vous l’avez demandé en les créant."
      />

      <Case
        nom="notify_news"
        coche={profil.notifyNews}
        titre="Nouvelles du site"
        detail="Rare, et jamais publicitaire : nouveaux spots, changements de méthode de calcul. Désactivé par défaut — créer un compte n’est pas s’y abonner."
      />
    </ActionForm>
  );
}

function Case({
  nom,
  coche,
  titre,
  detail,
}: {
  nom: string;
  coche: boolean;
  titre: string;
  detail: string;
}) {
  return (
    <label className="mt-4 flex max-w-prose items-start gap-3 first:mt-0">
      <input
        type="checkbox"
        name={nom}
        value="oui"
        defaultChecked={coche}
        className="mt-1 h-5 w-5 shrink-0 rounded-[4px] border border-edge-strong"
      />
      <span>
        <span className="block text-body font-600 text-fg">{titre}</span>
        <span className="mt-0.5 block text-body text-fg-muted">{detail}</span>
      </span>
    </label>
  );
}

/**
 * Envoi de la photo de profil.
 *
 * En JavaScript plutôt qu'en action serveur : un `input[type=file]` ne
 * traverse pas `useActionState` sans que tout le formulaire soit reconstruit,
 * et l'aperçu immédiat compte plus ici qu'ailleurs — on veut voir ce qu'on
 * publie avant de le publier.
 */
export function AvatarForm({
  avatarUrl,
  initiale,
}: {
  avatarUrl: string | null;
  /** Lettre affichée tant qu'il n'y a pas de photo. Jamais d'image vide. */
  initiale?: string;
}) {
  const champ = useRef<HTMLInputElement>(null);
  const [apercu, setApercu] = useState<string | null>(avatarUrl);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(fichier: File): Promise<void> {
    setEnvoi(true);
    setMessage(null);

    const corps = new FormData();
    corps.set('photo', fichier);

    try {
      const reponse = await fetch('/api/compte/avatar', { method: 'POST', body: corps });
      const donnees = (await reponse.json()) as { ok: boolean; message?: string };

      if (!donnees.ok) {
        setMessage(donnees.message ?? 'Envoi impossible.');
        return;
      }

      setApercu(URL.createObjectURL(fichier));
      setMessage('Photo enregistrée.');
    } catch {
      setMessage('Le serveur n’a pas répondu. Réessayez.');
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar url={apercu} taille={72} initiale={initiale ?? '•'} />

      <div>
        <input
          ref={champ}
          type="file"
          accept="image/jpeg"
          className="sr-only"
          onChange={(evenement) => {
            const fichier = evenement.target.files?.[0];
            if (fichier) void envoyer(fichier);
          }}
        />

        <Button type="button" variant="secondary" onClick={() => champ.current?.click()} disabled={envoi}>
          {envoi ? 'Envoi…' : apercu ? 'Changer la photo' : 'Ajouter une photo'}
        </Button>

        <p className="mt-2 max-w-prose text-meta text-fg-muted">
          JPEG, 3 Mo au maximum. Elle apparaît à côté de vos contributions.
        </p>

        {message !== null && (
          <p className="mt-2 text-body text-fg" role="status">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Pastille d'avatar, ou initiale à défaut. Jamais d'image cassée. */
export function Avatar({
  url,
  taille = 40,
  initiale = '•',
}: {
  url: string | null;
  taille?: number;
  initiale?: string;
}) {
  const style = { width: taille, height: taille };

  return url === null ? (
    <span
      aria-hidden
      style={style}
      className="flex shrink-0 items-center justify-center rounded-pill bg-surface-2 font-serif text-fg"
    >
      {initiale}
    </span>
  ) : (
    // `img` et non `next/image` : la photo vient de notre propre route, sa
    // taille est connue, et l'optimiseur n'apporterait rien qu'un aller-retour.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      style={style}
      className="shrink-0 rounded-pill object-cover"
      width={taille}
      height={taille}
    />
  );
}
