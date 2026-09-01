import { describe, expect, it } from 'vitest';

import { catchInputSchema, displayNameSchema, spotReviewInputSchema } from '../schemas';

const BASE = {
  spotSlug: 'pen-hat',
  species: 'Bar',
  caughtAt: '2026-09-01T16:30:00.000Z',
};

describe('avis sur un spot', () => {
  it('accepte une note venue d’un formulaire, donc une chaîne', () => {
    const parsed = spotReviewInputSchema.parse({ spotSlug: 'pen-hat', rating: '4' });
    expect(parsed.rating).toBe(4);
  });

  it('refuse les notes hors de l’échelle', () => {
    for (const rating of ['0', '6', '-1', '4.5']) {
      expect(spotReviewInputSchema.safeParse({ spotSlug: 'pen-hat', rating }).success).toBe(false);
    }
  });

  it('transforme un commentaire vide en absence de commentaire', () => {
    // `''` en base ferait afficher un bloc de commentaire vide sous l'avis.
    const parsed = spotReviewInputSchema.parse({ spotSlug: 'pen-hat', rating: 3, comment: '   ' });
    expect(parsed.comment).toBeNull();
  });

  it('refuse un commentaire plus long que ce que la base accepte', () => {
    // La borne est celle de la contrainte SQL : si le schéma était plus
    // permissif, la base rejetterait la saisie avec une erreur technique en
    // pleine figure de l'utilisateur.
    const parsed = spotReviewInputSchema.safeParse({
      spotSlug: 'pen-hat',
      rating: 3,
      comment: 'a'.repeat(1201),
    });
    expect(parsed.success).toBe(false);
  });
});

describe('déclaration de prise', () => {
  it('accepte une prise sans mesure : c’est le cas le plus fréquent', () => {
    const parsed = catchInputSchema.parse({ ...BASE, lengthCm: '', weightG: '' });
    expect(parsed.lengthCm).toBeNull();
    expect(parsed.weightG).toBeNull();
  });

  it('ne confond pas « pas mesuré » et « zéro »', () => {
    // Un champ vide doit devenir `null`, pas 0 : un bar de 0 cm n'existe pas, et
    // il fausserait toute moyenne calculée un jour sur ces déclarations.
    const parsed = catchInputSchema.parse({ ...BASE, lengthCm: '' });
    expect(parsed.lengthCm).not.toBe(0);
    expect(parsed.lengthCm).toBeNull();
  });

  it('convertit les mesures saisies en nombres entiers', () => {
    const parsed = catchInputSchema.parse({ ...BASE, lengthCm: '47.4', weightG: '1250' });
    expect(parsed.lengthCm).toBe(47);
    expect(parsed.weightG).toBe(1250);
  });

  it('refuse les mesures absurdes', () => {
    expect(catchInputSchema.safeParse({ ...BASE, lengthCm: '0' }).success).toBe(false);
    expect(catchInputSchema.safeParse({ ...BASE, lengthCm: '401' }).success).toBe(false);
    expect(catchInputSchema.safeParse({ ...BASE, weightG: '200001' }).success).toBe(false);
  });

  it('exige une date complète avec fuseau', () => {
    for (const caughtAt of ['2026-09-01', '2026-09-01T16:30', 'hier', '']) {
      expect(catchInputSchema.safeParse({ ...BASE, caughtAt }).success).toBe(false);
    }
  });

  it('n’exige ni photo ni note', () => {
    const parsed = catchInputSchema.parse(BASE);
    expect(parsed.photoPath).toBeNull();
    expect(parsed.note).toBeNull();
    expect(parsed.released).toBe(false);
  });
});

describe('nom affiché', () => {
  it('accepte un pseudonyme ordinaire', () => {
    expect(displayNameSchema.parse('  Yann du Dossen ')).toBe('Yann du Dossen');
  });

  it('refuse trop court et trop long, comme la contrainte SQL', () => {
    expect(displayNameSchema.safeParse('a').success).toBe(false);
    expect(displayNameSchema.safeParse('a'.repeat(41)).success).toBe(false);
    expect(displayNameSchema.safeParse('a'.repeat(40)).success).toBe(true);
  });
});
