import { preparerSchema } from '@/lib/db/__tests__/schema-de-test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Le jeton porteur, contre une VRAIE base
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ce que seule l'exécution peut montrer, et qu'aucun test hermétique ne
 * prouvera jamais :
 *
 *  - qu'une déconnexion coupe l'accès à la requête SUIVANTE. C'est LA
 *    propriété qui a fait choisir des sessions en base plutôt qu'un jeton
 *    signé, et l'API n'a pas le droit de la reprendre. Un jeton auto-porté
 *    resterait valable jusqu'à son expiration, y compris après un
 *    « supprimez mes données » ;
 *  - qu'un jeton inventé n'ouvre rien ;
 *  - que le jeton d'une personne ne donne accès qu'à ses affaires.
 *
 * Sans `DATABASE_URL`, ces tests sont IGNORÉS plutôt que rouges : un clone du
 * dépôt doit pouvoir lancer la suite sans installer de serveur. Ils tournent
 * pour de vrai en intégration continue, contre MySQL 8.
 */
const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

describeDb('l’API v1 authentifiée', () => {
  let db: typeof import('@/lib/db/mysql');
  let inscription: typeof import('../auth/inscription/route');
  let connexion: typeof import('../auth/connexion/route');
  let session: typeof import('../auth/session/route');
  let compte: typeof import('../compte/route');
  let favoris: typeof import('../compte/favoris/[slug]/route');
  let avis: typeof import('../compte/avis/route');
  let appareils: typeof import('../compte/appareils/route');
  let contributionsPubliques: typeof import('../spots/[slug]/contributions/route');

  beforeAll(async () => {
    db = await import('@/lib/db/mysql');
    inscription = await import('../auth/inscription/route');
    connexion = await import('../auth/connexion/route');
    session = await import('../auth/session/route');
    compte = await import('../compte/route');
    favoris = await import('../compte/favoris/[slug]/route');
    avis = await import('../compte/avis/route');
    appareils = await import('../compte/appareils/route');
    contributionsPubliques = await import('../spots/[slug]/contributions/route');
    await preparerSchema(db);
  });

  afterAll(async () => {
    await db.closePool();
  });

  beforeEach(async () => {
    for (const table of [
      'push_devices',
      'spot_reviews',
      'catches',
      'favorites',
      'outings',
      'password_resets',
      'user_credentials',
      'sessions',
      'profiles',
      'users',
      // Les compteurs sont vidés aussi : cinq inscriptions par heure et par
      // adresse suffisent à un humain, pas à une suite de tests qui en crée
      // une par cas.
      'rate_limits',
    ]) {
      await db.execute(`delete from ${table}`);
    }
  });

  /* ── Outillage ──────────────────────────────────────────────────────── */

  const INSCRIPTION = {
    email: 'camille@exemple.fr',
    password: 'un-mot-de-passe-honnete',
    passwordConfirm: 'un-mot-de-passe-honnete',
    firstName: 'Camille',
    lastName: 'Renard',
    birthDate: '1990-04-12',
    consentement: 'oui',
  };

  function requeteJson(corps: unknown, jeton?: string, methode = 'POST'): Request {
    return new Request('https://lunamarea.fr/api/v1/x', {
      method: methode,
      body: JSON.stringify(corps),
      headers: {
        'content-type': 'application/json',
        ...(jeton === undefined ? {} : { authorization: `Bearer ${jeton}` }),
      },
    });
  }

  function requeteNue(jeton?: string, methode = 'GET'): Request {
    return new Request('https://lunamarea.fr/api/v1/x', {
      method: methode,
      headers: jeton === undefined ? {} : { authorization: `Bearer ${jeton}` },
    });
  }

  async function corps(reponse: Response) {
    return (await reponse.json()) as {
      ok: boolean;
      code?: string;
      message?: string;
      champ?: string;
    };
  }

  /** Crée un compte et rend son jeton. */
  async function compteOuvert(surcharge: Partial<typeof INSCRIPTION> = {}): Promise<string> {
    const reponse = await inscription.POST(requeteJson({ ...INSCRIPTION, ...surcharge }));
    const lu = (await reponse.json()) as { ok: boolean; donnees: { jeton: string } };

    expect(reponse.status, JSON.stringify(lu)).toBe(200);
    return lu.donnees.jeton;
  }

  /* ── Inscription ────────────────────────────────────────────────────── */

  describe('inscription', () => {
    it('ouvre un compte et rend un jeton utilisable tout de suite', async () => {
      const jeton = await compteOuvert();

      expect(jeton.length).toBeGreaterThan(20);

      const lu = (await (await compte.GET(requeteNue(jeton))).json()) as {
        ok: boolean;
        donnees: { profile: { displayName: string } | null; account: { email: string | null } };
      };

      expect(lu.ok).toBe(true);
      // Le nom affiché part du PRÉNOM seul : publier « Prénom NOM » donnerait
      // le nom de famille de quelqu'un qui ne l'a jamais demandé.
      expect(lu.donnees.profile?.displayName).toBe('Camille');
      expect(lu.donnees.account.email).toBe('camille@exemple.fr');
    });

    it('applique le seuil des quinze ans, comme le formulaire du site', async () => {
      const cetteAnnee = new Date().getUTCFullYear();
      const reponse = await inscription.POST(
        requeteJson({ ...INSCRIPTION, birthDate: `${cetteAnnee - 12}-04-12` }),
      );

      expect(reponse.status).toBe(422);
      const lu = await corps(reponse);
      expect(lu.champ).toBe('birthDate');
      expect(lu.message).toContain('15 ans');
    });

    it('exige le consentement', async () => {
      const { consentement: _, ...sansConsentement } = INSCRIPTION;
      const reponse = await inscription.POST(requeteJson(sansConsentement));

      expect(reponse.status).toBe(422);
      expect((await corps(reponse)).message).toContain('politique de confidentialité');
    });

    it('refuse une adresse déjà prise, et le DIT', async () => {
      await compteOuvert();
      const reponse = await inscription.POST(requeteJson(INSCRIPTION));

      // Contrairement à la connexion, qui ne dit jamais si une adresse existe :
      // ici, se taire laisserait la personne devant un refus incompréhensible.
      expect(reponse.status).toBe(409);
      const lu = await corps(reponse);
      expect(lu.champ).toBe('email');
      expect(lu.message).toContain('existe déjà');
    });

    it('n’écrit aucun compte quand la saisie est refusée', async () => {
      await inscription.POST(requeteJson({ ...INSCRIPTION, email: 'pas-une-adresse' }));

      const lignes = await db.query<{ n: number }>('select count(*) as n from users');
      expect(Number(lignes[0]!.n)).toBe(0);
    });
  });

  /* ── Connexion ──────────────────────────────────────────────────────── */

  describe('connexion', () => {
    it('rend un jeton, DIFFÉRENT de celui de l’inscription', async () => {
      const premier = await compteOuvert();

      const reponse = await connexion.POST(
        requeteJson({ email: INSCRIPTION.email, password: INSCRIPTION.password }),
      );
      const lu = (await reponse.json()) as { donnees: { jeton: string } };

      expect(reponse.status).toBe(200);
      // Deux appareils, deux sessions : déconnecter le téléphone ne doit pas
      // déconnecter le navigateur.
      expect(lu.donnees.jeton).not.toBe(premier);

      // Et les deux marchent.
      expect((await compte.GET(requeteNue(premier))).status).toBe(200);
      expect((await compte.GET(requeteNue(lu.donnees.jeton))).status).toBe(200);
    });

    it('répond EXACTEMENT pareil à une adresse inconnue et à un mot de passe faux', async () => {
      await compteOuvert();

      const adresseInconnue = await corps(
        await connexion.POST(requeteJson({ email: 'personne@exemple.fr', password: 'x'.repeat(12) })),
      );
      const mauvaisMotDePasse = await corps(
        await connexion.POST(requeteJson({ email: INSCRIPTION.email, password: 'x'.repeat(12) })),
      );

      /*
        Les distinguer transformerait la route en outil de vérification
        d'adresses : n'importe qui saurait, en quelques milliers d'appels, qui
        a un compte ici.
      */
      expect(adresseInconnue).toStrictEqual(mauvaisMotDePasse);
      expect(adresseInconnue.code).toBe('non-authentifie');
    });

    it('n’ouvre aucune session sur un mot de passe faux', async () => {
      await compteOuvert();
      await connexion.POST(requeteJson({ email: INSCRIPTION.email, password: 'x'.repeat(12) }));

      const lignes = await db.query<{ n: number }>('select count(*) as n from sessions');
      // Une seule : celle de l'inscription.
      expect(Number(lignes[0]!.n)).toBe(1);
    });
  });

  /* ── Révocation : LA propriété ──────────────────────────────────────── */

  describe('la déconnexion prend effet immédiatement', () => {
    it('rend le jeton inutilisable dès la requête suivante', async () => {
      const jeton = await compteOuvert();
      expect((await compte.GET(requeteNue(jeton))).status).toBe(200);

      const fermeture = await session.DELETE(requeteNue(jeton, 'DELETE'));
      expect(fermeture.status).toBe(200);

      /*
        ═══ C'est ici que se joue le choix d'architecture ═══
        Un jeton signé serait resté valable jusqu'à son expiration — trente
        jours — y compris après une suppression de compte. La ligne, elle, a
        disparu de la table : le `select` de la requête suivante ne trouve
        rien.
      */
      const apres = await compte.GET(requeteNue(jeton));
      expect(apres.status).toBe(401);
      expect((await corps(apres)).code).toBe('non-authentifie');
    });

    it('ne ferme QUE la session présentée', async () => {
      const telephone = await compteOuvert();
      const navigateur = (
        (await (
          await connexion.POST(requeteJson({ email: INSCRIPTION.email, password: INSCRIPTION.password }))
        ).json()) as { donnees: { jeton: string } }
      ).donnees.jeton;

      await session.DELETE(requeteNue(telephone, 'DELETE'));

      expect((await compte.GET(requeteNue(telephone))).status).toBe(401);
      expect((await compte.GET(requeteNue(navigateur))).status).toBe(200);
    });

    it('aboutit même sans jeton valide : se déconnecter doit toujours marcher', async () => {
      // Répondre 401 à qui présente un jeton déjà expiré laisserait
      // l'application devant un échec qu'elle ne peut pas résoudre.
      expect((await session.DELETE(requeteNue('jeton-inexistant', 'DELETE'))).status).toBe(200);
      expect((await session.DELETE(requeteNue(undefined, 'DELETE'))).status).toBe(200);
    });
  });

  /* ── Jetons invalides ───────────────────────────────────────────────── */

  describe('un jeton qui n’en est pas un n’ouvre rien', () => {
    it.each([
      ['inventé de toutes pièces', 'jeton-completement-invente-0123456789'],
      ['vide', ''],
      ['une injection SQL', "' or '1'='1"],
    ])('refuse un jeton %s', async (_libelle, jeton) => {
      const reponse = await compte.GET(requeteNue(jeton));
      expect(reponse.status).toBe(401);
    });

    it('refuse une session EXPIRÉE, même présente en base', async () => {
      const jeton = await compteOuvert();

      // `expires > now(3)` est dans la requête du dépôt, pas dans le code
      // appelant : une session périmée ne remonte jamais, même si l'appelant
      // oublie de vérifier.
      await db.execute('update sessions set expires = ? where sessionToken = ?', [
        '2020-01-01 00:00:00.000',
        jeton,
      ]);

      expect((await compte.GET(requeteNue(jeton))).status).toBe(401);
    });
  });

  /* ── Favoris ────────────────────────────────────────────────────────── */

  describe('favoris', () => {
    const parametres = (slug: string) => ({ params: Promise.resolve({ slug }) });

    it('s’ajoute, se relit, et se retire', async () => {
      const jeton = await compteOuvert();

      expect((await favoris.PUT(requeteNue(jeton, 'PUT'), parametres('pen-hat'))).status).toBe(200);

      const avant = (await (await compte.GET(requeteNue(jeton))).json()) as {
        donnees: { favorites: { spotSlug: string }[] };
      };
      expect(avant.donnees.favorites.map((f) => f.spotSlug)).toContain('pen-hat');

      expect(
        (await favoris.DELETE(requeteNue(jeton, 'DELETE'), parametres('pen-hat'))).status,
      ).toBe(200);

      const apres = (await (await compte.GET(requeteNue(jeton))).json()) as {
        donnees: { favorites: { spotSlug: string }[] };
      };
      expect(apres.donnees.favorites).toHaveLength(0);
    });

    it('est idempotent : l’ajouter deux fois ne double rien et ne se plaint pas', async () => {
      const jeton = await compteOuvert();

      // C'est ce qui permet à l'application de rejouer sa file d'actions en
      // attente au retour du réseau, sans se souvenir de ce qui est passé.
      await favoris.PUT(requeteNue(jeton, 'PUT'), parametres('pen-hat'));
      expect((await favoris.PUT(requeteNue(jeton, 'PUT'), parametres('pen-hat'))).status).toBe(200);

      const lu = (await (await compte.GET(requeteNue(jeton))).json()) as {
        donnees: { favorites: unknown[] };
      };
      expect(lu.donnees.favorites).toHaveLength(1);
    });

    it('refuse un spot qui n’existe pas', async () => {
      const jeton = await compteOuvert();
      const reponse = await favoris.PUT(requeteNue(jeton, 'PUT'), parametres('spot-imaginaire'));

      expect(reponse.status).toBe(404);
    });

    it('n’est visible que de son propriétaire', async () => {
      const camille = await compteOuvert();
      const sacha = await compteOuvert({ email: 'sacha@exemple.fr', firstName: 'Sacha' });

      await favoris.PUT(requeteNue(camille, 'PUT'), parametres('pen-hat'));

      const vuParSacha = (await (await compte.GET(requeteNue(sacha))).json()) as {
        donnees: { favorites: unknown[] };
      };
      expect(vuParSacha.donnees.favorites).toHaveLength(0);
    });
  });

  /* ── Avis ───────────────────────────────────────────────────────────── */

  describe('avis', () => {
    it('se publie et apparaît dans les contributions publiques du spot', async () => {
      const jeton = await compteOuvert();

      const publication = await avis.POST(
        requeteJson({ spotSlug: 'pen-hat', rating: 4, comment: 'Belle descendante.' }, jeton),
      );
      expect(publication.status).toBe(200);

      const publiques = (await (
        await contributionsPubliques.GET(requeteNue(), { params: Promise.resolve({ slug: 'pen-hat' }) })
      ).json()) as {
        donnees: { reviews: { authorName: string; rating: number }[]; averageRating: number | null };
      };

      expect(publiques.donnees.reviews).toHaveLength(1);
      expect(publiques.donnees.reviews[0]!.authorName).toBe('Camille');
      expect(publiques.donnees.averageRating).toBe(4);
    });

    it('accepte un avis SANS commentaire', async () => {
      const jeton = await compteOuvert();

      /*
        Le défaut d'origine du projet : le schéma transformait un commentaire
        vide en `null` au premier passage, et le refusait au second. Tout avis
        sans commentaire était rejeté en production avec « saisie invalide ».
        Seule l'exécution contre une vraie base pouvait le montrer — il avait
        survécu à toute la version PostgreSQL.
      */
      const reponse = await avis.POST(requeteJson({ spotSlug: 'pen-hat', rating: 5 }, jeton));
      expect(reponse.status, JSON.stringify(await reponse.clone().json())).toBe(200);
    });

    it('refuse une note hors barème', async () => {
      const jeton = await compteOuvert();
      const reponse = await avis.POST(requeteJson({ spotSlug: 'pen-hat', rating: 9 }, jeton));

      expect(reponse.status).toBe(422);
      expect((await corps(reponse)).message).toContain('1 à 5');
    });

    it('ne publie pas l’identifiant de compte de son auteur', async () => {
      const jeton = await compteOuvert();
      await avis.POST(requeteJson({ spotSlug: 'pen-hat', rating: 4 }, jeton));

      const brut = await (
        await contributionsPubliques.GET(requeteNue(), { params: Promise.resolve({ slug: 'pen-hat' }) })
      ).text();

      const userId = (await db.query<{ id: string }>('select id from users limit 1'))[0]!.id;
      expect(brut).not.toContain(userId);
    });
  });

  /* ── Appareils ──────────────────────────────────────────────────────── */

  describe('appareils de notification', () => {
    const APPAREIL = { token: 'ExponentPushToken-abc123456789', platform: 'ios', label: 'iPhone' };

    it('s’enregistre, et se réenregistre sans erreur', async () => {
      const jeton = await compteOuvert();

      expect((await appareils.POST(requeteJson(APPAREIL, jeton))).status).toBe(200);
      // L'application réenregistre son jeton à CHAQUE démarrage : une
      // insertion simple échouerait au deuxième lancement, et les
      // notifications cesseraient sans que rien ne le signale.
      expect((await appareils.POST(requeteJson(APPAREIL, jeton))).status).toBe(200);

      const lignes = await db.query<{ n: number }>('select count(*) as n from push_devices');
      expect(Number(lignes[0]!.n)).toBe(1);
    });

    it('suit le compte quand le téléphone change de main', async () => {
      const camille = await compteOuvert();
      const sacha = await compteOuvert({ email: 'sacha@exemple.fr', firstName: 'Sacha' });

      await appareils.POST(requeteJson(APPAREIL, camille));
      await appareils.POST(requeteJson(APPAREIL, sacha));

      const lignes = await db.query<{ n: number }>('select count(*) as n from push_devices');
      expect(Number(lignes[0]!.n)).toBe(1);

      // Sans quoi les alertes de l'ancien propriétaire continueraient
      // d'arriver sur un appareil qui n'est plus le sien.
      const { appareilsDe } = await import('@/lib/providers/mysql/appareils');
      const utilisateurs = await db.query<{ id: string; email: string }>(
        'select id, email from users where email = ?',
        ['sacha@exemple.fr'],
      );
      expect(await appareilsDe(utilisateurs[0]!.id)).toHaveLength(1);
    });

    it('ne laisse pas retirer l’appareil de quelqu’un d’autre', async () => {
      const camille = await compteOuvert();
      const sacha = await compteOuvert({ email: 'sacha@exemple.fr', firstName: 'Sacha' });

      await appareils.POST(requeteJson(APPAREIL, camille));
      await appareils.DELETE(requeteJson({ token: APPAREIL.token }, sacha, 'DELETE'));

      // `user_id = ?` filtre la suppression : connaître un jeton ne suffit pas
      // à couper quelqu'un d'autre de ses alertes.
      const lignes = await db.query<{ n: number }>('select count(*) as n from push_devices');
      expect(Number(lignes[0]!.n)).toBe(1);
    });

    it('refuse une plateforme inconnue', async () => {
      const jeton = await compteOuvert();
      const reponse = await appareils.POST(
        requeteJson({ ...APPAREIL, platform: 'blackberry' }, jeton),
      );

      expect(reponse.status).toBe(422);
      expect((await corps(reponse)).message).toContain('ios');
    });

    it('disparaît avec le compte, sans quoi on notifierait un effacé', async () => {
      const jeton = await compteOuvert();
      await appareils.POST(requeteJson(APPAREIL, jeton));

      const { contributions } = await import('@/lib/providers');
      const userId = (await db.query<{ id: string }>('select id from users limit 1'))[0]!.id;
      await contributions.deleteAccount(userId);

      // C'est la cascade du schéma qui le garantit, pas une suite d'appels
      // qu'on pourrait oublier d'écrire.
      const lignes = await db.query<{ n: number }>('select count(*) as n from push_devices');
      expect(Number(lignes[0]!.n)).toBe(0);
    });
  });
});
