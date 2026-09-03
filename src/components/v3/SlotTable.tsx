import type { ForecastSlot } from '@/lib/forecast';
import { formatMeasure, formatScore, tierForOrNull } from '@/lib/score-display';
import { formatTime } from '@/lib/time';
import { cardinal } from '@/lib/wind-direction';

/**
 * Les créneaux de la journée, en TABLEAU.
 *
 * ─── Pourquoi un tableau, et pas une liste de lignes ──────────────────────
 *
 * La version précédente n'affichait que l'heure, une jauge et la note. Le
 * pêcheur voyait « 8/10 » sans savoir POURQUOI, et devait remonter au graphique
 * pour retrouver l'état de la marée, puis à une autre carte pour le vent. La
 * note seule est un verdict sans motif : elle demande qu'on lui fasse
 * confiance, alors que tout l'argument du site est de montrer son calcul.
 *
 * Ici chaque ligne porte ses facteurs. Deux créneaux notés pareil ne se
 * ressemblent pas — l'un peut être porté par une marée descendante et l'autre
 * par une aube calme — et c'est cette différence qui décide de la sortie.
 *
 * C'est un vrai `<table>` : ce sont des données tabulaires, et un lecteur
 * d'écran doit pouvoir annoncer « Vent, 24 km/h secteur SO » plutôt que de
 * réciter une suite de nombres sans en-tête.
 *
 * ─── L'ordre des colonnes est un choix, pas une commodité ─────────────────
 *
 * En téléphone, le tableau défile horizontalement et les dernières colonnes
 * sortent de l'écran. L'ordre suit donc l'importance réelle pour la pêche du
 * bord : heure, note, MARÉE — la variable qui commande tout le reste — puis
 * vent, mer, lumière. Ce qui disparaît en premier est ce dont on peut se
 * passer.
 */

const ETAT_MAREE: Record<'rising' | 'falling' | 'slack', string> = {
  rising: 'Montante',
  falling: 'Descendante',
  slack: 'Étale',
};

const LUMIERE: Record<ForecastSlot['lightPhase'], string> = {
  dawn: 'Aube',
  day: 'Jour',
  dusk: 'Crépuscule',
  night: 'Nuit',
};

/**
 * Écart à la pleine mer, en heures et minutes.
 *
 * « PM +2 h 30 » se lit sans effort par quiconque pêche du bord, alors que
 * « 2,5 » demande une conversion mentale. Le signe est conservé : avant ou
 * après la pleine mer, ce n'est pas la même pêche.
 */
function ecartPleineMer(heures: number): string {
  const minutesTotal = Math.round(Math.abs(heures) * 60);
  const h = Math.floor(minutesTotal / 60);
  const m = minutesTotal % 60;
  const signe = heures < 0 ? '−' : '+';

  if (minutesTotal < 8) return 'PM';
  if (h === 0) return `PM ${signe}${m} min`;
  return m === 0 ? `PM ${signe}${h} h` : `PM ${signe}${h} h ${String(m).padStart(2, '0')}`;
}

/** Cellule vide qui DIT qu'elle est vide, plutôt que de laisser un blanc. */
function Absent({ raison }: { raison: string }) {
  return (
    <span className="text-fg-muted" title={raison}>
      —
    </span>
  );
}

