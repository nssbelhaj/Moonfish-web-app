import { describe, expect, it } from 'vitest';
import {
  BREST_UNIT_HEIGHT_M,
  coefficientAt,
  coefficientFromRange,
  coefficientTable,
  type TideExtreme,
} from '../tide-coefficient';

describe('coefficient de marée', () => {
  /**
   * Vérifications d'ancrage contre les valeurs officielles : ce sont elles qui
   * prouvent que l'unité de hauteur retenue est la bonne.
   */
  it('reproduit les points de repère du SHOM', () => {
    // Le coefficient 100 est, par construction, le marnage de deux unités de hauteur.
    expect(coefficientFromRange(2 * BREST_UNIT_HEIGHT_M)).toBe(100);
    // Vive-eau moyenne : coefficient 95, soit 5,80 m de marnage à Brest.
    expect(coefficientFromRange(5.8)).toBe(95);
    // Morte-eau moyenne : coefficient 45, soit 2,75 m.
    expect(coefficientFromRange(2.75)).toBe(45);
  });

  it('borne le résultat à l’échelle officielle 20–120', () => {
    expect(coefficientFromRange(0.1)).toBe(20);
    expect(coefficientFromRange(50)).toBe(120);
    expect(coefficientFromRange(7.32)).toBe(120);
  });

  it('rend un entier, comme les tables publiées', () => {
    for (const range of [1.9, 3.33, 4.87, 6.02]) {
      expect(Number.isInteger(coefficientFromRange(range))).toBe(true);
    }
  });
});

const H = 3_600_000;
const T0 = Date.UTC(2026, 8, 1, 0, 0, 0);

function extreme(hours: number, heightM: number, type: 'high' | 'low'): TideExtreme {
  return { time: new Date(T0 + hours * H).toISOString(), heightM, type };
}

describe('table de coefficients depuis les extremums de Brest', () => {
  it('moyenne les deux marnages qui encadrent une pleine mer', () => {
    // BM 1,0 · PM 7,0 · BM 1,4 → marnages 6,0 et 5,6, moyenne 5,8 → coefficient 95.
    const table = coefficientTable([
      extreme(0, 1.0, 'low'),
      extreme(6, 7.0, 'high'),
      extreme(12, 1.4, 'low'),
    ]);

    expect(table).toHaveLength(1);
    expect(table[0]?.coefficient).toBe(95);
  });

  it('se contente d’un seul côté quand l’autre manque', () => {
    const table = coefficientTable([extreme(6, 7.0, 'high'), extreme(12, 1.0, 'low')]);
    expect(table).toHaveLength(1);
    expect(table[0]?.coefficient).toBe(coefficientFromRange(6));
  });

  /**
   * Le coefficient ne dépend que d'une DIFFÉRENCE de hauteurs. Il doit donc
   * être identique que la source rapporte ses hauteurs au niveau moyen ou au
   * zéro des cartes — c'est ce qui rend le calcul fiable avec un fournisseur
   * étranger, dont le zéro de référence n'est pas le nôtre.
   */
  it('est insensible au zéro de référence de la source', () => {
    const chartDatum = coefficientTable([
      extreme(0, 1.0, 'low'),
      extreme(6, 7.0, 'high'),
      extreme(12, 1.4, 'low'),
    ]);
    const meanSeaLevel = coefficientTable([
      extreme(0, -3.0, 'low'),
      extreme(6, 3.0, 'high'),
      extreme(12, -2.6, 'low'),
    ]);

    expect(meanSeaLevel[0]?.coefficient).toBe(chartDatum[0]?.coefficient);
  });

  it('ignore les basses mers isolées', () => {
    expect(coefficientTable([extreme(0, 1, 'low'), extreme(12, 1, 'low')])).toHaveLength(0);
  });

  it('attache le coefficient à la pleine mer la plus proche', () => {
    const table = coefficientTable([
      extreme(0, 1.0, 'low'),
      extreme(6, 7.0, 'high'),
      extreme(12, 1.0, 'low'),
      extreme(18, 4.0, 'high'),
      extreme(24, 1.0, 'low'),
    ]);

    expect(table).toHaveLength(2);
    expect(coefficientAt(new Date(T0 + 5 * H), table)).toBe(table[0]?.coefficient);
    expect(coefficientAt(new Date(T0 + 19 * H), table)).toBe(table[1]?.coefficient);
    // Une vive-eau et une morte-eau doivent bien se distinguer.
    expect(table[0]!.coefficient).toBeGreaterThan(table[1]!.coefficient + 30);
  });

  it('rend null plutôt qu’une valeur inventée sur une table vide', () => {
    expect(coefficientAt(new Date(T0), [])).toBeNull();
  });
});
