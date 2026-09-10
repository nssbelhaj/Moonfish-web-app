import { describe, expect, it } from 'vitest';

import { AGE_MINIMUM, ageA, connexionSchema, inscriptionSchema } from '../schemas-compte';

const AUJOURDHUI = new Date(Date.UTC(2026, 8, 10)); // 10 septembre 2026

const VALIDE = {
  email: 'Pecheur@Exemple.FR',
  password: 'un-mot-de-passe-honnete',
  passwordConfirm: 'un-mot-de-passe-honnete',
  firstName: '  Youness ',
  lastName: 'Belhaj',
  birthDate: '1990-04-12',
  consentement: 'oui',
};

describe('l’âge révolu', () => {
  it.each([
    ['la veille de l’anniversaire', '2011-09-11', 14],
    ['le jour de l’anniversaire', '2011-09-10', 15],
    ['le lendemain', '2011-09-09', 15],
    ['mois suivant', '2011-10-01', 14],
  ])('%s → %s ans', (_cas, naissance, attendu) => {
    expect(ageA(naissance, AUJOURDHUI)).toBe(attendu);
  });

  it('bascule le JOUR de l’anniversaire, pas la veille ni le lendemain', () => {
    /*
      Un décalage d'un jour ici refuse l'inscription à quelqu'un qui a
      exactement l'âge requis, le jour de son anniversaire — et le message
      lui dira qu'il est trop jeune.
    */
    expect(ageA('2011-09-10', AUJOURDHUI)).toBe(AGE_MINIMUM);
    expect(ageA('2011-09-11', AUJOURDHUI)).toBe(AGE_MINIMUM - 1);
  });
});

describe('l’inscription', () => {
  it('accepte une saisie ordinaire, et normalise ce qui doit l’être', () => {
    const r = inscriptionSchema.safeParse(VALIDE);
    expect(r.success).toBe(true);
    if (!r.success) return;

    expect(r.data.email).toBe('pecheur@exemple.fr'); // minuscules, rogné
    expect(r.data.firstName).toBe('Youness'); // rogné
  });

  it('ne touche JAMAIS au mot de passe', () => {
    /*
      Un espace de début ou de fin fait partie du mot de passe. Le rogner à
      l'inscription et pas à la connexion — ou l'inverse — refuserait une
      saisie pourtant identique, sans que personne ne comprenne.
    */
    const avecEspaces = { ...VALIDE, password: '  secret-avec-espaces  ', passwordConfirm: '  secret-avec-espaces  ' };
    const r = inscriptionSchema.safeParse(avecEspaces);

    expect(r.success).toBe(true);
    if (r.success) expect(r.data.password).toBe('  secret-avec-espaces  ');
  });

  it.each([
    ['une adresse invalide', { email: 'pas-une-adresse' }],
    ['un mot de passe trop court', { password: 'court', passwordConfirm: 'court' }],
    ['deux mots de passe différents', { passwordConfirm: 'autre-chose-encore' }],
    ['un prénom vide', { firstName: '' }],
    ['une date qui n’existe pas', { birthDate: '2001-02-30' }],
    ['un consentement absent', { consentement: 'non' }],
  ])('refuse %s', (_cas, remplacement) => {
    expect(inscriptionSchema.safeParse({ ...VALIDE, ...remplacement }).success).toBe(false);
  });

  it(`refuse les moins de ${AGE_MINIMUM} ans, et le dit sur le bon champ`, () => {
    const trop_jeune = new Date().getUTCFullYear() - AGE_MINIMUM + 1;
    const r = inscriptionSchema.safeParse({ ...VALIDE, birthDate: `${trop_jeune}-01-01` });

    expect(r.success).toBe(false);
    if (r.success) return;
    expect(r.error.issues[0]?.path).toStrictEqual(['birthDate']);
    expect(r.error.issues[0]?.message).toContain(String(AGE_MINIMUM));
  });

  it('refuse un âge impossible : une faute de frappe sur l’année', () => {
    expect(inscriptionSchema.safeParse({ ...VALIDE, birthDate: '1090-04-12' }).success).toBe(false);
  });
});

describe('idempotence — le schéma est appliqué deux fois sur le trajet', () => {
  it('accepte sa propre sortie', () => {
    const premier = inscriptionSchema.parse(VALIDE);
    const second = inscriptionSchema.parse(premier);

    expect(second).toStrictEqual(premier);
  });

  it('reste stable au troisième passage', () => {
    const a = inscriptionSchema.parse(VALIDE);
    const b = inscriptionSchema.parse(a);
    expect(inscriptionSchema.parse(b)).toStrictEqual(a);
  });
});

describe('la connexion', () => {
  it('normalise l’adresse comme l’inscription : sinon on ne se reconnaît pas', () => {
    const inscrit = inscriptionSchema.parse(VALIDE);
    const connecte = connexionSchema.parse({ email: '  PECHEUR@exemple.fr ', password: 'x' });

    expect(connecte.email).toBe(inscrit.email);
  });

  it('n’impose aucune longueur minimale : c’est le refus qui tranche, pas le formulaire', () => {
    // Exiger 10 caractères à la connexion révélerait la règle appliquée à
    // l'inscription, et gênerait un ancien compte au mot de passe plus court.
    expect(connexionSchema.safeParse({ email: 'a@b.fr', password: 'court' }).success).toBe(true);
  });
});
