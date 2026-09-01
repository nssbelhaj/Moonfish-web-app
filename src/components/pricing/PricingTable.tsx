import { ButtonLink } from '@/components/ui/Button';

interface Plan {
  name: string;
  price: string;
  priceNote: string;
  pitch: string;
  features: { label: string; included: boolean }[];
  cta: { href: string; label: string };
  highlighted: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Gratuit',
    price: '0 €',
    priceNote: 'pour toujours',
    pitch:
      'La valeur d’usage immédiate reste gratuite : savoir si ça vaut le coup d’y aller aujourd’hui.',
    features: [
      { label: 'Score du jour et des deux jours suivants', included: true },
      { label: 'Les 12 spots publics', included: true },
      { label: 'Marées et météo marine du jour', included: true },
      { label: 'Détail du calcul, facteur par facteur', included: true },
      { label: 'Alerte de sécurité houle et vent', included: true },
      { label: 'Prévisions de J+3 à J+6', included: false },
      { label: 'Alertes sur vos fenêtres favorables', included: false },
      { label: 'Spots favoris et carnet de prises', included: false },
    ],
    cta: { href: '/spots', label: 'Voir les spots' },
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '4,90 €',
    priceNote: 'par mois · pas encore lancé',
    pitch:
      'La profondeur temporelle et le suivi personnel. C’est ce qui se paie : pas le score du moment, la capacité à planifier.',
    features: [
      { label: 'Tout le plan Gratuit', included: true },
      { label: 'Prévisions complètes sur 7 jours', included: true },
      { label: 'Alertes e-mail sur vos seuils de score', included: true },
      { label: 'Spots favoris et comparaison', included: true },
      { label: 'Carnet de prises lié au créneau et aux conditions', included: true },
      { label: 'Historique des conditions par spot', included: true },
      { label: 'Export des données de vos sorties', included: true },
      { label: 'Accès anticipé aux nouveaux spots', included: true },
    ],
    cta: { href: '#waitlist', label: 'Être prévenu du lancement' },
    highlighted: true,
  },
];

function Check({ included }: { included: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false" className="mt-1 shrink-0">
      {included ? (
        <path
          d="M4 12.5 L9.5 18 L20 6"
          fill="none"
          stroke="var(--score-4)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ) : (
        <path d="M6 12 H18" fill="none" stroke="var(--fg-dim)" strokeWidth="2.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

/** Deux plans, pas trois. Le plan Pro porte la bordure 2 px, seul cas d'accent. */
export function PricingTable() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {PLANS.map((plan) => (
        <section
          key={plan.name}
          aria-labelledby={`plan-${plan.name}`}
          className={`surface flex flex-col p-6 ${plan.highlighted ? 'ring-2 ring-accent-score' : ''}`}
        >
          <h2 id={`plan-${plan.name}`} className="text-val-sm font-600">
            {plan.name}
          </h2>

          {/*
            Hauteur fixe sur le bloc prix : sans elle, « 0 € » et « À définir »
            n'occupent pas la même place et les deux listes de fonctionnalités
            démarrent à des ordonnées différentes — la comparaison colonne à
            colonne devient impossible à lire.
          */}
          <div className="mt-3 min-h-[5.5rem]">
            <p className="nums text-score-sm font-700" data-numeric="">
              {plan.price}
            </p>
            <p className="mt-1 text-meta text-fg-faint nums">{plan.priceNote}</p>
          </div>

          <p className="min-h-[5.5rem] text-body text-fg-muted">{plan.pitch}</p>

          <ul className="mt-2 flex-1 space-y-3">
            {plan.features.map((feature) => (
              <li key={feature.label} className="flex gap-3">
                <Check included={feature.included} />
                <span className={feature.included ? 'text-body' : 'text-body text-fg-faint'}>
                  {feature.label}
                  {!feature.included && <span className="sr-only"> — non inclus</span>}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <ButtonLink href={plan.cta.href} variant={plan.highlighted ? 'primary' : 'secondary'}>
              {plan.cta.label}
            </ButtonLink>
          </div>
        </section>
      ))}
    </div>
  );
}
