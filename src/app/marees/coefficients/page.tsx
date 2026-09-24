import type { Metadata } from 'next';
import Link from 'next/link';

import { FriseCoefficients } from '@/components/accueil/FriseCoefficients';
import { Section } from '@/components/ui/Section';
import { referenceNow } from '@/lib/forecast';
import {
  MORTES_EAUX,
  VIVES_EAUX,
  prochainsCoefficients,
  type JourCoefficient,
} from '@/lib/forecast/coefficients';
import { absoluteUrl } from '@/lib/routes';
import { formatDateLong, formatDayNumber, formatWeekdayShort } from '@/lib/time';

/** Le coefficient est de l'astronomie : une fois par jour suffit largement. */
export const revalidate = 86_400;

const JOURS = 60;
const FUSEAU = 'Europe/Paris';

export const metadata: Metadata = {
  title: 'Coefficients de marée — les 60 prochains jours, vives-eaux et mortes-eaux',
  description:
    'Le calendrier des coefficients de marée sur deux mois : les dates des prochaines vives-eaux et mortes-eaux, jour par jour, pour poser un jour de congé au bon moment. Calculé depuis la lunaison, rapporté à Brest.',
  alternates: { canonical: absoluteUrl('/marees/coefficients') },
  openGraph: {
    title: 'Coefficients de marée — les 60 prochains jours',
    description: 'Les dates des prochaines vives-eaux et mortes-eaux, jour par jour.',
    url: absoluteUrl('/marees/coefficients'),
  },
};

/** Les jours, regroupés par mois civil, pour un tableau qui se lit comme un calendrier. */
function parMois(jours: readonly JourCoefficient[]): { mois: string; jours: JourCoefficient[] }[] {
  const groupes: { mois: string; jours: JourCoefficient[] }[] = [];
  for (const jour of jours) {
    const mois = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: FUSEAU }).format(
      new Date(jour.date),
    );
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.mois === mois) dernier.jours.push(jour);
    else groupes.push({ mois, jours: [jour] });
  }
  return groupes;
}

const REGIME = {
  'vives-eaux': 'vives-eaux',
  moyen: '',
  'mortes-eaux': 'mortes-eaux',
} as const;

export default function CoefficientsPage() {
  const now = referenceNow();
  const jours = prochainsCoefficients(now, JOURS);
  const pics = jours.filter((jour) => jour.pic);
  const mois = parMois(jours);

  return (
    <>
      <div className="mx-auto w-full max-w-shell px-4 pt-8 md:px-8 md:pt-12">
        <p className="label">Marées</p>
        <h1 className="mt-3 max-w-[18ch] font-serif text-display font-semibold md:text-display-lg">
          Les coefficients de marée des {JOURS} prochains jours
        </h1>
        <p className="mt-5 max-w-prose text-read text-fg-muted">
          Les vives-eaux tombent deux fois par mois, à la nouvelle et à la pleine lune, avec deux
          jours de retard. C’est la seule donnée de la pêche du bord qui se connaisse des mois à
          l’avance — celle avec laquelle on pose un jour de congé.
        </p>

        {pics.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {pics.slice(0, 4).map((pic) => (
              <div key={pic.date} className="border-l-2 border-edge pl-3">
                <dt className="text-meta text-fg-muted">Pic de vive-eau</dt>
                <dd className="font-serif text-h3 font-semibold text-fg">
                  {formatDateLong(new Date(pic.date), FUSEAU)}
                </dd>
                <dd className="text-meta nums text-fg-muted" data-numeric="">
                  coefficient {pic.coefficient}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <Section title="Les trente prochains jours, d’un coup d’œil">
        <FriseCoefficients jours={jours.slice(0, 30)} />
      </Section>

      <Section
        title="Jour par jour"
        lead={`Vives-eaux à partir de ${VIVES_EAUX}, mortes-eaux en dessous de ${MORTES_EAUX}. Le coefficient est national, rapporté à Brest : il vaut pour toute la façade Manche-Atlantique. En Méditerranée, le marnage se compte en centimètres et ce calendrier ne dit presque rien.`}
      >
        <div className="grid gap-8 md:grid-cols-2 md:items-start lg:grid-cols-3">
          {mois.map((groupe) => (
            <table key={groupe.mois} className="w-full text-body">
              <caption className="pb-2 text-left font-serif text-h3 font-semibold capitalize">
                {groupe.mois}
              </caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Jour</th>
                  <th scope="col">Coefficient</th>
                  <th scope="col">Régime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {groupe.jours.map((jour) => {
                  const date = new Date(jour.date);
                  return (
                    <tr key={jour.date} className={jour.regime === 'vives-eaux' ? 'bg-surface-2' : ''}>
                      <td className="py-1.5 pl-2 nums text-fg-muted" data-numeric="">
                        {formatWeekdayShort(date, FUSEAU)}{' '}
                        <span className="font-600 text-fg">{formatDayNumber(date, FUSEAU)}</span>
                      </td>
                      <td className="py-1.5 text-right nums font-600 text-fg" data-numeric="">
                        {jour.coefficient}
                      </td>
                      <td className="py-1.5 pl-3 pr-2 text-meta text-fg-muted">
                        {jour.pic ? 'pic' : REGIME[jour.regime]}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}
        </div>

        <p className="mt-8 max-w-prose text-meta text-fg-muted">
          Ces coefficients sont calculés depuis la lunaison, pas lus dans la table du SHOM : comptez
          quelques points d’écart. Pour une heure de marée sur un spot, chaque page de spot donne
          ses pleines et basses mers ; pour l’officiel, c’est{' '}
          <Link href="https://maree.shom.fr" className="text-fg underline decoration-dotted underline-offset-4" rel="noopener">
            maree.shom.fr
          </Link>
          . Pour comprendre ce que le coefficient change à la pêche,{' '}
          <Link
            href="/guides/comprendre-les-coefficients-de-maree"
            className="text-fg underline decoration-dotted underline-offset-4"
          >
            lisez le guide
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
