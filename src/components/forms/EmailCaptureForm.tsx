'use client';

// "use client" justifié : ce formulaire gère un état de soumission (idle →
// envoi → succès/erreur) et un appel fetch. C'est l'un des trois seuls
// composants clients du projet.

import Link from 'next/link';
import { useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { PUBLISHER } from '@/data/legal';

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success'; alreadyRegistered: boolean }
  | { kind: 'error'; message: string };

export function EmailCaptureForm({ source = 'site' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const inputId = useId();
  const feedbackId = useId();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus({ kind: 'sending' });

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, source }),
      });

      const payload = (await response.json()) as { ok?: boolean; message?: string; alreadyRegistered?: boolean };

      if (!response.ok || !payload.ok) {
        setStatus({
          kind: 'error',
          message: payload.message ?? 'Inscription impossible pour le moment.',
        });
        return;
      }

      setStatus({ kind: 'success', alreadyRegistered: payload.alreadyRegistered === true });
      setEmail('');
    } catch {
      setStatus({ kind: 'error', message: 'Connexion impossible. Réessayez dans un instant.' });
    }
  }

  if (status.kind === 'success') {
    return (
      <p
        className="rounded-card border bg-surface-2 px-4 py-4 text-body"
        role="status"
      >
        {status.alreadyRegistered
          ? 'Cette adresse était déjà inscrite. Vous serez prévenu au lancement.'
          : 'C’est noté. Vous serez prévenu des prochaines fonctionnalités.'}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="block text-meta text-fg-faint nums">
        Adresse e-mail
      </label>

      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id={inputId}
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="vous@exemple.fr"
          aria-describedby={status.kind === 'error' ? feedbackId : undefined}
          aria-invalid={status.kind === 'error'}
          className="min-h-[56px] flex-1 rounded-ctl border border-edge-strong bg-surface-2 px-4 text-body text-fg placeholder:text-fg"
        />
        <Button type="submit" disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'Envoi…' : 'Me prévenir'}
        </Button>
      </div>

      {status.kind === 'error' && (
        <p id={feedbackId} role="alert" className="mt-2 text-meta nums text-danger">
          {status.message}
        </p>
      )}

      {/* Ne promettre que ce qui est réellement implémenté. La désinscription
          en un clic n'existe pas encore : on renvoie vers l'adresse de contact
          PUBLIÉE plutôt que d'annoncer une fonctionnalité absente — et cette
          adresse vient de `src/data/legal.ts`, pas d'une chaîne écrite ici qui
          pourrait désigner une boîte inexistante. */}
      <p className="mt-3 text-meta text-fg-muted leading-[1.5]">
        Seule votre adresse est enregistrée, avec la page d’où vous vous inscrivez. Aucun partage à
        des tiers. Pour être retiré de la liste, écrivez à{' '}
        {PUBLISHER.email ? (
          <a href={`mailto:${PUBLISHER.email}`} className="underline decoration-dotted underline-offset-4">
            {PUBLISHER.email}
          </a>
        ) : (
          <Link href="/mentions-legales" className="underline decoration-dotted underline-offset-4">
            l’adresse indiquée dans les mentions légales
          </Link>
        )}{' '}
        : la suppression est manuelle tant que le produit n’est pas lancé.
      </p>
    </form>
  );
}