export function SlotTable({
  slots,
  timeZone,
  nowMs,
  legende,
}: {
  slots: ForecastSlot[];
  timeZone: string;
  /** Instant courant : sert à marquer le créneau en cours. `null` pour ne rien marquer. */
  nowMs: number | null;
  /** Légende du tableau, annoncée par les lecteurs d'écran. */
  legende: string;
}) {
  return (
    <div className="-mx-[14px] overflow-x-auto px-[14px]">
      <table className="w-full min-w-[540px] border-collapse text-left">
        <caption className="sr-only">{legende}</caption>

        <thead>
          <tr className="border-b border-edge">
            {['Créneau', 'Note', 'Marée', 'Vent', 'Mer', 'Lumière'].map((titre) => (
              <th
                key={titre}
                scope="col"
                className="whitespace-nowrap pb-[7px] pr-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted"
              >
                {titre}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {slots.map((slot) => {
            const debut = new Date(slot.start).getTime();
            const fin = new Date(slot.end).getTime();
            const encours = nowMs !== null && debut <= nowMs && fin > nowMs;

            const tier = tierForOrNull(slot.score.value);
            const danger = slot.score.safety.level === 'danger';
            const couleur = danger ? 'var(--danger)' : (tier?.colorVar ?? 'var(--edge-strong)');
            const largeur = slot.score.value === null ? 0 : slot.score.value * 10;

            const conditions = slot.conditions;
            const maree = slot.tide;

            return (
              <tr
                key={slot.start}
                className={`border-b border-surface-2 last:border-b-0 ${
                  encours ? 'bg-page' : ''
                }`}
              >
                <th
                  scope="row"
                  className={`whitespace-nowrap py-[9px] pr-3 text-body font-normal nums ${
                    encours ? 'font-semibold text-fg' : 'text-fg-muted'
                  }`}
                  data-numeric=""
                >
                  {formatTime(new Date(slot.start), timeZone)}
                  <span className="text-fg-muted">–{formatTime(new Date(slot.end), timeZone)}</span>
                  {encours && (
                    <span className="ml-[6px] align-middle text-[10px] uppercase tracking-[0.06em] text-accent">
                      en cours
                    </span>
                  )}
                </th>

                <td className="py-[9px] pr-3">
                  <span className="flex items-center gap-2">
                    <span
                      className="text-[17px] font-bold nums"
                      style={{ color: couleur }}
                      data-numeric=""
                    >
                      {formatScore(slot.score.value)}
                    </span>
                    <span className="relative hidden h-[5px] w-[44px] rounded-[3px] bg-surface-2 sm:block">
                      <i
                        className="absolute inset-y-0 left-0 rounded-[3px]"
                        style={{ width: `${largeur}%`, backgroundColor: couleur }}
                      />
                    </span>
                  </span>
                  <span className="text-[11px]" style={{ color: couleur }}>
                    {danger ? 'Danger' : (tier?.label ?? 'Indispo.')}
                  </span>
                </td>

                <td className="whitespace-nowrap py-[9px] pr-3 text-[13px]">
                  {maree === null ? (
                    <Absent raison="Le fournisseur de marées ne couvre pas ce créneau." />
                  ) : (
                    <>
                      <span className="text-fg">{ETAT_MAREE[maree.state]}</span>
                      <span className="block text-[11px] text-fg-muted nums" data-numeric="">
                        {ecartPleineMer(maree.hoursFromHighTide)} · coef {maree.coefficient}
                      </span>
                    </>
                  )}
                </td>

                <td className="whitespace-nowrap py-[9px] pr-3 text-[13px]">
                  {conditions === null ? (
                    <Absent raison="La série météo ne couvre pas ce créneau." />
                  ) : (
                    <>
                      <span className="text-fg nums" data-numeric="">
                        {Math.round(conditions.windSpeedKmh)} km/h
                      </span>{' '}
                      <span className="text-fg-muted">{cardinal(conditions.windFromDeg)}</span>
                      {conditions.windGustKmh !== null && (
                        <span className="block text-[11px] text-fg-muted nums" data-numeric="">
                          rafales {Math.round(conditions.windGustKmh)}
                        </span>
                      )}
                    </>
                  )}
                </td>

                <td className="whitespace-nowrap py-[9px] pr-3 text-[13px]">
                  {conditions === null ? (
                    <Absent raison="La série marine ne couvre pas ce créneau." />
                  ) : (
                    <>
                      <span className="text-fg nums" data-numeric="">
                        {formatMeasure(conditions.swellHeightM, 'm', 1)}
                      </span>
                      <span className="block text-[11px] text-fg-muted nums" data-numeric="">
                        période {Math.round(conditions.swellPeriodS)} s
                      </span>
                    </>
                  )}
                </td>

                <td className="whitespace-nowrap py-[9px] text-[13px] text-fg-muted">
                  {LUMIERE[slot.lightPhase]}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
