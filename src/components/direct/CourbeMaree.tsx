import type { TideEvent } from '@/data/schemas';
import { eventsAround, sampleTideCurve, tideBounds, tideHeightAt } from '@/lib/forecast/tide-curve';
import { formatTime } from '@/lib/time';

/**
 * Vingt-quatre heures de marée, avec « maintenant » dessus.
 *
 * ─── Ce que cette courbe fait que le score ne fait pas ────────────────────
 *
 * Le score dit si c'est bon. La courbe dit POURQUOI, d'un coup d'œil : on
 * voit que la montante arrive, qu'on est à l'étale, que la pleine mer tombe
 * à la nuit. C'est la figure que tous les sites de marée mettent en tête —
 * et c'est la donnée la plus « vivante » du site, parce qu'elle bouge
 * réellement d'heure en heure.
 *
 * La fenêtre commence six heures AVANT maintenant et finit dix-huit heures
 * après : on lit d'où l'on vient et surtout où l'on va. Un repère vertical
 * marque l'instant, et les extremums sont annotés en heure et en hauteur.
 *
 * Pas d'animation, et ce n'est pas un oubli : sur un instrument, une chose qui
 * bouge est une chose qui change. Rien ici ne change entre deux rendus.
 */

const W = 640;
const H = 150;
const HAUT = 22;
const BAS = 26;
const GAUCHE = 8;
const DROITE = 8;

const AVANT_H = 6;
const APRES_H = 18;

export function CourbeMaree({
  events,
  now,
  timeZone,
}: {
  events: readonly TideEvent[];
  now: Date;
  timeZone: string;
}) {
  const de = new Date(now.getTime() - AVANT_H * 3_600_000);
  const a = new Date(now.getTime() + APRES_H * 3_600_000);
  const autour = eventsAround(events, de, a);
  const bornes = tideBounds(autour);
  const echantillons = sampleTideCurve(autour, de, a, 96);

  if (bornes === null || echantillons.length < 2) {
    return (
      <p className="text-meta text-fg-muted">
        Courbe de marée indisponible sur cette fenêtre : le fournisseur n’a pas rendu d’extremum
        autour de maintenant.
      </p>
    );
  }

  const x = (t: number) => GAUCHE + ((t - de.getTime()) / (a.getTime() - de.getTime())) * (W - GAUCHE - DROITE);
  const y = (h: number) => HAUT + (1 - (h - bornes.min) / (bornes.max - bornes.min)) * (H - HAUT - BAS);

  const ligne = echantillons
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${x(s.time).toFixed(1)},${y(s.heightM).toFixed(1)}`)
    .join(' ');
  const premier = echantillons[0]!;
  const dernier = echantillons[echantillons.length - 1]!;
  const aire = `${ligne} L${x(dernier.time).toFixed(1)},${H - BAS} L${x(premier.time).toFixed(1)},${H - BAS} Z`;

  const hauteurMaintenant = tideHeightAt(now, autour);
  const extremums = autour.filter((e) => {
    const t = new Date(e.time).getTime();
    return t >= de.getTime() && t <= a.getTime();
  });

  /* Graduations toutes les six heures, à partir d'une heure ronde. */
  const graduations: Date[] = [];
  for (let t = de.getTime(); t <= a.getTime(); t += 6 * 3_600_000) graduations.push(new Date(t));

  /*
    L'étiquette « maintenant » vit en haut, sauf si une pleine mer annotée
    est à moins de 80 unités : les deux textes se superposaient dès que
    l'instant tombait près d'une pleine mer — le cas le plus fréquent aux
    heures où l'on regarde. Elle descend alors juste au-dessus de l'axe.
  */
  const xMaintenant = x(now.getTime());
  /*
    Une étiquette centrée sur un point proche du bord sortait du cadre : « BM
    07:02 » se lisait « M 07:02 ». Le texte reste centré sur son point tant
    qu'il tient, et se rabat vers l'intérieur sinon.
  */
  const LARGEUR_ETIQUETTE = 92;
  const xEtiquette = (ex: number) =>
    Math.min(W - LARGEUR_ETIQUETTE / 2, Math.max(LARGEUR_ETIQUETTE / 2, ex));
  const pleineMerProche = extremums.some(
    (e) => e.type === 'high' && Math.abs(x(new Date(e.time).getTime()) - xMaintenant) < 80,
  );
  const yEtiquetteMaintenant = pleineMerProche ? H - BAS - 8 : HAUT - 10;

  const legende = extremums
    .map(
      (e) =>
        `${e.type === 'high' ? 'pleine mer' : 'basse mer'} à ${formatTime(new Date(e.time), timeZone)}, ${e.heightM.toFixed(1).replace('.', ',')} m`,
    )
    .join(' ; ');

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Courbe de marée sur vingt-quatre heures. ${legende}.`}
      >
        {/* L'eau, sous la courbe. */}
        <path d={aire} fill="var(--water)" opacity={0.28} />
        <path d={ligne} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />

        {/* Graduations horaires. */}
        {graduations.map((g) => (
          <g key={g.toISOString()}>
            <line
              x1={x(g.getTime())}
              x2={x(g.getTime())}
              y1={H - BAS}
              y2={H - BAS + 4}
              stroke="var(--edge-strong)"
            />
            <text
              x={x(g.getTime())}
              y={H - 8}
              textAnchor="middle"
              fontSize={11}
              fill="var(--fg-muted)"
              className="nums"
            >
              {formatTime(g, timeZone)}
            </text>
          </g>
        ))}

        {/* Les extremums, annotés. */}
        {extremums.map((e) => {
          const ex = x(new Date(e.time).getTime());
          const ey = y(e.heightM);
          const haut = e.type === 'high';
          return (
            <g key={e.time}>
              <circle cx={ex} cy={ey} r={3.5} fill="var(--accent)" />
              <text
                x={xEtiquette(ex)}
                y={haut ? ey - 9 : ey + 16}
                textAnchor="middle"
                fontSize={11.5}
                fill="var(--fg)"
                fontWeight={600}
                className="nums"
              >
                {haut ? 'PM' : 'BM'} {formatTime(new Date(e.time), timeZone)}
                <tspan fill="var(--fg-muted)" fontWeight={400}>
                  {' '}
                  · {e.heightM.toFixed(1).replace('.', ',')} m
                </tspan>
              </text>
            </g>
          );
        })}

        {/* Maintenant. */}
        <line
          x1={x(now.getTime())}
          x2={x(now.getTime())}
          y1={HAUT - 6}
          y2={H - BAS}
          stroke="var(--fg)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        />
        {hauteurMaintenant !== null && (
          <circle
            cx={x(now.getTime())}
            cy={y(hauteurMaintenant)}
            r={5}
            fill="var(--card)"
            stroke="var(--fg)"
            strokeWidth={2}
          />
        )}
        <text
          x={xEtiquette(xMaintenant)}
          y={yEtiquetteMaintenant}
          textAnchor="middle"
          fontSize={11}
          fill="var(--fg)"
          fontWeight={600}
        >
          maintenant
        </text>
      </svg>
      <figcaption className="sr-only">{legende}</figcaption>
    </figure>
  );
}
