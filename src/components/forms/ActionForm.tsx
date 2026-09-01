'use client';

import { useActionState, useEffect, useRef, type ReactNode } from 'react';

import { Button } from '@/components/ui/Button';
import type { ActionState } from '@/lib/auth/actions';

/**
 * Formulaire adossé à une action serveur.
 *
 * `useActionState` est le seul état client : la validation, l'écriture et le
 * message de retour vivent sur le serveur. Conséquence utile — le formulaire
 * FONCTIONNE sans JavaScript, l'action étant appelée par la soumission native ;
 * on n'y perd que l'affichage du message, pas l'enregistrement.
 *
 * Le retour est annoncé avec `role="status"` ou `role="alert"` selon l'issue :
 * un lecteur d'écran doit entendre l'échec, et ne pas être interrompu par un
 * succès.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Envoi…',
  variant = 'primary',
  className = '',
}: {
  action: (state: ActionState | null, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<[string, string][]>([]);

  /*
    React RÉINITIALISE un formulaire non contrôlé dès que son action se termine
    — y compris quand elle échoue. Mesuré : après un premier envoi refusé, le
    champ e-mail était vide et il fallait tout retaper, pendant que le message
    d'erreur affirmait que la saisie n'était pas perdue.

    On mémorise donc les valeurs envoyées, et on les remet en place quand
    l'action a échoué. En cas de SUCCÈS, on laisse React vider le formulaire :
    c'est le comportement voulu, il ne faut pas republier le même avis par
    double clic.
  */
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState | null, formData: FormData) => {
      submitted.current = [...formData.entries()].filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      );
      return action(previous, formData);
    },
    null,
  );

  useEffect(() => {
    const form = formRef.current;
    if (!form || state === null || state.ok) return;

    for (const [name, value] of submitted.current) {
      for (const field of form.querySelectorAll(`[name="${CSS.escape(name)}"]`)) {
        if (field instanceof HTMLInputElement) {
          // Un champ de fichier ne se remplit pas par programme, et c'est une
          // protection du navigateur, pas une limite à contourner.
          if (field.type === 'file') continue;
          if (field.type === 'checkbox' || field.type === 'radio') {
            if (field.value === value) field.checked = true;
          } else {
            field.value = value;
          }
        } else if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
          field.value = value;
        }
      }
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className={className} noValidate>
      {children}

      <div className="mt-4">
        <Button type="submit" variant={variant} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
      </div>

      {state && (
        <p
          role={state.ok ? 'status' : 'alert'}
          className={`mt-3 max-w-prose text-body ${state.ok ? 'text-fg-muted' : 'text-danger'}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}

/** Champ de saisie, apparence unique pour tous les formulaires du site. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="block text-meta text-fg-muted">{label}</span>
      {hint && <span className="mt-0.5 block max-w-prose text-meta text-fg-muted">{hint}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

export const INPUT_CLASS =
  'min-h-tap w-full rounded-ctl border border-edge-strong bg-surface-2 px-3 text-body text-fg';
