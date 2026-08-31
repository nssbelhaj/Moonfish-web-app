/**
 * Aléatoire déterministe.
 *
 * Toutes les données simulées du MVP passent par ici. Aucun `Math.random()`
 * dans le projet : deux builds du même jour doivent produire exactement les
 * mêmes pages statiques, sinon le diff devient illisible et le cache CDN inutile.
 */

/** Hash FNV-1a 32 bits d'une chaîne (le slug du spot, en pratique). */
export function hashString(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Générateur mulberry32 : rapide, sans état global, suffisant pour du mock. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bruit lisse et continu dans le temps, dans [-1, 1].
 *
 * Une suite de tirages indépendants donnerait un vent qui saute de 5 à 40 km/h
 * d'une heure à l'autre : personne n'y croirait. On somme trois sinusoïdes de
 * périodes et de phases décorrélées, ce qui produit une série continue,
 * dérivable, et toujours reproductible pour une graine donnée.
 */
export function smoothNoise(seed: number, t: number): number {
  const random = mulberry32(seed);
  const phases = [random(), random(), random()];
  const periods = [37.3, 13.7, 5.9];
  const amplitudes = [0.55, 0.3, 0.15];

  let total = 0;
  for (let i = 0; i < periods.length; i += 1) {
    const period = periods[i] as number;
    const phase = phases[i] as number;
    const amplitude = amplitudes[i] as number;
    total += amplitude * Math.sin(2 * Math.PI * (t / period + phase));
  }
  return total / (amplitudes[0]! + amplitudes[1]! + amplitudes[2]!);
}

/** Ramène un bruit [-1, 1] dans un intervalle [min, max]. */
export function noiseToRange(noise: number, min: number, max: number): number {
  return min + ((noise + 1) / 2) * (max - min);
}
