import type { SpeciesInfo } from '@/data/species';
import type { Spot, SpotBottom } from '@/data/schemas';
import type { ForecastSlot } from '@/lib/forecast';
import { clamp, round1 } from '@/lib/scoring/math';
import type { ScoreLabel } from '@/lib/scoring';
import { labelFor } from '@/lib/scoring';

export interface SpeciesActivity {
  species: SpeciesInfo;
  /** Indice d'activité 0–10, `null` si le créneau n'a pas assez de données. */
  index: number | null;
  label: ScoreLabel | null;
  /** Phrase courte : le moment de marée et le fond visés. */
  window: string;
  /** Ce qui explique l'indice, en une phrase honnête. */
  note: string;
}

/**
 * Distance à la fenêtre de marée d'une espèce, ramenée à un facteur 0–1.
 *
 * Dans la fenêtre : 1. Au-delà, la valeur décroît sur deux heures plutôt que de
 * tomber à zéro — une espèce hors de sa fenêtre n'est pas absente, elle est
 * moins probable, et un zéro net produirait des sauts d'indice absurdes entre
 * deux créneaux voisins.
 */
export function windowFit(hoursFromHighTide: number, window: { fromH: number; toH: number }): number {
  if (hoursFromHighTide >= window.fromH && hoursFromHighTide <= window.toH) return 1;
  const distance =
    hoursFromHighTide < window.fromH
      ? window.fromH - hoursFromHighTide
      : hoursFromHighTide - window.toH;
  return clamp(1 - distance / 2.5, 0.12, 1);
}

/**
 * Indice d'activité d'une espèce sur un créneau.
 *
 * C'est un MODÈLE, pas une mesure : il combine la fenêtre de marée, la phase
 * lumineuse, l'accord du fond et l'état de mer général. Il ne prédit aucune
 * prise et l'interface ne doit jamais le présenter autrement (R16, D4).
 *
 * Les espèces mal placées sont calculées comme les autres et affichées comme
 * les autres : savoir qu'une espèce n'est PAS là fait partie de la réponse, et
 * masquer les mauvais indices donnerait l'illusion que tout est possible.
 */
export function speciesActivity(
  species: SpeciesInfo,
  spot: Spot,
  slot: ForecastSlot,
): SpeciesActivity {
  const bottomFit = bottomAffinity(species, spot.bottom);
  const lightFit = lightAffinity(species, slot.lightPhase);

  // Sans marée, l'indice n'a plus de colonne vertébrale : on le déclare absent
  // plutôt que de le calculer sur les seuls facteurs restants.
  if (slot.tide === null) {
    return {
      species,
      index: null,
      label: null,
      window: describeWindow(species),
      note: 'Horaires de marée indisponibles : l’indice ne peut pas être calculé pour ce créneau.',
    };
  }

  const tideFit = windowFit(slot.tide.hoursFromHighTide, species.window);
  // L'état de mer général : une espèce bien placée reste inaccessible si l'on
  // ne peut pas pêcher du tout.
  const conditions = slot.score.value === null ? 0.6 : clamp(slot.score.value / 10, 0.2, 1);

  // Moyenne PONDÉRÉE, et non produit de facteurs.
  //
  // Le produit était trop brutal : quatre coefficients inférieurs à 1 se
  // multiplient et effondrent l'indice, si bien que le bar tombait à 0,7 au Cap
  // Ferret — où il est l'espèce emblématique — dès qu'il sortait de sa fenêtre.
  // Une somme pondérée dit ce qu'on veut vraiment dire : hors fenêtre, l'espèce
  // est moins probable, pas absente.
  const base =
    TIDE_WEIGHT * tideFit + LIGHT_WEIGHT * lightFit + CONDITIONS_WEIGHT * conditions;

  // Le fond, lui, reste une PORTE et non un terme : si la structure n'est pas
  // là, aucune marée ni aucune lumière ne fait apparaître le poisson. La porte
  // ne ferme jamais complètement — un congre sur du sable reste possible près
  // d'un enrochement isolé.
  const gate = 0.55 + 0.45 * bottomFit;

  // Plafond à 9,6 plutôt que 10 : un indice d'activité de cette nature ne mérite
  // pas un score parfait, et un « 10,0 » se lirait comme une certitude.
  const index = round1(clamp(MAX_INDEX * base * gate, 0, 10));

  return {
    species,
    index,
    label: labelFor(index),
    window: describeWindow(species),
    note: buildNote(species, { bottomFit, lightFit, tideFit }),
  };
}

/** Poids du modèle. La marée domine : c'est elle qui ouvre et ferme la fenêtre. */
const TIDE_WEIGHT = 0.55;
const LIGHT_WEIGHT = 0.27;
const CONDITIONS_WEIGHT = 0.18;
const MAX_INDEX = 9.6;

/** Phases voisines : l'aube et le crépuscule se ressemblent plus que le plein jour. */
const NEIGHBOURS: Record<string, readonly string[]> = {
  dawn: ['dusk', 'night'],
  dusk: ['dawn', 'night'],
  night: ['dawn', 'dusk'],
  day: ['dawn', 'dusk'],
};

export function lightAffinity(species: SpeciesInfo, phase: string): number {
  if (species.light.includes(phase as never)) return 1;
  const near = NEIGHBOURS[phase] ?? [];
  return species.light.some((p) => near.includes(p)) ? 0.7 : 0.4;
}

/**
 * Accord du fond. Un fond mêlé n'est pas un demi-fond : il porte les deux
 * structures, donc il convient presque autant que le fond pur correspondant.
 */
export function bottomAffinity(species: SpeciesInfo, bottom: SpotBottom): number {
  if (species.bottoms.includes(bottom)) return 1;
  if (bottom === 'sable-roche' && species.bottoms.some((b) => b === 'sable' || b === 'roche')) {
    return 0.85;
  }
  return 0.15;
}

function describeWindow(species: SpeciesInfo): string {
  const { fromH, toH } = species.window;
  const side = (h: number) =>
    h === 0 ? 'PM' : h < 0 ? `${fmt(-h)} h avant PM` : `${fmt(h)} h après PM`;
  return `${side(fromH)} → ${side(toH)}`;
}

function fmt(h: number): string {
  return h.toFixed(1).replace('.0', '').replace('.', ',');
}

function buildNote(
  species: SpeciesInfo,
  ctx: { bottomFit: number; lightFit: number; tideFit: number },
): string {
  if (ctx.bottomFit < 0.5) {
    return `Peu de fond favorable à cette espèce sur ce spot. ${species.rig}`;
  }
  if (ctx.tideFit < 0.5) {
    return `Hors de sa fenêtre de marée pour ce créneau. ${species.rig}`;
  }
  if (ctx.lightFit < 0.7) {
    return `La lumière du créneau ne lui correspond pas. ${species.rig}`;
  }
  return species.rig;
}
