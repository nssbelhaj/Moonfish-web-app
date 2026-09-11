import { randomUUID } from 'node:crypto';
import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hacher, verifier } from '@/lib/auth/password';

/**
 * Comptes classiques, contre une vraie base.
 *
 * Ce que seul l'exécution peut montrer : que trois écritures liées se font ou
 * se défont ensemble, que la consommation d'un jeton de réinitialisation est
 * réellement atomique, et que le verrouillage compte ce qu'il prétend compter.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('les comptes dans MySQL', () => {
  let db: typeof import('@/lib/db/mysql');
  let comptes: typeof import('../comptes');

  const BASE = {
    firstName: 'Youness',
    lastName: 'Belhaj',
    birthDate: '1990-04-12',
    displayName: 'Youness',
    consentVersion: '2026-09-01',
  };

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    comptes = await import('../comptes');
    await preparerSchema(db);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    for (const table of ['password_resets', 'user_credentials', 'sessions', 'profiles', 'users']) {
      await db.execute(`delete from ${table}`);
    }
  });

  async function creer(email: string, motDePasse = 'un-mot-de-passe-honnete') {
    return comptes.creerCompteAvecMotDePasse({
      ...BASE,
      email,
      passwordHash: await hacher(motDePasse),
    });
  }

  describe('création', () => {
    it('écrit le compte, ses identifiants ET son profil', async () => {
      const r = await creer('pecheur@exemple.fr');
      expect(r.ok).toBe(true);
      if (!r.ok) return;

      const profil = await db.queryOne<{ first_name: string; last_name: string; birth_date: string }>(
        'select first_name, last_name, birth_date from profiles where user_id = ?',
        [r.userId],
      );

      expect(profil?.first_name).toBe('Youness');
      expect(profil?.last_name).toBe('Belhaj');
      expect(await comptes.aUnMotDePasse(r.userId)).toBe(true);
    });

    it('ne stocke JAMAIS le mot de passe en clair', async () => {
      const secret = 'mot-de-passe-tres-reconnaissable';
      const r = await creer('pecheur@exemple.fr', secret);
      expect(r.ok).toBe(true);

      const lignes = await db.query<{ password_hash: string }>(
        'select password_hash from user_credentials',
      );
      expect(lignes[0]?.password_hash).not.toContain(secret);
      expect(lignes[0]?.password_hash.startsWith('scrypt$')).toBe(true);
    });

    it('refuse une adresse déjà prise', async () => {
      await creer('pecheur@exemple.fr');
      const second = await creer('pecheur@exemple.fr');

      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.raison).toBe('adresse-prise');
    });

    it('ne laisse AUCUNE moitié de compte quand une écriture échoue', async () => {
      /*
        Un profil trop long fait échouer la troisième écriture, après que
        l'utilisateur et ses identifiants ont été créés. Sans nettoyage, il
        resterait un compte sans profil : connectable, incapable de publier,
        et que personne ne saurait réparer.
      */
      const r = await comptes.creerCompteAvecMotDePasse({
        ...BASE,
        displayName: 'x'.repeat(500),
        email: 'casse@exemple.fr',
        passwordHash: await hacher('un-mot-de-passe-honnete'),
      });

      expect(r.ok).toBe(false);
      expect(await db.query('select id from users')).toStrictEqual([]);
      expect(await db.query('select user_id from user_credentials')).toStrictEqual([]);
    });
  });

  describe('connexion', () => {
    it('retrouve les identifiants par l’adresse, et l’empreinte se vérifie', async () => {
      await creer('pecheur@exemple.fr', 'le-bon-mot-de-passe');
      const ids = await comptes.identifiantsDe('pecheur@exemple.fr');

      expect(ids).not.toBeNull();
      expect(await verifier('le-bon-mot-de-passe', ids!.passwordHash)).toBe(true);
      expect(await verifier('le-mauvais', ids!.passwordHash)).toBe(false);
    });

    it('rend null pour une adresse inconnue', async () => {
      expect(await comptes.identifiantsDe('personne@exemple.fr')).toBeNull();
    });

    it(`verrouille le compte au ${comptes?.ECHECS_AVANT_VERROU ?? 8}ᵉ échec, pas avant`, async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      for (let i = 1; i < comptes.ECHECS_AVANT_VERROU; i += 1) {
        await comptes.echecDeConnexion(r.userId);
        expect((await comptes.identifiantsDe('pecheur@exemple.fr'))?.lockedUntil, `échec ${i}`).toBeNull();
      }

      await comptes.echecDeConnexion(r.userId);
      expect((await comptes.identifiantsDe('pecheur@exemple.fr'))?.lockedUntil).not.toBeNull();
    });

    it('une connexion réussie efface l’ardoise', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      for (let i = 0; i <= comptes.ECHECS_AVANT_VERROU; i += 1) await comptes.echecDeConnexion(r.userId);
      await comptes.succesDeConnexion(r.userId);

      const ids = await comptes.identifiantsDe('pecheur@exemple.fr');
      expect(ids?.failedCount).toBe(0);
      expect(ids?.lockedUntil).toBeNull();
    });
  });

  describe('réinitialisation du mot de passe', () => {
    it('un jeton ne sert QU’UNE FOIS, même sous concurrence', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      const jeton = await comptes.ouvrirReinitialisation(r.userId);

      // Deux consommations simultanées : une seule doit aboutir.
      const [a, b] = await Promise.all([
        comptes.consommerReinitialisation(jeton),
        comptes.consommerReinitialisation(jeton),
      ]);

      expect([a, b].filter((x) => x !== null)).toHaveLength(1);
    });

    it('ne stocke que l’empreinte du jeton, jamais le jeton', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      const jeton = await comptes.ouvrirReinitialisation(r.userId);
      const lignes = await db.query<{ token_hash: string }>('select token_hash from password_resets');

      expect(lignes).toHaveLength(1);
      expect(lignes[0]?.token_hash).not.toBe(jeton);
      expect(lignes[0]?.token_hash).toHaveLength(64);
    });

    it('une nouvelle demande annule la précédente', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      const premier = await comptes.ouvrirReinitialisation(r.userId);
      await comptes.ouvrirReinitialisation(r.userId);

      expect(await comptes.consommerReinitialisation(premier)).toBeNull();
    });

    it('refuse un jeton inconnu', async () => {
      expect(await comptes.consommerReinitialisation('jeton-invente')).toBeNull();
    });

    it('changer de mot de passe ferme TOUTES les sessions', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      await comptes.creerSession(r.userId, new Date(Date.now() + 3_600_000));
      await comptes.creerSession(r.userId, new Date(Date.now() + 3_600_000));
      expect(await db.query('select id from sessions')).toHaveLength(2);

      await comptes.remplacerMotDePasse(r.userId, await hacher('un-tout-autre-mot-de-passe'));

      // C'est le sens du geste : on change de mot de passe quand on craint
      // que quelqu'un d'autre soit entré.
      expect(await db.query('select id from sessions')).toStrictEqual([]);
    });
  });

  describe('suppression du compte', () => {
    it('emporte identifiants, profil, sessions et demandes de réinitialisation', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      await comptes.creerSession(r.userId, new Date(Date.now() + 3_600_000));
      await comptes.ouvrirReinitialisation(r.userId);

      await db.execute('delete from users where id = ?', [r.userId]);

      for (const table of ['user_credentials', 'profiles', 'sessions', 'password_resets']) {
        expect(await db.query(`select * from ${table}`), table).toStrictEqual([]);
      }
    });
  });

  describe('sessions', () => {
    it('deux sessions n’ont jamais le même jeton', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      const jetons = await Promise.all(
        Array.from({ length: 5 }, () => comptes.creerSession(r.userId, new Date(Date.now() + 3_600_000))),
      );

      expect(new Set(jetons).size).toBe(5);
      expect(jetons.every((j) => j.length >= 40)).toBe(true);
    });

    it('la suppression par jeton ne touche que la bonne', async () => {
      const r = await creer('pecheur@exemple.fr');
      if (!r.ok) throw new Error('création impossible');

      const a = await comptes.creerSession(r.userId, new Date(Date.now() + 3_600_000));
      await comptes.creerSession(r.userId, new Date(Date.now() + 3_600_000));

      await comptes.supprimerSession(a);
      expect(await db.query('select id from sessions')).toHaveLength(1);
    });
  });

  it('l’identifiant du compte est un UUID, jamais un compteur', async () => {
    /*
      Un identifiant séquentiel dirait combien de comptes existent, et
      permettrait de deviner celui du voisin.
    */
    const r = await creer('pecheur@exemple.fr');
    if (!r.ok) throw new Error('création impossible');

    expect(r.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(r.userId).not.toBe(randomUUID());
  });
});

