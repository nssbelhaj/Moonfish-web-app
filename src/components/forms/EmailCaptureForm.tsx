'use client';

// "use client" justifié : ce formulaire gère un état de soumission (idle →
// envoi → succès/erreur) et un appel fetch. C'est l'un des trois seuls
// composants clients du projet.

import { useId, useState } from 'react';
import { Button } from '@/components/ui/Button';

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
        className="rounded-card border border-ok-line bg-ok-bg px-4 py-4 text-body"
        role="status"
      >
        {status.alreadyRegistered
          ? 'Cette adresse était déjà inscrite. Vous serez prévenu au lancement.'
          : 'C’est noté. Vous serez prévenu dès que les données réelles seront branchées.'}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="block font-mono text-label uppercase tracking-[0.14em] text-fg-muted">
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
          className="min-h-[56px] flex-1 rounded-input border border-edge-strong bg-card-raised px-4 text-body text-fg placeholder:text-fg-dim"
        />
        <Button type="submit" disabled={status.kind === 'sending'}>
          {status.kind === 'sending' ? 'Envoi…' : 'Me prévenir'}
        </Button>
      </div>

      {status.kind === 'error' && (
        <p id={feedbackId} role="alert" className="mt-2 font-mono text-data text-score-bad">
          {status.message}
        </p>
      )}

      <p className="mt-3 font-mono text-[0.6875rem] leading-[1.5] text-fg-dim">
        Une seule adresse, aucun partage à des tiers, désinscription en un clic. Rien d’autre n’est
        collecté.
      </p>
    </form>
  );
}
