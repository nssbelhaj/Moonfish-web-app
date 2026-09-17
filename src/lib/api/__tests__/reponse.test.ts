import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CORPS_ILLISIBLE,
  COMPTES_FERMES,
  INTROUVABLE,
  NON_AUTHENTIFIE,
  VERSION_API,
  corpsJson,
  refus,
  refusDeContribution,
  saisieInvalide,
  succes,
  tropDeDemandes,
} from '@/lib/api/reponse';

/**
 * L'enveloppe des réponses.
 *
 * Elle a l'air anodine, et c'est elle qui décide si l'application sait quoi
 * faire d'un échec ou se contente de l'afficher en vrac.
 */

describe('toute réponse annonce son type et sa version', () => {
  const reponses = [
    ['succès', succes({ a: 1 })],
    ['refus générique', refus(400, 'saisie-invalide', 'Non.')],
    ['non authentifié', NON_AUTHENTIFIE()],
    ['comptes fermés', COMPTES_FERMES()],
    ['introuvable', INTROUVABLE('Le spot « x »')],
    ['corps illisible', CORPS_ILLISIBLE()],
    ['trop de demandes', tropDeDemandes('Trop.', Date.now() + 60_000)],
  ] as const;

  it.each(reponses)('%s porte le charset utf-8', (_nom, reponse) => {
    /*
      `NextResponse.json()` pose « application/json » SANS jeu de caractères.
      Les messages de ce projet portent des accents, des apostrophes
      typographiques et des espaces insécables : un client qui suppose du
      latin-1 faute de déclaration affiche du charabia. Le cahier des charges
      de l'API l'exige explicitement — on ne s'en remet pas à un défaut.
    */
    expect(reponse.headers.get('content-type')).toBe('application/json; charset=utf-8');
  });

  it.each(reponses)('%s porte le numéro de version du contrat', (_nom, reponse) => {
    expect(reponse.headers.get('x-luna-api')).toBe(String(VERSION_API));
  });
});

describe('la forme de l’enveloppe', () => {
  it('range les données sous « donnees » derrière un « ok » vrai', async () => {
    const corps = await succes({ spots: [] }).json();
    expect(corps).toStrictEqual({ ok: true, donnees: { spots: [] } });
  });

  it('range un refus sous un « ok » faux, avec un code lisible par la machine', async () => {
    const corps = await NON_AUTHENTIFIE().json();

    expect(corps.ok).toBe(false);
    expect(corps.code).toBe('non-authentifie');
    // L'application affiche `message` ; elle réagit sur `code`. Traduire un
    // message pour décider quoi faire reviendrait à comparer des phrases.
    expect(typeof corps.message).toBe('string');
  });

  it('nomme la cause ET le remède dans chaque message', async () => {
    for (const reponse of [NON_AUTHENTIFIE(), COMPTES_FERMES(), CORPS_ILLISIBLE()]) {
      const { message } = await reponse.json();
      expect(message.length, message).toBeGreaterThan(40);
      expect(message, `message sans phrase de recours : ${message}`).toMatch(/[.!]/);
    }
  });

  it('transporte les accents sans les abîmer', async () => {
    const message = 'Prévision indisponible pour ce créneau — réessayez plus tard.';
    const corps = await refus(503, 'indisponible', message).json();
    expect(corps.message).toBe(message);
  });
});

describe('le refus pour excès de demandes', () => {
  it('porte « Retry-After » en secondes, pas seulement dans la phrase', async () => {
    const reponse = tropDeDemandes('Trop de tentatives.', Date.now() + 120_000);

    expect(reponse.status).toBe(429);
    // C'est cet en-tête qui permet à l'application de se taire d'elle-même au
    // lieu de reboucler et de faire clignoter un message d'erreur.
    const attente = Number(reponse.headers.get('retry-after'));
    expect(attente).toBeGreaterThan(110);
    expect(attente).toBeLessThanOrEqual(120);
  });

  it('n’annonce jamais « 0 seconde » sur une échéance déjà passée', () => {
    const reponse = tropDeDemandes('Trop.', Date.now() - 5_000);
    expect(Number(reponse.headers.get('retry-after'))).toBeGreaterThanOrEqual(1);
  });
});

describe('la saisie invalide désigne le champ fautif', () => {
  const schema = z.object({
    email: z.string().email('Cette adresse e-mail n’est pas valide.'),
    rating: z.number().int().min(1, 'La note va de 1 à 5.'),
  });

  it('reprend le message du schéma et le nom du champ', async () => {
    const analyse = schema.safeParse({ email: 'pas-une-adresse', rating: 3 });
    expect(analyse.success).toBe(false);

    const corps = await saisieInvalide(analyse.error!).json();

    expect(corps.code).toBe('saisie-invalide');
    expect(corps.message).toBe('Cette adresse e-mail n’est pas valide.');
    expect(corps.champ).toBe('email');
  });

  it('n’en signale qu’un à la fois : un écran de téléphone ne lit pas une liste', async () => {
    const analyse = schema.safeParse({ email: 'x', rating: 0 });
    const corps = await saisieInvalide(analyse.error!).json();

    expect(Object.keys(corps).sort()).toStrictEqual(['champ', 'code', 'message', 'ok']);
  });
});

describe('l’échec d’un dépôt devient un statut qui veut dire quelque chose', () => {
  it('sépare ce qui se réessaie de ce qui se corrige', () => {
    expect(refusDeContribution({ reason: 'invalid', message: 'x' }).status).toBe(422);
    expect(refusDeContribution({ reason: 'storage-error', message: 'x' }).status).toBe(503);
    expect(refusDeContribution({ reason: 'not-authenticated', message: 'x' }).status).toBe(401);
    expect(refusDeContribution({ reason: 'not-available', message: 'x' }).status).toBe(503);
  });

  it('reprend le message du dépôt, sans le réécrire', async () => {
    const message = 'Le commentaire dépasse 1 200 caractères.';
    const corps = await refusDeContribution({ reason: 'invalid', message }).json();
    expect(corps.message).toBe(message);
  });
});

describe('un corps de requête illisible ne fait pas tomber la route', () => {
  it('rend null plutôt que de lever', async () => {
    const tronque = new Request('https://lunamarea.fr/api/v1/auth/connexion', {
      method: 'POST',
      body: '{"email": "a@b.c"',
      headers: { 'content-type': 'application/json' },
    });

    // Une coupure de réseau au milieu d'un envoi depuis un téléphone est la
    // cause la plus banale de ce cas : il est traité, pas laissé lever une
    // 500 qui ferait croire à une panne du serveur.
    expect(await corpsJson(tronque)).toBeNull();
  });

  it('rend null sur un corps vide', async () => {
    const vide = new Request('https://lunamarea.fr/api/v1/auth/connexion', { method: 'POST' });
    expect(await corpsJson(vide)).toBeNull();
  });
});
