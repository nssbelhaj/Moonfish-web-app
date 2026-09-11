import { lireConfigBase } from '@/lib/db/config';
import { BUILD_STAMP } from '@/lib/build-stamp';
import { smtpWarning } from '@/lib/auth/config';
import { parseAllowedSpots } from '@/lib/providers/selective-tide';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  L'état de la configuration, en français, sans jamais montrer un secret
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `src/instrumentation.ts` écrit déjà ses avertissements au démarrage. Cela
 * suppose de savoir OÙ lit-on les journaux d'un hébergement mutualisé — et
 * cette question est revenue plusieurs fois sans réponse simple.
 *
 * Ce module rend le même diagnostic sous forme de données, pour un point
 * d'accès qu'on interroge avec un `curl`. Il répond en particulier à la
 * question qui coûte le plus de temps : « la clé est posée, pourquoi les
 * marées restent-elles simulées ? »
 *
 * ── Aucune valeur de secret ne sort d'ici ────────────────────────────────
 *
 * Un diagnostic qui recopierait `DATABASE_URL` pour aider à la relire serait
 * un diagnostic qui publie un mot de passe. On dit « définie » ou « absente »,
 * jamais le contenu ; pour une URL, l'hôte seul, qui n'est pas un secret et
 * suffit à repérer une faute de frappe. `etat.test.ts` injecte des secrets
 * reconnaissables et échoue si l'un d'eux réapparaît dans la sortie.
 */

export type Etat = 'ok' | 'attention' | 'absent';

export interface Point {
  sujet: string;
  etat: Etat;
  /** Ce qui est vrai, maintenant. */
  constat: string;
  /** Quoi faire. `null` quand il n'y a rien à faire. */
  remede: string | null;
}

export type Environnement = Readonly<Record<string, string | undefined>>;

/** « définie » / « absente » — jamais la valeur. */
function presence(env: Environnement, cle: string): boolean {
  return (env[cle]?.trim() ?? '').length > 0;
}

/**
 * Hôte d'une URL, ou une raison de ne pas l'avoir pu.
 *
 * L'hôte n'est pas un secret et il révèle la faute la plus fréquente : un
 * `smtp.hostinger.com` devenu `lunamarea.fr` parce qu'un `/` du mot de passe
 * a coupé l'URL en deux.
 */
function hote(brut: string | undefined): string {
  if (!brut) return 'absente';
  try {
    return new URL(brut.trim()).host;
  } catch {
    return 'illisible';
  }
}

export interface Contexte {
  env: Environnement;
  /** Nombre de spots du catalogue, pour le calcul de quota. */
  spotCount: number;
  /** Répertoire réellement utilisé pour les photos. */
  uploadsDir: string;
  /** Le répertoire de l'application, pour dire si les photos sont dedans. */
  appDir: string;
}

