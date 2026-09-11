import { describe, expect, it } from 'vitest';

import { partiesGabarit, ressembleAUnGabarit } from '../gabarits';

/*
  ────────────────────────────────────────────────────────────────────────────
   Trois fois de suite, un gabarit de MA documentation a été posé comme valeur
   réelle. La troisième a tout cassé sans que rien ne nomme la cause :
   l'identifiant MySQL était resté le mot « UTILISATEUR », et chaque panne en
   aval se plaignait d'autre chose.

   La faute est du côté de la documentation, pas de qui la suit : un gabarit
   qui ressemble à une valeur SERA collé tel quel.

   Ce détecteur a deux devoirs, et le second compte autant que le premier :
   attraper les gabarits, et ne JAMAIS accuser une vraie valeur. Un contrôle
   qui crie à tort cesse d'être lu.
  ────────────────────────────────────────────────────────────────────────────
*/

describe('reconnaître un texte d’exemple', () => {
  it.each([
    'UTILISATEUR',
    'MOTDEPASSE',
    'MOT_DE_PASSE',
    'VOTRE_SECRET',
    'COLLEZ_ICI_VOTRE_CRON_SECRET',
    'LA_VALEUR_DE_CRON_SECRET',
    '<votre-secret>',
    'votre-mot-de-passe',
    'changeme',
    'your_api_key',
    'xxxx',
    'password',
  ])('« %s » est un gabarit', (valeur) => {
    expect(ressembleAUnGabarit(valeur)).toBe(true);
  });

  it.each([
    ['une sortie d’openssl', '7Kq2mXpL9vRtY4wZ8bN3cF6hJ1sD5gA0eU2iO7yT4xM='],
    ['un identifiant Hostinger', 'u969082232_lunamarea'],
    ['un mot de passe ordinaire', 'MonMotDePasse2026'],
    ['un secret que j’ai suggéré', 'LunaMarea-Entretien-8f3k2p9x7m4q'],
    ['une clé Stormglass', 'e32e7afe-431b-11f1-8e81-0242ac120004'],
    ['une adresse', 'contact@lunamarea.fr'],
    ['un hôte', 'smtp.hostinger.com'],
    ['une valeur courte', 'ab'],
    ['rien', undefined],
  ])('%s n’est PAS un gabarit', (_cas, valeur) => {
    expect(ressembleAUnGabarit(valeur)).toBe(false);
  });
});

describe('les parties d’une URL', () => {
  it('nomme exactement ce qui est resté au gabarit', () => {
    expect(
      partiesGabarit('mysql://UTILISATEUR:MOTDEPASSE@localhost:3306/u969082232_moonfish'),
    ).toStrictEqual(['l’identifiant', 'le mot de passe']);
  });

  it('ne nomme QUE la partie fautive', () => {
    expect(
      partiesGabarit('mysql://u969082232_luna:MOTDEPASSE@localhost:3306/u969082232_moonfish'),
    ).toStrictEqual(['le mot de passe']);
  });

  it('ne rend jamais le CONTENU, seulement le nom de la partie', () => {
    /*
      Cette sortie est faite pour être recopiée dans un message. Nommer la
      partie suffit à corriger ; recopier sa valeur publierait un mot de
      passe — fût-il faux aujourd'hui.
    */
    const rendu = JSON.stringify(
      partiesGabarit('mysql://UTILISATEUR:MotDePasseTresReconnaissable@localhost:3306/base'),
    );

    expect(rendu).not.toContain('MotDePasseTresReconnaissable');
    expect(rendu).not.toContain('UTILISATEUR');
  });

  it('se tait sur une URL entièrement réelle', () => {
    expect(
      partiesGabarit('mysql://u969082232_luna:Xk9!mQ2p@localhost:3306/u969082232_moonfish'),
    ).toStrictEqual([]);
  });

  it('se tait sur une URL illisible : ce n’est pas son problème', () => {
    expect(partiesGabarit('pas-une-url')).toStrictEqual([]);
    expect(partiesGabarit(undefined)).toStrictEqual([]);
  });
});
