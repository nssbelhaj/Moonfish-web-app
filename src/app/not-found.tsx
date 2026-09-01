import { ButtonLink } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-shell px-4 py-16 md:px-8">
      <p className="text-meta text-fg-faint nums">Erreur 404</p>
      <h1 className="mt-3 font-serif text-h1 font-semibold">Cette page n’existe pas</h1>
      <p className="mt-3 max-w-prose text-body text-fg-muted">
        Le spot ou le guide que vous cherchez n’est pas dans le catalogue. Moonfish suit 12 spots
        pour l’instant, en France et au Maroc.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/spots">Voir les 12 spots</ButtonLink>
        <ButtonLink href="/guides" variant="secondary">
          Lire les guides
        </ButtonLink>
      </div>
    </div>
  );
}
