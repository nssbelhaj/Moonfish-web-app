import type { JourCoefficient, RegimeMaree } from '@/lib/forecast/coefficients';
import { MORTES_EAUX, VIVES_EAUX } from '@/lib/forecast/coefficients';
import { formatDateLong, formatDayNumber, formatWeekdayShort } from '@/lib/time';

/**
 * Trente jours de coefficients, d'un coup d'œil.
 *
 * ─── Pourquoi cette frise existe ──────────────────────────────────────────
 *
 * Le site sait dire s'il faut sortir ce soir. Il ne savait pas dire quand
 * poser un jour de congé. Les vives-eaux tombent deux fois par mois, elles
 * se calculent un an à l'avance, et c'est la seule donnée du site qui serve
 * à PLANIFIER plutôt qu'à décider. Un pêcheur qui repère « le 28 et le 29 »
 * n'a besoin de rien d'autre.
 *
 * ─── Ce que la frise dit, et ce qu'elle ne dit pas ────────────────────────
 *
 * Le coefficient est national, rapporté à Brest : il ne dépend pas du spot.
 * Il est calculé depuis la lunaison, pas lu dans la table du SHOM — quelques
 * points d'écart, sans conséquence pour repérer une vive-eau, mais l'écart
 * existe et la légende le dit. Aucune heure de marée ici : pour une heure,
 * c'est le SHOM qui fait foi, et cette frise ne prétend pas le remplacer.
 */

/** Bornes de l'échelle de lecture. Le coefficient réel vit entre 20 et 120. */
const PLANCHER = 20;
const PLAFOND = 120;

/** La frise est nationale : le coefficient est rapporté à Brest. */
const FUSEAU = 'Europe/Paris';

const REGIME_LU: Record<RegimeMaree, string> = {
  'vives-eaux': 'vives-eaux',
  moyen: 'marée moyenne',
  'mortes-eaux': 'mortes-eaux',
};

const TEINTE: Record<RegimeMaree, string> = {
  'vives-eaux': 'bg-accent',
  moyen: 'bg-water',
  'mortes-eaux': 'bg-edge-strong',
};

/** Court mois, pour marquer le passage d'un mois à l'autre dans la frise. */
function moisCourt(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { month: 'short', timeZone: FUSEAU }).format(date);
}

export function FriseCoefficients({ jours }: { jours: readonly JourCoefficient[] }) {
  return (
    <div>
      {/*
        Défilement horizontal assumé sur mobile : trente colonnes lisibles
        dans 360 px n'existent pas, et compresser la frise jusqu'à ce qu'elle
        y entre donnerait des barres de deux pixels, illisibles et donc
        inutiles. On fait défiler, et les pics restent identifiables.
      */}
      <ol className="flex gap-1 overflow-x-auto pb-2">
        {jours.map((jour) => {
          const date = new Date(jour.date);
          const hauteur = Math.round(
            ((Math.min(PLAFOND, Math.max(PLANCHER, jour.coefficient)) - PLANCHER) /
              (PLAFOND - PLANCHER)) *
              100,
          );

          const jourDuMois = formatDayNumber(date, FUSEAU);
          /*
            La frise traverse un mois : sans repère, « 13 » se lit comme le 13
            du mois en cours alors qu'il est du suivant — et c'est précisément
            la date qu'on note dans un agenda. Le premier jour d'un mois porte
            donc son mois à la place du jour de semaine, qui se recompte.
          */
          const changeDeMois = jourDuMois === '01' || jour === jours[0];

          return (
            <li key={jour.date} className="flex w-9 shrink-0 flex-col items-center gap-1">
              <span className="nums text-src text-fg-faint" data-numeric="">
                {jour.coefficient}
              </span>

              <span
                className={`flex h-16 w-full items-end rounded-[3px] bg-surface-2 ${
                  jour.pic ? 'ring-1 ring-edge-strong' : ''
                }`}
                /*
                  Une barre seule ne dit rien à qui ne voit pas la couleur, ni
                  à un lecteur d'écran : le titre porte la phrase complète.
                */
                title={`${formatDateLong(date, FUSEAU)} — coefficient ${jour.coefficient}, ${
                  REGIME_LU[jour.regime]
                }`}
              >
                <span
                  className={`w-full rounded-[3px] ${TEINTE[jour.regime]}`}
                  style={{ height: `${Math.max(hauteur, 4)}%` }}
                />
              </span>

              <span className="nums text-src text-fg-faint" data-numeric="">
                {changeDeMois ? moisCourt(date) : formatWeekdayShort(date, FUSEAU)}
              </span>
              <span className="nums text-meta font-600 text-fg" data-numeric="">
                {jourDuMois}
              </span>

              {/*
                Le pic est nommé, pas seulement cerclé : la bague seule est un
                canal visuel de plus, et le site s'interdit de faire porter une
                information par la seule apparence. La cellule vide garde la
                hauteur de ligne pour que les dates restent alignées.
              */}
              <span className="nums text-src text-accent" data-numeric="">
                {jour.pic ? 'pic' : '\u00a0'}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 max-w-prose text-meta nums text-fg-muted" data-numeric="">
        Vives-eaux à partir de {VIVES_EAUX}, mortes-eaux en dessous de {MORTES_EAUX}. Plus le
        coefficient est fort, plus le marnage et les courants sont importants — et plus l’estran
        découvre puis se recouvre vite. C’est une donnée nationale rapportée à Brest, calculée
        depuis la lunaison : comptez quelques points d’écart avec la table officielle, et
        reportez-vous au SHOM pour une heure de marée.
      </p>
    </div>
  );
}
