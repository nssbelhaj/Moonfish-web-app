import type { Metadata } from 'next';
import { EmailCaptureForm } from '@/components/forms/EmailCaptureForm';
import { PricingTable } from '@/components/pricing/PricingTable';
import { Section } from '@/components/ui/Section';
import { absoluteUrl } from '@/lib/routes';

export const metadata: Metadata = {
  title: 'Tarifs — ce qui reste gratuit et ce qui se paiera',
  description:
    'Le score du jour, les 12 spots et les marées restent gratuits. Le plan Pro couvrira les prévisions à 7 jours, les alertes, les favoris et le carnet de prises. Aucun paiement n’est ouvert pour l’instant.',
  alternates: { canonical: absoluteUrl('/pricing') },
};

const FAQ = [
  {
    question: 'Peut-on payer aujourd’hui ?',
    answer:
      'Non. Aucun moyen de paiement n’est en place et aucune date n’est annoncée. Cette page décrit la répartition envisagée entre gratuit et payant, pour que ce soit clair dès maintenant.',
  },
  {
    question: 'Pourquoi le score du jour reste-t-il gratuit ?',
    answer:
      'Parce que c’est la valeur d’usage immédiate : savoir s’il faut y aller ce soir. Ce qui se paie, c’est la profondeur temporelle et le suivi — planifier une semaine à l’avance, être alerté, garder trace de ses sorties.',
  },
  {
    question: 'Les alertes de sécurité seront-elles payantes ?',
    answer:
      'Jamais. Le bandeau qui signale une houle supérieure à 2,5 m ou un vent supérieur à 50 km/h restera accessible à tout le monde, sur toutes les pages, sans compte.',
  },
] as const;

export default function PricingPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <div className="mx-auto w-full max-w-shell px-4 pt-8 md:px-8 md:pt-12">
        <h1 className="text-val font-700">Ce qui reste gratuit, ce qui se paiera</h1>
        <p className="mt-3 max-w-prose text-body text-fg-muted">
          Le plan Pro n’existe pas encore et aucun paiement n’est ouvert. Cette page dit dès
          maintenant où passera la ligne, pour que personne ne découvre un mur après coup.
        </p>
      </div>

      <Section>
        <PricingTable />
      </Section>

      <Section title="Questions">
        <dl className="divide-y divide-edge">
          {FAQ.map((item) => (
            <div key={item.question} className="py-4">
              <dt className="text-body font-semibold font-600">{item.question}</dt>
              <dd className="mt-2 max-w-prose text-body text-fg-muted">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="waitlist" title="Être prévenu du lancement">
        <div className="max-w-[42rem]">
          <EmailCaptureForm source="pricing" />
        </div>
      </Section>
    </>
  );
}
