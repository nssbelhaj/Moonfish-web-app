import { FACTOR_SUBJECTS } from './types';
import type { FactorResult, SafetyLevel, ScoreFactor, ScoreLabel } from './types';

/**
 * Aucune formulation de promesse de prise (D17, R10). Vocabulaire autorisé :
 * « conditions favorables », « créneau praticable », « fenêtre ».
 */
const LEAD: Record<ScoreLabel, string> = {
  Excellent: 'Conditions rarement aussi favorables sur ce spot.',
  Bon: 'Conditions favorables : le créneau vaut le déplacement.',
  Passable: 'Créneau praticable, sans plus.',
  Médiocre: 'Conditions défavorables, mieux vaut viser une autre marée.',
};

const POSITIVE: Record<ScoreFactor, string> = {
  tide: 'La marée travaille pour vous',
  wind: 'Le vent est bien placé',
  swell: 'L’état de mer est favorable',
  solunar: 'Le créneau solunaire est porteur',
  light: 'La lumière joue en votre faveur',
};

const NEGATIVE: Record<ScoreFactor, string> = {
  tide: 'La marée limite le créneau',
  wind: 'Le vent pénalise la sortie',
  swell: 'L’état de mer pénalise',
  solunar: 'Le solunaire n’apporte rien ici',
  light: 'La lumière n’aide pas',
};

/**
 * Phrase de déclaration des sources manquantes (D11).
 *
 * Elle est placée juste après la phrase d'accroche, avant les arguments : un
 * score amputé doit dire ce qui lui manque AVANT d'argumenter, sinon il se lit
 * comme un score complet.
 */
function missingSentence(missing: readonly ScoreFactor[]): string | null {
  if (missing.length === 0) return null;

  const subjects = missing.map((factor) => FACTOR_SUBJECTS[factor]);
  const last = subjects[subjects.length - 1] ?? '';
  const joined =
    subjects.length === 1 ? last : `${subjects.slice(0, -1).join(', ')} ni ${last}`;

  return `Calculé sans ${joined} : ${
    missing.length > 1 ? 'sources indisponibles' : 'source indisponible'
  }. Les autres facteurs ont été repondérés.`;
}

/**
 * Construit 2 à 3 phrases lisibles à partir du breakdown.
 *
 * On classe les facteurs par CONTRIBUTION (écart à la moyenne × poids) et non par
 * sous-score brut : un 9/10 sur la lumière pèse 5 %, il ne mérite pas d'être la
 * première explication d'un bon score. Le score n'apparaît jamais sans ces
 * raisons (handoff §2).
 *
 * `label === null` signifie qu'aucune source n'était disponible : il n'y a alors
 * rien à expliquer, et surtout rien à suggérer.
 */
export function buildReasons(
  breakdown: Record<ScoreFactor, FactorResult>,
  label: ScoreLabel | null,
  safety: { level: SafetyLevel },
  missing: readonly ScoreFactor[] = [],
): string[] {
  if (label === null) {
    return ['Prévision indisponible pour ce créneau.'];
  }

  const ranked = (Object.keys(breakdown) as ScoreFactor[])
    .map((factor) => ({ factor, entry: breakdown[factor] }))
    .filter((item): item is { factor: ScoreFactor; entry: FactorResult & { score: number } } =>
      item.entry.score !== null,
    )
    .map(({ factor, entry }) => ({
      factor,
      contribution: (entry.score - 5) * entry.weight,
      note: entry.note,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];

  const reasons: string[] = [];

  if (safety.level === 'danger') {
    reasons.push(
      'Conditions dangereuses depuis le bord : la sécurité prime sur le score, ne sortez pas.',
    );
  } else {
    reasons.push(LEAD[label]);
  }

  const declaration = missingSentence(missing);
  if (declaration) reasons.push(declaration);

  if (best && best.contribution > 0) {
    reasons.push(`${POSITIVE[best.factor]} — ${best.note}.`);
  }

  if (worst && worst !== best && worst.contribution < 0) {
    reasons.push(`${NEGATIVE[worst.factor]} — ${worst.note}.`);
  }

  // Si tout est neutre, on l'admet plutôt que d'inventer un argument.
  if (reasons.length < 2) {
    reasons.push('Aucun facteur ne se détache, ni dans un sens ni dans l’autre.');
  }

  return reasons.slice(0, 3);
}
