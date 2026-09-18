import os from 'node:os';
import path from 'node:path';
import { rm } from 'node:fs/promises';

import type { Point } from './etat';
import { peutEcrire } from './ecriture';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Où PEUT-ON écrire ? — quand savoir que ça échoue ne suffit plus
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `essai-photos.ts` répond « peut-on écrire LÀ ? ». Utile une fois, et
 * insuffisant la fois d'après : en production, `UPLOADS_DIR` pointait vers un
 * dossier du compte d'hébergement, visible dans le Gestionnaire de fichiers,
 * et l'écriture rendait EACCES. Restaient quatre explications concurrentes —
 * mauvais propriétaire, dossier absent, disque en lecture seule, ou le disque
 * du compte mutualisé qui n'existe pas du tout dans le conteneur qui fait
 * tourner Node.
 *
 * On ne peut pas trancher depuis l'extérieur. Corriger les droits d'un dossier
 * que l'application ne voit pas ne changerait rien, et on l'apprendrait après
 * l'avoir fait.
 *
 * Alors on demande au serveur. Chaque candidat reçoit le même essai réel, et
 * la réponse dit non pas « c'est cassé » mais « voilà les emplacements qui
 * acceptent l'écriture, et ce qu'ils valent ».
 *
 * ── Aucun dossier ne survit à cet essai ─────────────────────────────────
 *
 * `peutEcrire` rend le premier dossier qu'il a dû créer ; on le retire. Un
 * diagnostic qui sème des dossiers vides dans le compte de quelqu'un est un
 * diagnostic qu'on cesse de lancer.
 */

/** Un emplacement peut être inscriptible ET perdre les photos. Les deux se disent. */
type Survie = 'oui' | 'non' | 'inconnue';

export interface Candidat {
  chemin: string;
  survie: Survie;
  pourquoi: string;
}

export function candidats(env: Readonly<Record<string, string | undefined>>, appDir: string): Candidat[] {
  const liste: Candidat[] = [];
  const vus = new Set<string>();

  const ajouter = (chemin: string | undefined, survie: Survie, pourquoi: string) => {
    if (!chemin) return;
    const resolu = path.resolve(chemin);
    if (vus.has(resolu)) return;
    vus.add(resolu);
    liste.push({ chemin: resolu, survie, pourquoi });
  };

  /*
    Le HOME du processus AVANT celui du compte d'hébergement : c'est celui que
    l'application voit réellement, et l'écart entre les deux est justement ce
    qu'on cherche à mesurer.
  */
  ajouter(
    env['HOME'] && path.join(env['HOME'], 'luna-marea-photos'),
    'inconnue',
    'Dossier personnel du processus (HOME). Survit à un déploiement s’il s’agit d’un vrai disque du compte ; pas s’il appartient au conteneur.',
  );
  ajouter(
    path.join(os.homedir(), 'luna-marea-photos'),
    'inconnue',
    'Dossier personnel vu par le système.',
  );
  ajouter(
    path.join(appDir, '..', 'luna-marea-photos'),
    'inconnue',
    'À CÔTÉ de l’application, un cran au-dessus. Souvent le bon compromis sur un hébergement mutualisé.',
  );
  ajouter(
    path.join(appDir, 'var', 'photos'),
    'non',
    'DANS l’application : le prochain déploiement remplace ce répertoire et efface les photos.',
  );
  ajouter(
    path.join(os.tmpdir(), 'luna-marea-photos'),
    'non',
    'Dossier temporaire : effacé au redémarrage. Ne sert qu’à savoir si le conteneur accepte d’écrire quelque part.',
  );

  return liste;
}

/*
  La liste est INJECTABLE, et pour une raison précise : la branche qui compte
  vraiment — « aucun emplacement durable n'accepte l'écriture, arrêtez de
  chercher un réglage » — ne peut pas être provoquée sur une vraie machine
  sans rendre tout le disque inaccessible. Sans cette couture, la seule
  conclusion capable de faire changer d'architecture ne serait jamais éprouvée.
*/
export async function emplacementsPossibles(
  env: Readonly<Record<string, string | undefined>>,
  appDir: string,
  liste: readonly Candidat[] = candidats(env, appDir),
): Promise<Point> {
  const sujet = 'Où les photos peuvent-elles s’écrire ?';

  const resultats = await Promise.all(
    liste.map(async (candidat) => {
      const essai = await peutEcrire(candidat.chemin);
      // Ne rien laisser derrière : on retire ce qu'on a créé, et seulement cela.
      if (essai.ok && essai.dossierCree !== null) {
        await rm(essai.dossierCree, { recursive: true, force: true }).catch(() => undefined);
      }
      return { ...candidat, essai };
    }),
  );

  /*
    Qui fait tourner Node ? Ce n'est pas un secret — c'est écrit sur chaque
    fichier que le processus crée — et c'est la moitié de la réponse quand un
    EACCES tombe sur un dossier que le Gestionnaire de fichiers affiche.
  */
  const identite = (() => {
    try {
      const { username, uid } = os.userInfo();
      return `${username} (uid ${uid})`;
    } catch {
      return 'inconnu';
    }
  })();

  const lignes = resultats.map(({ chemin, survie, pourquoi, essai }) => {
    const verdict = essai.ok
      ? survie === 'non'
        ? 'écriture OK, mais NE SURVIT PAS'
        : 'écriture OK'
      : `refusé (${essai.code})`;
    return `• ${chemin} — ${verdict}. ${pourquoi}`;
  });

  const utilisables = resultats.filter((r) => r.essai.ok && r.survie !== 'non');
  const aucuneEcriture = resultats.every((r) => !r.essai.ok);

  return {
    sujet,
    etat: utilisables.length > 0 ? 'attention' : 'absent',
    constat: [`Node tourne sous ${identite}.`, ...lignes].join('\n'),
    remede: aucuneEcriture
      ? 'AUCUN emplacement n’accepte l’écriture : ce déploiement n’a pas de disque inscriptible. Les photos ne peuvent pas être stockées en fichiers ici — il faut les ranger ailleurs (base de données ou stockage objet).'
      : utilisables.length > 0
        ? `Pointez UPLOADS_DIR vers ${utilisables[0]!.chemin}, puis redéployez. Vérifiez ensuite qu’une photo envoyée AVANT un déploiement est toujours là APRÈS : « écriture OK » ne prouve pas la persistance.`
        : 'Seuls des emplacements éphémères acceptent l’écriture : une photo enregistrée y disparaîtrait au déploiement suivant. Il faut ranger les photos ailleurs (base de données ou stockage objet).',
  };
}
