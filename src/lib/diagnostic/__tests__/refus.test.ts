import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/*
  ────────────────────────────────────────────────────────────────────────────
   Un refus qui n'explique rien fait perdre autant de temps que la panne.

   `/api/diagnostic` est l'outil qu'on vient consulter quand plus rien ne
   marche. Il répondait « Non autorisé. » — exact, et parfaitement inutile :
   ni l'en-tête attendu, ni l'endroit où trouver la valeur. Deux allers-retours
   ont été perdus dessus, à recopier le texte d'exemple au lieu du secret.

   Ces tests lisent la source plutôt que d'instancier une requête Next : ce
   qu'ils protègent est le CONTENU du refus, pas sa mécanique HTTP.
  ────────────────────────────────────────────────────────────────────────────
*/

const SOURCE = readFileSync('src/app/api/diagnostic/route.ts', 'utf8');
const REFUS = SOURCE.slice(SOURCE.indexOf('if (secret &&'), SOURCE.indexOf('const points ='));

describe('le refus du diagnostic', () => {
  it('dit quel en-tête ajouter', () => {
    expect(REFUS).toContain('Authorization: Bearer');
  });

  it('dit OÙ trouver la valeur, pas seulement qu’il en faut une', () => {
    expect(REFUS).toContain('hPanel');
    expect(REFUS).toContain('CRON_SECRET');
  });

  it('reconnaît un texte d’exemple recopié tel quel', () => {
    /*
      L'erreur observée deux fois : coller « Bearer COLLEZ_ICI_VOTRE_CRON_SECRET ».
      Le refus est alors identique à celui d'un mauvais secret, et rien ne
      suggère de regarder l'en-tête qu'on vient d'envoyer.
    */
    const motif = /\/(.+?)\/i\.test\(entete\)/.exec(REFUS)?.[1];
    expect(motif, 'aucune détection de texte d’exemple').toBeDefined();

    const detecte = new RegExp(motif!.replace(/\\\\/g, '\\'), 'i');
    for (const exemple of [
      'Bearer COLLEZ_ICI_VOTRE_CRON_SECRET',
      'Bearer LA_VALEUR_DE_CRON_SECRET',
      'Bearer <votre-secret>',
      'Bearer XXXX',
    ]) {
      expect(detecte.test(exemple), exemple).toBe(true);
    }
  });

  it('ne prend PAS un vrai secret pour un exemple', () => {
    const motif = /\/(.+?)\/i\.test\(entete\)/.exec(REFUS)![1]!;
    const detecte = new RegExp(motif.replace(/\\\\/g, '\\'), 'i');

    // Des secrets plausibles : sortie de `openssl rand -base64 32`.
    for (const vrai of [
      'Bearer 7Kq2mXpL9vRtY4wZ8bN3cF6hJ1sD5gA0eU2iO7yT4xM=',
      'Bearer aGVsbG8td29ybGQtc2VjcmV0LXZhbHVlLTEyMzQ1Njc4',
    ]) {
      expect(detecte.test(vrai), vrai).toBe(false);
    }
  });

  it('ne divulgue jamais le secret attendu — seulement comment le présenter', () => {
    /*
      Le contrôle porte sur le CORPS de la réponse, pas sur le bloc entier :
      la ligne de comparaison contient légitimement `${secret}` — c'est elle
      qui vérifie l'en-tête. Une première version de ce test confondait les
      deux et refusait la comparaison elle-même.
    */
    const corps = REFUS.slice(REFUS.indexOf('return NextResponse.json('));

    expect(corps).not.toContain('${secret}');
    expect(corps).not.toContain('process.env.CRON_SECRET');
  });
});
