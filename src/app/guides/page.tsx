import type { Metadata } from 'next';
import { GuideCard } from '@/components/guides/GuideCard';
import { Section } from '@/components/ui/Section';
import { listGuides } from '@/lib/guides';
import { absoluteUrl } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Guides — comprendre les conditions de pêche du bord',
  description:
    'Quatre guides pour lire une marée, choisir un créneau sur le bar, interpréter le vent et la houle, et faire la part du vrai dans la théorie solunaire.',
  alternates: { canonical: absoluteUrl('/guides') },
};

export default async function GuidesPage() {
  const guides = await listGuides();

  return (
    <div data-theme="guide" className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 pt-8 md:px-8 md:pt-12">
        <h1 className="text-val font-700">Guides</h1>
        <p className="mt-3 max-w-prose text-body text-fg-muted">
          Ce que le score regarde, et pourquoi. Quatre articles écrits pour être utiles sur le
          terrain, sans promesse de prise et sans recette miracle.
        </p>
      </div>

      <Section>
        {/* Un h2 entre le h1 et les h3 des cartes : la hiérarchie de titres doit
            rester séquentielle pour la navigation au lecteur d'écran. */}
        <h2 className="text-val-sm font-600">Les quatre guides</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {guides.map((guide) => (
            <li key={guide.slug}>
              <GuideCard guide={guide} />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