export function diagnostiquer({ env, spotCount, uploadsDir, appDir }: Contexte): Point[] {
  const points: Point[] = [];

  /*
    En tête, parce que c'est la première question à trancher : le reste de ce
    diagnostic décrit la construction en ligne, qui n'est peut-être pas la
    dernière poussée. Sans cette ligne, un correctif non déployé et un
    correctif déployé qui échoue se ressemblent exactement.
  */
  points.push(
    BUILD_STAMP === 'inconnue'
      ? {
          sujet: 'Version en ligne',
          etat: 'attention',
          constat:
            'L’horodatage de construction est absent : le site a été compilé par `next build` directement, sans passer par `npm run build`.',
          remede:
            'Sans lui, impossible de dire si un correctif est déployé ou s’il échoue — les deux donnent le même symptôme. Faites compiler par `npm run build`.',
        }
      : {
          sujet: 'Version en ligne',
          etat: 'ok',
          constat: `Construction du ${BUILD_STAMP}. Le même horodatage est servi dans l’en-tête « x-luna-marea-build » de chaque réponse.`,
          remede: null,
        },
  );

  // ── 1. L'adresse du site ────────────────────────────────────────────────
  const siteUrl = env['NEXT_PUBLIC_SITE_URL'];
  points.push(
    siteUrl
      ? {
          sujet: 'Adresse publique du site',
          etat: 'ok',
          constat: `Le site se désigne sous ${hote(siteUrl)}.`,
          remede: null,
        }
      : {
          sujet: 'Adresse publique du site',
          etat: 'attention',
          constat:
            'NEXT_PUBLIC_SITE_URL n’était pas définie AU MOMENT DE LA COMPILATION. Le sitemap et les liens de partage annoncent l’adresse de repli.',
          remede:
            'Définissez NEXT_PUBLIC_SITE_URL=https://lunamarea.fr puis RECONSTRUISEZ : cette variable est insérée à la compilation, la poser sans reconstruire ne change rien.',
        },
  );

  // ── 2. La base ──────────────────────────────────────────────────────────
  const verdict = lireConfigBase(env);
  points.push(
    verdict.kind === 'ok'
      ? {
          sujet: 'Base de données',
          etat: 'ok',
          constat: `Configuration lue : base « ${verdict.config.database} » sur ${verdict.config.host}.`,
          remede: null,
        }
      : verdict.kind === 'absente'
        ? {
            sujet: 'Base de données',
            etat: 'absent',
            constat:
              'Aucune base configurée. Comptes, avis, prises, favoris et sorties sont indisponibles ; le reste du site fonctionne.',
            remede: 'Définissez DATABASE_URL, puis redéployez.',
          }
        : {
            sujet: 'Base de données',
            etat: 'attention',
            constat: `DATABASE_URL est définie mais illisible : ${verdict.raison}`,
            remede: verdict.remede,
          },
  );

  // ── 3. Le courriel, et l'hôte de confiance ──────────────────────────────
  const smtp = env['EMAIL_SERVER'];
  const smtpHote = hote(smtp);
  const emailFrom = presence(env, 'EMAIL_FROM');

  /*
    Le contrôle de l'URL passe AVANT l'état du courriel : un mot de passe
    contenant « / », « ? », « # » ou « % » ne rend pas EMAIL_SERVER absente,
    il la rend trompeuse — la connexion part vers un autre hôte, ou l'URL
    devient illisible. Le dire après « les courriels partent par … » serait
    contradictoire.
  */
  const urlSuspecte = smtpWarning(smtp);
  if (urlSuspecte !== null) {
    points.push({
      sujet: 'Forme de l’URL d’envoi',
      etat: 'absent',
      constat: urlSuspecte,
      remede:
        'Changez le mot de passe de la boîte pour un mot de passe sans « / », « ? », « # » ni « % », ou encodez-les (%2F %3F %23 %25).',
    });
  }

  points.push(
    !smtp
      ? {
          sujet: 'Envoi de courriel',
          etat: 'absent',
          constat: 'EMAIL_SERVER absente : aucun lien de connexion ne peut partir.',
          remede:
            'Définissez EMAIL_SERVER=smtp://UTILISATEUR:MOTDEPASSE@smtp.hostinger.com:587 et EMAIL_FROM.',
        }
      : !emailFrom
        ? {
            sujet: 'Envoi de courriel',
            etat: 'attention',
            constat: `Serveur d’envoi ${smtpHote}, mais EMAIL_FROM est absente.`,
            remede: 'Définissez EMAIL_FROM=contact@lunamarea.fr.',
          }
        : {
            sujet: 'Envoi de courriel',
            etat: 'ok',
            constat: `Les courriels partent par ${smtpHote}.`,
            remede: null,
          },
  );

  const production = env['NODE_ENV'] === 'production';
  const hoteDeConfiance =
    presence(env, 'AUTH_URL') ||
    presence(env, 'AUTH_TRUST_HOST') ||
    presence(env, 'VERCEL') ||
    presence(env, 'CF_PAGES');

  points.push(
    !production || hoteDeConfiance
      ? {
          sujet: 'Hôte de confiance (Auth.js)',
          etat: 'ok',
          constat: production ? 'AUTH_URL est définie.' : 'Hors production : la bibliothèque fait confiance par défaut.',
          remede: null,
        }
      : {
          sujet: 'Hôte de confiance (Auth.js)',
          etat: 'absent',
          constat:
            'AUTH_URL est absente en production. Le formulaire de connexion s’affiche, la demande échoue en 500 (UntrustedHost), et AUCUN courriel ne part.',
          remede: 'Définissez AUTH_URL=https://lunamarea.fr, puis redéployez.',
        },
  );

  points.push(
    presence(env, 'AUTH_SECRET')
      ? { sujet: 'Secret de session', etat: 'ok', constat: 'AUTH_SECRET est définie.', remede: null }
      : {
          sujet: 'Secret de session',
          etat: 'absent',
          constat: 'AUTH_SECRET est absente : les sessions ne peuvent pas être signées.',
          remede: 'Générez-la avec `openssl rand -base64 32` et définissez AUTH_SECRET.',
        },
  );

  /*
    Les comptes s'ouvrent avec une base SEULE depuis l'inscription par mot de
    passe. Ce point affirmait encore « il faut la base ET le courriel » : il
    annonçait des comptes fermés sur un déploiement où l'on venait d'en créer
    un. Un diagnostic qui se trompe sur l'état du site est pire qu'aucun.
  */
  const comptesOuverts = verdict.kind === 'ok';
  const recuperationPossible = Boolean(smtp) && emailFrom;

  points.push({
    sujet: 'Comptes',
    etat: comptesOuverts ? (recuperationPossible ? 'ok' : 'attention') : 'absent',
    constat: !comptesOuverts
      ? 'Les comptes sont FERMÉS : sans base, il n’y a rien à quoi se connecter.'
      : recuperationPossible
        ? 'Les comptes sont ouverts : inscription par mot de passe, lien par courriel, carnet de prises, favoris, sorties programmées.'
        : 'Les comptes sont ouverts par mot de passe. En revanche, faute de serveur d’envoi, un mot de passe OUBLIÉ ne peut pas être récupéré : le compte serait perdu.',
    remede: !comptesOuverts
      ? 'Définissez DATABASE_URL, puis redéployez.'
      : recuperationPossible
        ? null
        : 'Configurez EMAIL_SERVER et EMAIL_FROM pour rendre la récupération possible.',
  });

  // ── 4. Les marées : la question qui revient ─────────────────────────────
  const cle = presence(env, 'STORMGLASS_API_KEY');
  const force = env['TIDE_PROVIDER'] === 'mock';
  const bornes = parseAllowedSpots(env['TIDE_REAL_SPOTS']);

  points.push(
    force
      ? {
          sujet: 'Marées',
          etat: 'attention',
          constat: 'TIDE_PROVIDER=mock force les marées simulées, même avec une clé.',
          remede: 'Retirez TIDE_PROVIDER, puis reconstruisez.',
        }
      : !cle
        ? {
            sujet: 'Marées',
            etat: 'absent',
            constat:
              'STORMGLASS_API_KEY est absente : toutes les marées sont SIMULÉES, et le site le dit sur chaque page.',
            remede:
              'Définissez STORMGLASS_API_KEY et TIDE_REAL_SPOTS, puis RECONSTRUISEZ : les marées sont lues au pré-rendu, pas à la visite.',
          }
        : bornes.length === 0 && spotCount > 8
          ? {
              sujet: 'Marées',
              etat: 'attention',
              constat: `La clé est posée mais TIDE_REAL_SPOTS ne l’est pas : les ${spotCount} spots partent tous vers Stormglass, soit ${spotCount + 1} appels par construction pour un palier gratuit de 10 par jour. Au-delà du quota, le repli rend des marées SIMULÉES sans rien signaler — et la clé paraît fautive.`,
              remede:
                'Définissez TIDE_REAL_SPOTS=pen-hat,la-torche,etretat, puis reconstruisez.',
            }
          : {
              sujet: 'Marées',
              etat: 'ok',
              constat:
                bornes.length === 0
                  ? `Marées réelles pour les ${spotCount} spots.`
                  : `Marées réelles pour ${bornes.length} spot(s) : ${bornes.join(', ')}. Les autres restent simulés et l’annoncent.`,
              remede: null,
            },
  );

  // ── 5. Photos ───────────────────────────────────────────────────────────
  const dansLApp = uploadsDir.startsWith(appDir);
  points.push({
    sujet: 'Photos de prises',
    etat: dansLApp ? 'attention' : 'ok',
    constat: dansLApp
      ? 'Les photos sont écrites À L’INTÉRIEUR du répertoire de l’application : le prochain déploiement les effacera.'
      : 'Les photos sont écrites hors du répertoire de l’application.',
    remede: dansLApp ? 'Définissez UPLOADS_DIR vers un chemin extérieur, par exemple /home/VOTRE-COMPTE/luna-marea-photos.' : null,
  });

  // ── 6. Entretien ────────────────────────────────────────────────────────
  points.push(
    presence(env, 'CRON_SECRET')
      ? {
          sujet: 'Tâche d’entretien',
          etat: 'ok',
          constat: 'CRON_SECRET est définie : /api/entretien est fermée au public.',
          remede: null,
        }
      : {
          sujet: 'Tâche d’entretien',
          etat: 'attention',
          constat:
            'CRON_SECRET est absente : /api/entretien est ouverte à tous. Sans tâche planifiée, AUCUNE alerte de sortie ne part jamais.',
          remede:
            'Générez un secret, définissez CRON_SECRET, et créez une tâche quotidienne qui appelle /api/entretien avec l’en-tête Authorization: Bearer.',
        },
  );

  return points;
}

/** Vert si tout va bien, orange s'il reste des « attention », rouge s'il manque l'essentiel. */
export function verdictGlobal(points: readonly Point[]): Etat {
  if (points.some((p) => p.etat === 'absent')) return 'absent';
  if (points.some((p) => p.etat === 'attention')) return 'attention';
  return 'ok';
}