describeDb('le propriétaire du site', () => {
  let db2: typeof import('@/lib/db/mysql');
  let comptes2: typeof import('../comptes');

  beforeAll(async () => {
    db2 = await import('@/lib/db/mysql');
    comptes2 = await import('../comptes');
  });

  beforeEach(async () => {
    for (const table of ['password_resets', 'user_credentials', 'sessions', 'profiles', 'users']) {
      await db2.execute(`delete from ${table}`);
    }
  });

  async function inscrire(email: string, quand: string): Promise<string> {
    const r = await comptes2.creerCompteAvecMotDePasse({
      firstName: 'A',
      lastName: 'B',
      birthDate: '1990-01-01',
      displayName: 'A',
      consentVersion: '2026-09-01',
      email,
      passwordHash: await hacher('un-mot-de-passe-honnete'),
    });
    if (!r.ok) throw new Error('création impossible');

    await db2.execute('update users set created_at = ? where id = ?', [quand, r.userId]);
    return r.userId;
  }

  it('sans aucun compte, il n’y a pas de propriétaire', async () => {
    expect(await comptes2.premierCompte()).toBeNull();
  });

  it('c’est le compte le plus ANCIEN, pas le dernier connecté', async () => {
    const ancien = await inscrire('premier@exemple.fr', '2026-09-01 10:00:00.000');
    await inscrire('second@exemple.fr', '2026-09-02 10:00:00.000');
    await inscrire('troisieme@exemple.fr', '2026-09-03 10:00:00.000');

    expect(await comptes2.premierCompte()).toBe(ancien);
  });

  it('la réponse est STABLE quand deux comptes partagent la milliseconde', async () => {
    /*
      Sans départage, deux comptes créés dans la même milliseconde se
      voleraient la place d'une requête à l'autre : le propriétaire
      changerait au rechargement de la page.
    */
    const meme = '2026-09-01 10:00:00.000';
    await inscrire('a@exemple.fr', meme);
    await inscrire('b@exemple.fr', meme);

    const lectures = await Promise.all([
      comptes2.premierCompte(),
      comptes2.premierCompte(),
      comptes2.premierCompte(),
    ]);

    expect(new Set(lectures).size).toBe(1);
  });

  it('supprimer le premier compte fait passer la main au suivant', async () => {
    const premier = await inscrire('premier@exemple.fr', '2026-09-01 10:00:00.000');
    const second = await inscrire('second@exemple.fr', '2026-09-02 10:00:00.000');

    await db2.execute('delete from users where id = ?', [premier]);
    expect(await comptes2.premierCompte()).toBe(second);
  });
});

