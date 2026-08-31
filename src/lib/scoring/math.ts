/** Helpers numériques du scoring. Aucun effet de bord, aucun import. */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fonction d'appartenance trapézoïdale.
 * 0 avant `a`, monte linéairement de `a` à `b`, vaut 1 sur [b, c],
 * redescend de `c` à `d`, 0 après. C'est la forme naturelle des plages
 * « optimal entre X et Y » de la spec.
 */
export function trapezoid(x: number, a: number, b: number, c: number, d: number): number {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

/** Interpolation linéaire de `from` vers `to` quand x parcourt [x0, x1]. */
export function ramp(x: number, x0: number, x1: number, from: number, to: number): number {
  if (x1 === x0) return to;
  const t = clamp((x - x0) / (x1 - x0), 0, 1);
  return from + (to - from) * t;
}

/** Plus petit écart angulaire entre deux caps, en degrés (0–180). */
export function angleDelta(a: number, b: number): number {
  const diff = Math.abs(((a - b) % 360) + 360) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** Arrondi à une décimale, sans zéro négatif. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10 + 0;
}
