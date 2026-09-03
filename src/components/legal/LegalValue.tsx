import { missingPublisherFields } from '@/data/legal';

/**
 * Une mention légale manquante s'affiche comme manquante.
 *
 * L'alternative habituelle — laisser le champ vide, ou écrire « Luna Marea » à la
 * place d'une raison sociale — produit une page qui a l'air conforme et ne
 * l'est pas. Sur un site dont l'argument entier est de dire ce qu'il ne sait
 * pas, c'est le dernier endroit où faire semblant.
 */
export function LegalValue({ value, hint }: { value: string | null; hint: string }) {
  if (value !== null && value.trim().length > 0) return <>{value}</>;

  return (
    <span className="rounded-ctl bg-surface-2 px-1.5 py-0.5 text-meta text-fg">
      À compléter — {hint}
    </span>
  );
}

/**
 * Bandeau d'en-tête tant que l'identité de l'éditeur n'est pas renseignée.
 * Il disparaît tout seul dès que `PUBLISHER` est complété : rien à penser à
 * retirer, donc rien à oublier.
 */
export function LegalDraftNotice() {
  const missing = missingPublisherFields();
  if (missing.length === 0) return null;

  const LABELS: Record<string, string> = {
    name: 'l’identité de l’éditeur',
    address: 'l’adresse postale',
    email: 'l’adresse de contact',
    publicationDirector: 'le directeur de la publication',
  };

  return (
    <div className="demo-frame mt-6 max-w-prose px-4 py-3" role="note">
      <p className="text-body text-fg">
        <strong className="font-600">Cette page n’est pas encore complète.</strong> Il manque{' '}
        {missing.map((field) => LABELS[field] ?? field).join(', ')}. Ces mentions sont exigées par
        l’article 6-III de la LCEN dès qu’un site est accessible au public : elles doivent être
        renseignées dans <code className="nums">src/data/legal.ts</code> avant l’ouverture.
      </p>
    </div>
  );
}
