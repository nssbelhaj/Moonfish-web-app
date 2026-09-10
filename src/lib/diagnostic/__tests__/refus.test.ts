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

const REFUS = readFileSync('src/lib/diagnostic/refus.ts', 'utf8');

/** Les deux routes d'exploitation doivent refuser de la même façon. */
const ROUTES = ['src/app/api/diagnostic/route.ts', 'src/app/api/entretien/route.ts'];

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
    const motif = /\/(.+?)\/i\.test\(/.exec(REFUS)?.[1];
    expect(motif, 'aucune détection de texte d’exemple').toBeDefined();

    // La source lue sur disque porte déjà les échappements du littéral.
    const detecte = new RegExp(motif!, 'i');
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
    const detecte = new RegExp(/\/(.+?)\/i\.test\(/.exec(REFUS)![1]!, 'i');

    // Des secrets plausibles : sortie de `openssl rand -base64 32`.
    for (const vrai of [
      'Bearer 7Kq2mXpL9vRtY4wZ8bN3cF6hJ1sD5gA0eU2iO7yT4xM=',
      'Bearer aGVsbG8td29ybGQtc2VjcmV0LXZhbHVlLTEyMzQ1Njc4',
    ]) {
      expect(detecte.test(vrai), vrai).toBe(false);
    }
  });

  it.each(ROUTES)('%s l’utilise, plutôt que de refuser à sa façon', (route) => {
    /*
      Les deux routes portaient le même « Non autorisé. » nu, copié d'un
      fichier à l'autre. Un message partagé ne se corrige qu'une fois.
    */
    const source = readFileSync(route, 'utf8');
    expect(source).toContain('refusExplique(');
    expect(source).not.toContain("message: 'Non autorisé.' }");
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
    // Le helper ne reçoit que l'en-tête reçu : il ne PEUT pas lire le secret.
    expect(REFUS).not.toContain('process.env');
  });
});
