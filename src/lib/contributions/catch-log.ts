import type { Catch } from '@/data/schemas';

/**
 * Le carnet de prises : ce qu'une liste de déclarations dit une fois relue.
 *
 * ─── Pourquoi c'est un module pur, sans base ni page ──────────────────────
 *
 * Les prises existent déjà ; ce qui manquait, c'est le RECUL. Douze prises
 * listées par date ne disent pas qu'on n'a jamais rien pris ailleurs qu'à Pen
 * Hat, ni que la plus belle date d'octobre. Ces fonctions ne lisent rien et
 * n'écrivent rien : elles reçoivent les prises et rendent des chiffres, ce qui
 * les rend testables sans serveur et réutilisables par l'export.
 *
 * Aucune interprétation n'est ajoutée. Un carnet dit ce qu'on a déclaré, pas
 * ce qu'on vaut : « votre meilleur mois » est un fait, « vous progressez »
 * serait une flatterie qu'aucune donnée ne soutient.
 */

export interface SpeciesTally {
  species: string;
  count: number;
  /** Plus grande longueur déclarée, `null` si aucune mesure. */
  bestLengthCm: number | null;
  /** Plus grand poids déclaré, `null` si aucune mesure. */
  bestWeightG: number | null;
  released: number;
}

export interface SpotTally {
  spotSlug: string;
  count: number;
  lastAt: string;
}

export interface MonthTally {
  /** `AAAA-MM`, en UTC — le mois est une agrégation, pas une heure de prise. */
  month: string;
  count: number;
}

export interface CatchLogSummary {
  total: number;
  released: number;
  /** Part relâchée, de 0 à 1. `null` sans prise : ne pas confondre « aucune » et « 0 % ». */
  releaseRate: number | null;
  distinctSpecies: number;
  bySpecies: SpeciesTally[];
  bySpot: SpotTally[];
  /** Douze derniers mois, du plus ancien au plus récent, mois vides compris. */
  byMonth: MonthTally[];
  /** La prise la plus longue déclarée, s'il y en a une avec mesure. */
  longest: Catch | null;
  first: Catch | null;
  last: Catch | null;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Douze clés `AAAA-MM` se terminant par le mois de `now`, du plus ancien au plus récent. */
function lastTwelveMonths(now: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }

  return keys;
}

export function summarizeCatches(catches: readonly Catch[], now: Date = new Date()): CatchLogSummary {
  const sorted = [...catches].sort(
    (a, b) => new Date(a.caughtAt).getTime() - new Date(b.caughtAt).getTime(),
  );

  const species = new Map<string, SpeciesTally>();
  const spots = new Map<string, SpotTally>();
  const months = new Map<string, number>();

  let released = 0;
  let longest: Catch | null = null;

  for (const entry of sorted) {
    if (entry.released) released += 1;

    // Espèces comparées sans la casse : « Bar » et « bar » sont la même ligne
    // du carnet, même si l'affichage garde la première graphie rencontrée.
    const key = entry.species.trim().toLowerCase();
    const tally = species.get(key) ?? {
      species: entry.species.trim(),
      count: 0,
      bestLengthCm: null,
      bestWeightG: null,
      released: 0,
    };
    tally.count += 1;
    if (entry.released) tally.released += 1;
    if (entry.lengthCm !== null && (tally.bestLengthCm === null || entry.lengthCm > tally.bestLengthCm)) {
      tally.bestLengthCm = entry.lengthCm;
    }
    if (entry.weightG !== null && (tally.bestWeightG === null || entry.weightG > tally.bestWeightG)) {
      tally.bestWeightG = entry.weightG;
    }
    species.set(key, tally);

    const spot = spots.get(entry.spotSlug) ?? { spotSlug: entry.spotSlug, count: 0, lastAt: entry.caughtAt };
    spot.count += 1;
    if (entry.caughtAt > spot.lastAt) spot.lastAt = entry.caughtAt;
    spots.set(entry.spotSlug, spot);

    months.set(monthKey(entry.caughtAt), (months.get(monthKey(entry.caughtAt)) ?? 0) + 1);

    if (entry.lengthCm !== null && (longest === null || longest.lengthCm === null || entry.lengthCm > longest.lengthCm)) {
      longest = entry;
    }
  }

  const bySpecies = [...species.values()].sort((a, b) => b.count - a.count || a.species.localeCompare(b.species, 'fr'));
  const bySpot = [...spots.values()].sort((a, b) => b.count - a.count || a.spotSlug.localeCompare(b.spotSlug));
  const byMonth = lastTwelveMonths(now).map((month) => ({ month, count: months.get(month) ?? 0 }));

  return {
    total: sorted.length,
    released,
    releaseRate: sorted.length === 0 ? null : released / sorted.length,
    distinctSpecies: species.size,
    bySpecies,
    bySpot,
    byMonth,
    longest,
    first: sorted[0] ?? null,
    last: sorted[sorted.length - 1] ?? null,
  };
}

/** Libellé français d'un mois `AAAA-MM`, court : « oct. 2026 ». */
export function formatMonth(key: string): string {
  const [year, month] = key.split('-').map(Number);
  if (year === undefined || month === undefined) return key;

  return new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}
