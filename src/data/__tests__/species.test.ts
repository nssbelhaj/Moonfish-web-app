import { describe, expect, it } from 'vitest';
import { SPECIES, SPECIES_BY_NAME, seaOf } from '@/data/species';
import { SPOTS } from '@/data/spots';

describe('catalogue d’espèces', () => {
  it('ne porte AUCUNE fenêtre horaire par espèce', () => {
    // Garde-fou de fond. Une fenêtre de marée par espèce — « bar : 2,5 h avant
    // PM → 1 h après PM » — n'existe dans aucune source publique : ni le SHOM,
    // ni les fournisseurs météo ne la produisent. Elle avait été fabriquée par
    // un modèle et affichée avec l'autorité d'une mesure. Ce test empêche
    // qu'elle revienne par une porte dérobée.
    for (const species of SPECIES) {
      expect(species).not.toHaveProperty('window');
      expect(species).not.toHaveProperty('hoursFromHighTide');
      expect(JSON.stringify(species)).not.toMatch(/avant PM|après PM/);
    }
  });

  it('décrit le moment sans jamais d’horaire chiffré', () => {
    for (const species of SPECIES) {
      expect(species.moment.length).toBeGreaterThan(20);
      // Ni « 2,5 h », ni « 17:44 » : ce que la pratique enseigne, pas un horaire.
      expect(species.moment).not.toMatch(/\d\s*h\b|\d{2}:\d{2}/);
    }
  });

  it('ne promet jamais de prise (R16)', () => {
    const interdits = /ça va mordre|garanti|spot chaud|assuré|vous prendrez|à coup sûr/i;
    for (const species of SPECIES) {
      expect(species.moment).not.toMatch(interdits);
      expect(species.rig).not.toMatch(interdits);
    }
  });

  it('donne une maille positive, ou `null` qui veut dire « non vérifiée »', () => {
    // `null` ne veut JAMAIS dire « pas de maille ». Un chiffre faux ici fait
    // garder un poisson sous-maillé.
    for (const species of SPECIES) {
      for (const sea of ['atlantique', 'mediterranee'] as const) {
        const m = species.maille[sea];
        expect(m === null || (typeof m === 'number' && m > 0)).toBe(true);
      }
    }
  });

  it('donne au bar la maille de chaque façade', () => {
    const bar = SPECIES_BY_NAME.get('bar')!;
    expect(bar.maille.atlantique).toBe(42);
    expect(bar.maille.mediterranee).toBe(30);
  });

  it('rattache chaque région à sa façade', () => {
    expect(seaOf('occitanie')).toBe('mediterranee');
    expect(seaOf('bretagne')).toBe('atlantique');
    expect(seaOf('souss-massa')).toBe('atlantique');
  });

  it('porte toujours un montage, un nom scientifique et un fond', () => {
    for (const species of SPECIES) {
      expect(species.rig.length).toBeGreaterThan(20);
      expect(species.latin).toMatch(/^[A-Z][a-z]+ [a-z]+$/);
      expect(species.bottoms.length).toBeGreaterThan(0);
    }
  });

  it('rend visibles les espèces citées par un spot mais sans fiche', () => {
    // Elles s'affichent en une ligne sur la page plutôt que de disparaître.
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
