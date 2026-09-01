import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_BY_NAME, seaOf } from '@/data/species';
import { SPOTS } from '@/data/spots';
import { buildForecastDays } from '@/lib/forecast';
import { generateMarineSeries } from '@/data/generators/marine';
import { generateTideEvents } from '@/data/generators/tide';
import { speciesActivity, windowFit } from '../activity';

const NOW = new Date('2026-09-01T09:00:00Z');
const FROM = new Date('2026-08-31T00:00:00Z');
const TO = new Date('2026-09-08T00:00:00Z');
const spot = SPOTS[0]!;

const days = buildForecastDays(
  spot,
  NOW,
  generateTideEvents(spot, FROM, TO),
  generateMarineSeries(spot, FROM, TO),
);
const slot = days[0]!.slots[4]!;
const bar = SPECIES_BY_NAME.get('bar')!;

describe('fenêtre de marée', () => {
  it('vaut 1 dans la fenêtre, bornes comprises', () => {
    expect(windowFit(-1, { fromH: -2.5, toH: 1 })).toBe(1);
    expect(windowFit(-2.5, { fromH: -2.5, toH: 1 })).toBe(1);
    expect(windowFit(1, { fromH: -2.5, toH: 1 })).toBe(1);
  });

  it('décroît hors fenêtre sans jamais tomber à zéro', () => {
    // Un zéro net produirait des sauts d'indice absurdes entre deux créneaux
    // voisins : une espèce hors de sa fenêtre est moins probable, pas absente.
    const just = windowFit(1.5, { fromH: -2.5, toH: 1 });
    const far = windowFit(5, { fromH: -2.5, toH: 1 });
    expect(just).toBeLessThan(1);
    expect(far).toBeLessThan(just);
    expect(far).toBeGreaterThan(0);
  });

  it('est symétrique de part et d’autre de la fenêtre', () => {
    const w = { fromH: -2, toH: 2 };
    expect(windowFit(-3, w)).toBeCloseTo(windowFit(3, w), 10);
  });
});

describe('indice d’activité', () => {
  it('reste borné à 0–10 avec une décimale', () => {
    for (const species of SPECIES) {
      const a = speciesActivity(species, spot, slot);
      expect(a.index).not.toBeNull();
      expect(a.index as number).toBeGreaterThanOrEqual(0);
      expect(a.index as number).toBeLessThanOrEqual(10);
      expect(Number.isInteger((a.index as number) * 10)).toBe(true);
    }
  });

  it('pénalise une espèce dont le fond n’est pas celui du spot', () => {
    // Le congre demande du dur : sur une plage de sable pur, il doit descendre,
    // et la note doit le DIRE plutôt que de laisser deviner.
    const sable = SPOTS.find((s) => s.bottom === 'sable')!;
    const congre = SPECIES_BY_NAME.get('congre')!;
    const sur = buildForecastDays(
      sable,
      NOW,
      generateTideEvents(sable, FROM, TO),
      generateMarineSeries(sable, FROM, TO),
    )[0]!.slots[4]!;

    const a = speciesActivity(congre, sable, sur);
    expect(a.index as number).toBeLessThan(5);
    expect(a.note).toContain('fond');
  });

  it('déclare l’indice absent quand la marée manque, au lieu de l’estimer', () => {
    const noTide = { ...slot, tide: null };
    const a = speciesActivity(bar, spot, noTide);
    expect(a.index).toBeNull();
    expect(a.label).toBeNull();
    expect(a.note).toContain('indisponibles');
  });

  it('décrit toujours une fenêtre lisible, en français', () => {
    for (const species of SPECIES) {
      const a = speciesActivity(species, spot, slot);
      expect(a.window).toMatch(/PM/);
      expect(a.window).not.toMatch(/\d\.\d/);
    }
  });

  it('ne promet jamais de prise (R16)', () => {
    const interdits = /ça va mordre|garanti|spot chaud|assuré|vous prendrez/i;
    for (const species of SPECIES) {
      const a = speciesActivity(species, spot, slot);
      expect(a.note).not.toMatch(interdits);
      expect(species.rig).not.toMatch(interdits);
    }
  });
});

