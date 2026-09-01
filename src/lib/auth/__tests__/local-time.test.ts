import { describe, expect, it } from 'vitest';

import { isoToLocalDateTime, localDateTimeToIso } from '../local-time';

describe('heure locale d’un formulaire → instant', () => {
  it('interprète l’heure saisie dans le fuseau du navigateur, pas en UTC', () => {
    // France en été : UTC+2, donc getTimezoneOffset() vaut -120.
    expect(localDateTimeToIso('2026-09-01T18:30', -120)).toBe('2026-09-01T16:30:00.000Z');
  });

  it('gère l’hiver, où le décalage change', () => {
    // La même saisie, en janvier, ne donne pas le même instant : c'est la
    // raison d'être du champ caché. Coder « +2 h » en dur daterait toutes les
    // prises d'hiver une heure trop tôt.
    expect(localDateTimeToIso('2026-01-15T18:30', -60)).toBe('2026-01-15T17:30:00.000Z');
  });

  it('gère un fuseau à l’ouest', () => {
    expect(localDateTimeToIso('2026-09-01T18:30', 240)).toBe('2026-09-01T22:30:00.000Z');
  });

  it('n’inverse pas le signe du décalage', () => {
    // L'erreur classique : `getTimezoneOffset` rend l'OPPOSÉ du décalage usuel.
    // L'inverser décalerait la prise de quatre heures, soit une marée entière.
    const juste = localDateTimeToIso('2026-09-01T18:30', -120) as string;
    const inverse = localDateTimeToIso('2026-09-01T18:30', 120) as string;
    const ecartH = (new Date(inverse).getTime() - new Date(juste).getTime()) / 3_600_000;
    expect(ecartH).toBe(4);
  });

  it('refuse ce qui n’est pas une date de formulaire', () => {
    for (const value of ['', 'demain', '2026-09-01', '2026-09-01T18:30:00Z', '01/09/2026 18:30']) {
      expect(localDateTimeToIso(value, 0)).toBeNull();
    }
  });

  it('fait l’aller-retour sans dériver', () => {
    for (const offset of [-120, -60, 0, 240, 330]) {
      const instant = new Date('2026-09-01T16:30:00.000Z');
      const local = isoToLocalDateTime(instant, offset);
      expect(localDateTimeToIso(local, offset)).toBe(instant.toISOString());
    }
  });
});