describeDb('la lecture directe d’une session', () => {
  let db3: typeof import('@/lib/db/mysql');
  let comptes3: typeof import('../comptes');

  beforeAll(async () => {
    db3 = await import('@/lib/db/mysql');
    comptes3 = await import('../comptes');
  });

  beforeEach(async () => {
    for (const table of ['sessions', 'user_credentials', 'profiles', 'users']) {
      await db3.execute(`delete from ${table}`);
    }
  });

  async function compte(): Promise<string> {
    const r = await comptes3.creerCompteAvecMotDePasse({
      firstName: 'A', lastName: 'B', birthDate: '1990-01-01', displayName: 'A',
      consentVersion: '2026-09-01', email: 'session@exemple.fr',
      passwordHash: await hacher('un-mot-de-passe-honnete'),
    });
    if (!r.ok) throw new Error('création impossible');
    return r.userId;
  }

  it('rend l’utilisateur d’une session valide', async () => {
    /*
      Ce chemin existe parce qu'Auth.js refuse de lire une session quand
      AUTH_URL manque en production : il lève `UntrustedHost` à CHAQUE
      requête, et le site affiche un visiteur perpétuellement déconnecté
      sans qu'aucun message n'apparaisse.
    */
    const userId = await compte();
    const jeton = await comptes3.creerSession(userId, new Date(Date.now() + 3_600_000));

    const trouve = await comptes3.utilisateurDeSession(jeton);
    expect(trouve?.id).toBe(userId);
    expect(trouve?.email).toBe('session@exemple.fr');
  });

  it('refuse un jeton EXPIRÉ', async () => {
    // La condition est dans la requête, pas chez l'appelant : une session
    // périmée ne doit jamais remonter, même si quelqu'un oublie de vérifier.
    const userId = await compte();
    const jeton = await comptes3.creerSession(userId, new Date(Date.now() - 1_000));

    expect(await comptes3.utilisateurDeSession(jeton)).toBeNull();
  });

  it('refuse un jeton inventé', async () => {
    await compte();
    expect(await comptes3.utilisateurDeSession('jeton-invente')).toBeNull();
  });

  it('la session tombe avec le compte', async () => {
    const userId = await compte();
    const jeton = await comptes3.creerSession(userId, new Date(Date.now() + 3_600_000));

    await db3.execute('delete from users where id = ?', [userId]);
    expect(await comptes3.utilisateurDeSession(jeton)).toBeNull();
  });
});