describe('réglementation (D5)', () => {
  it('donne une maille positive, ou `null` qui veut dire « non vérifiée »', () => {
    // `null` ne veut JAMAIS dire « pas de maille ». Aucune valeur ne doit être
    // inventée : un chiffre faux ici fait garder un poisson sous-maillé.
    for (const species of SPECIES) {
      for (const sea of ['atlantique', 'mediterranee'] as const) {
        const m = species.maille[sea];
        expect(m === null || (typeof m === 'number' && m > 0)).toBe(true);
      }
    }
  });

  it('rattache chaque région à sa façade', () => {
    expect(seaOf('occitanie')).toBe('mediterranee');
    expect(seaOf('bretagne')).toBe('atlantique');
    expect(seaOf('souss-massa')).toBe('atlantique');
  });

  it('donne au bar la maille de chaque façade', () => {
    expect(bar.maille.atlantique).toBe(42);
    expect(bar.maille.mediterranee).toBe(30);
  });

  it('porte toujours un montage renseigné', () => {
    for (const species of SPECIES) {
      expect(species.rig.length).toBeGreaterThan(20);
      expect(species.latin).toMatch(/^[A-Z][a-z]+ [a-z]+$/);
    }
  });
});

describe('couverture du catalogue', () => {
  it('rend visibles les espèces citées par un spot mais absentes du catalogue', () => {
    // Ce test n'exige pas une couverture totale : il rend la liste VISIBLE.
    // Une espèce absente du catalogue ne s'affiche simplement pas dans l'écran
    // Espèces — mieux vaut le savoir que le découvrir en production.
    const missing = new Set<string>();
    for (const s of SPOTS) {
      for (const name of s.species) {
        if (!SPECIES_BY_NAME.has(name.toLowerCase())) missing.add(name);
      }
    }
    expect([...missing].sort()).toStrictEqual([
      'Bar moucheté',
      'Bonite',
      'Chinchard',
      'Dorade grise',
      'Limande',
      'Mérou brun',
      'Oblade',
      'Ombrine',
      'Pageot',
      'Raie bouclée',
      'Seiche',
    ]);
  });
});

describe('le modèle ne s’effondre pas (correction du produit de facteurs)', () => {
  it('garde une espèce emblématique dans la moitié haute, même hors fenêtre', () => {
    // Le produit de quatre coefficients faisait tomber le bar à 0,7 au Cap
    // Ferret dès qu'il sortait de sa fenêtre de marée. Hors fenêtre, une espèce
    // du spot est MOINS probable, pas absente.
    const ferret = SPOTS.find((s) => s.slug === 'cap-ferret')!;
    const jour = buildForecastDays(
      ferret,
      NOW,
      generateTideEvents(ferret, FROM, TO),
      generateMarineSeries(ferret, FROM, TO),
    )[0]!;

    const indices = jour.slots.map(
      (s) => speciesActivity(bar, ferret, s).index as number,
    );
    expect(Math.max(...indices)).toBeGreaterThan(7);
    // Même au pire créneau de la journée, il ne descend pas dans le décor.
    expect(Math.min(...indices)).toBeGreaterThan(3);
  });

  it('n’attribue jamais un 10,0, qui se lirait comme une certitude', () => {
    const jour = days[0]!;
    for (const s of jour.slots) {
      for (const species of SPECIES) {
        const i = speciesActivity(species, spot, s).index;
        if (i !== null) expect(i).toBeLessThan(10);
      }
    }
  });

  it('écarte franchement une espèce dont la structure manque', () => {
    // Le fond est une PORTE, pas un terme de la somme : sans structure, aucune
    // marée ni lumière ne fait apparaître le poisson.
    const sable = SPOTS.find((s) => s.bottom === 'sable')!;
    const congre = SPECIES_BY_NAME.get('congre')!;
    const roche = SPOTS.find((s) => s.bottom === 'roche')!;

    const surSable = speciesActivity(
      congre,
      sable,
      buildForecastDays(sable, NOW, generateTideEvents(sable, FROM, TO), generateMarineSeries(sable, FROM, TO))[0]!.slots[6]!,
    ).index as number;
    const surRoche = speciesActivity(
      congre,
      roche,
      buildForecastDays(roche, NOW, generateTideEvents(roche, FROM, TO), generateMarineSeries(roche, FROM, TO))[0]!.slots[6]!,
    ).index as number;

    expect(surSable).toBeLessThan(surRoche * 0.75);
  });

  it('classe les créneaux de façon monotone avec la fenêtre de marée', () => {
    // À fond, lumière et conditions égales, plus on est près de la fenêtre,
    // plus l'indice monte. Sinon le classement n'a aucun sens.
    const slotAt = (h: number) => ({ ...slot, tide: { ...slot.tide!, hoursFromHighTide: h } });
    const dans = speciesActivity(bar, spot, slotAt(-1)).index as number;
    const bord = speciesActivity(bar, spot, slotAt(1.8)).index as number;
    const loin = speciesActivity(bar, spot, slotAt(4.5)).index as number;
    expect(dans).toBeGreaterThan(bord);
    expect(bord).toBeGreaterThan(loin);
  });
});
