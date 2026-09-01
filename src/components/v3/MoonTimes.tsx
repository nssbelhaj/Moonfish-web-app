import type { ReactElement } from 'react';

import { formatTime } from '@/lib/time';

/**
 * Lever et coucher de Lune.
 *
 * Le cas particulier qui justifie un composant : `null` ne veut PAS dire
 * « donnée indisponible ». La Lune se lève environ cinquante minutes plus tard
 * chaque jour ; deux fois par mois, le lever tombe hors de la journée civile.
 * Écrire « indispo. » ferait passer un fait astronomique pour une panne de
 * fournisseur, exactement l'inverse de ce que le reste du site s'efforce de
 * distinguer. Une seule formulation, partagée par les deux écrans.
 */
export const NO_MOON_EVENT = 'pas ce jour';

export function moonTimeLabel(iso: string | null, timeZone: string): string {
  return iso === null ? NO_MOON_EVENT : formatTime(new Date(iso), timeZone);
}

export function MoonTimeCells({
  moonrise,
  moonset,
  timeZone,
}: {
  moonrise: string | null;
  moonset: string | null;
  timeZone: string;
}) {
  return (
    <>
      {[
        { label: 'Lever de lune', iso: moonrise },
        { label: 'Coucher de lune', iso: moonset },
      ].map(({ label, iso }) => (
        <div key={label}>
          <dt className="text-meta text-fg-muted">{label}</dt>
          <dd className="mt-0.5 text-fg-muted" data-numeric={iso === null ? undefined : ''}>
            {moonTimeLabel(iso, timeZone)}
          </dd>
        </div>
      ))}
    </>
  );
}

/**
 * Ligne compacte, pour le pied d'une carte : « lune 22:19–12:42 ».
 *
 * Quand un des deux instants manque, la phrase change de forme au lieu de
 * garder le tiret : « lune 22:19–12:42 » se lisait « pas ce jour–16:42 », ce
 * qui ne veut rien dire. Une absence se dit avec des mots, pas avec un signe de
 * ponctuation resté en place.
 */
export function MoonTimesInline({
  moonrise,
  moonset,
  timeZone,
}: {
  moonrise: string | null;
  moonset: string | null;
  timeZone: string;
}) {
  const time = (iso: string): ReactElement => (
    <span className="nums">{formatTime(new Date(iso), timeZone)}</span>
  );

  if (moonrise !== null && moonset !== null) {
    return (
      <>
        {'lune '}
        {time(moonrise)}
        {'–'}
        {time(moonset)}
      </>
    );
  }

  if (moonrise !== null) return <>{'lune : lever '}{time(moonrise)}, pas de coucher</>;
  if (moonset !== null) return <>{'lune : pas de lever, coucher '}{time(moonset)}</>;
  return <>lune : ni lever ni coucher</>;
}
