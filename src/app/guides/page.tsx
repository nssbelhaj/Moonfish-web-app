import type { Metadata } from 'next';
import { GuideCard } from '@/components/guides/GuideCard';
import { Section } from '@/components/ui/Section';
import { listGuides } from '@/lib/guides';
import { absoluteUrl } from '@/lib/routes';

/**
 * Le nombre de guides se LIT, il ne s'écrit pas : la page disait « quatre »
 * alors qu'il y en avait dix, et rien ne pouvait le signaler — un chiffre
 * recopié est un chiffre périmé en attente.
 */
const EN_LETTRES: Record<number, string> = {
  4: 'Quatre', 5: 'Cinq', 6: 'Six', 7: 'Sept', 8: 'Huit', 9: 'Neuf', 10: 'Dix', 11: 'Onze', 12: 'Douze',
};

function combien(n: number): string {
  return EN_LETTRES[n] ?? String(n);
}

export async function generateMetadata(): Promise<Metadata> {
  const guides = await listGuides();
  return {
    title: 'Guides — comprendre les conditions de pêche du bord',
    description: `${combien(guides.length)} guides pour lire une marée, choisir son moment, comprendre le vent, la houle et la température de l’eau, débuter le surfcasting, pêcher de nuit et à pied en sécurité.`,
    alternates: { canonical: absoluteUrl('/guides') },
  };
}

export default async function GuidesPage() {
  const guides = await listGuides();
  const nombre = combien(guides.length);

  return (
    <div className="bg-page">
      <div className="mx-auto w-full max-w-shell px-4 pt-8 md:px-8 md:pt-12">
        <h1 className="font-serif text-h1 font-semibold">Guides</h1>
        <p className="mt-3 max-w-prose text-body text-fg-muted">
          Ce que le score regarde, et pourquoi. {nombre} articles écrits pour être utiles sur le
          terrain, sans promesse de prise et sans recette miracle.
        </p>
      </div>

      <Section>
        {/* Un h2 entre le h1 et les h3 des cartes : la hiérarchie de titres doit
            rester séquentielle pour la navigation au lecteur d'écran. */}
        <h2 className="font-serif text-h2 font-semibold">Les {nombre.toLowerCase()} guides</h2>
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
