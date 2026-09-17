import { describe, expect, it } from 'vitest';

import { catchInputSchema } from '@/data/schemas';

/**
 * Ce que le FORMULAIRE envoie, et ce que le schéma en fait.
 *
 * La case « Publier » existait, elle était cochée, et toutes les prises
 * arrivaient privées : l'action construisait son objet champ par champ et
 * oubliait celui-là. Le schéma était juste, le dépôt aussi, la base aussi —
 * la valeur ne traversait simplement pas. Seul un essai au navigateur l'a
 * montré. Ces quatre cas tiennent le trajet.
 */
function depuisFormulaire(champs: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(champs)) data.set(k, v);

  // Exactement ce que fait `addCatch`, pour les champs qui nous intéressent.
  return catchInputSchema.safeParse({
    spotSlug: data.get('spot_slug'),
    species: data.get('species'),
    caughtAt: '2026-09-01T18:30:00.000Z',
    visibility: data.get('visibility') ?? undefined,
  });
}

const BASE = { spot_slug: 'pen-hat', species: 'Bar' };

describe('la visibilité traverse le formulaire', () => {
  it('case cochée → publique', () => {
    const r = depuisFormulaire({ ...BASE, visibility: 'publique' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBe('publique');
  });

  it('case décochée (champ absent) → privée', () => {
    // Un navigateur n'envoie PAS une case décochée : le champ manque, et
    // c'est ce cas-là qui doit donner le défaut.
    const r = depuisFormulaire(BASE);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.visibility).toBe('privee');
  });

  it('refuse une valeur inventée plutôt que de la laisser passer', () => {
    // Quelqu'un qui bricole la requête n'obtient pas une troisième
    // visibilité : il obtient un refus.
    expect(depuisFormulaire({ ...BASE, visibility: 'tout-le-monde' }).success).toBe(false);
  });

  it('accepte sa propre sortie', () => {
    const une = catchInputSchema.parse({
      spotSlug: 'pen-hat',
      species: 'Bar',
      caughtAt: '2026-09-01T18:30:00.000Z',
      visibility: 'publique',
    });
    expect(catchInputSchema.parse(une).visibility).toBe('publique');
  });
});
