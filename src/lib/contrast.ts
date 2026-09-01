/**
 * Contraste WCAG et distance perceptuelle.
 *
 * Sert à valider une palette AVANT de l'écrire, plutôt qu'à constater la
 * régression après coup dans un audit Lighthouse. Pur, sans dépendance.
 */

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex);
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

/** Rapport de contraste WCAG 2.1, de 1 (identique) à 21 (noir sur blanc). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface Oklab {
  L: number;
  a: number;
  b: number;
}

/**
 * Conversion sRGB → OKLab.
 *
 * Le contraste de luminance ne dit PAS si deux couleurs se distinguent : deux
 * teintes franchement différentes peuvent avoir la même luminance. Pour des
 * couleurs catégorielles — nos quatre paliers de score — la bonne grandeur est
 * la distance perceptuelle, et OKLab est l'espace où une distance euclidienne
 * correspond à peu près à ce que l'œil perçoit.
 */
export function hexToOklab(hex: string): Oklab {
  const [r8, g8, b8] = channels(hex);
  const r = srgbToLinear(r8);
  const g = srgbToLinear(g8);
  const b = srgbToLinear(b8);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** Distance perceptuelle entre deux couleurs, dans OKLab. */
export function perceptualDistance(x: string, y: string): number {
  const a = hexToOklab(x);
  const b = hexToOklab(y);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}
