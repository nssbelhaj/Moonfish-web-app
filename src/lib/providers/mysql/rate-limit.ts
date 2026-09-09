import { execute, query, toIso, toMysqlDateTime } from '@/lib/db/mysql';
import type { RateLimitDecision } from '@/lib/rate-limit';

/**
 * Limiteur de débit à fenêtre glissante, en base.
 *
 * Le limiteur en mémoire (`@/lib/rate-limit`) oublie tout à chaque
 * redémarrage, et un redéploiement remet donc tous les compteurs à zéro. Pour
 * la liste d'attente c'était sans conséquence. Pour un formulaire qui fait
 * PARTIR UN COURRIEL, ça ne l'est pas : il suffisait d'attendre le déploiement
 * suivant, ou de viser une autre instance.
 *
 * ── Pourquoi on insère AVANT de compter ──────────────────────────────────
 *
 * L'ordre naturel — compter, puis insérer si la place est libre — laisse deux
 * requêtes simultanées lire le même compte et passer toutes les deux. En
 * insérant d'abord, chacune se voit dans son propre décompte : sous
 * concurrence le limiteur devient momentanément plus STRICT que sa consigne,
 * jamais plus permissif. Pour un envoi de courrier, c'est le bon sens de
 * l'erreur.
 *
 * La tentative refusée est ensuite retirée. Sans cela, marteler le formulaire
 * repousserait indéfiniment l'heure de déblocage, et le message « réessayez
 * à telle heure » deviendrait faux.
 */

interface LigneFenetre {
  n: number;
  plus_ancien: string | Date | null;
}

/**
 * Une tentative, comptée dans `bucket` pour `subject`.
 *
 * `subject` doit déjà être une empreinte : cette table ne doit jamais
 * contenir d'adresse ni d'IP en clair.
 */
export async function checkMysqlLimit(
  bucket: string,
  subject: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitDecision> {
  const debut = toMysqlDateTime(new Date(now - windowMs));

  await execute('insert into rate_limits (bucket, subject, hit_at) values (?, ?, ?)', [
    bucket,
    subject,
    toMysqlDateTime(new Date(now)),
  ]);

  const rows = await query<LigneFenetre>(
    'select count(*) as n, min(hit_at) as plus_ancien from rate_limits where bucket = ? and subject = ? and hit_at > ?',
    [bucket, subject, debut],
  );

  const ligne = rows[0] ?? { n: 1, plus_ancien: null };
  // `count(*)` revient parfois en chaîne selon le pilote et la colonne.
  const compte = Number(ligne.n);

  if (compte <= limit) {
    return { allowed: true, remaining: limit - compte, resetAt: now + windowMs };
  }

  /*
    Refusé : on retire la tentative qu'on vient d'inscrire. `order by id desc
    limit 1` vise la dernière ligne de ce couple — la nôtre, ou celle d'une
    requête concurrente également refusée, ce qui revient au même.
  */
  await execute('delete from rate_limits where bucket = ? and subject = ? order by id desc limit 1', [
    bucket,
    subject,
  ]);

  /*
    `toIso` porte déjà la règle du projet : les colonnes sont écrites en UTC,
    MySQL les rend sans fuseau, et il faut ajouter le « Z » manquant. La
    réserve de connexions demande `dateStrings`, donc c'est bien une chaîne
    qui arrive ici — mais passer par `toIso` couvre les deux formes et évite
    d'entretenir deux fois la même règle.
  */
  const plusAncien = toIso(ligne.plus_ancien);
  const oldest = plusAncien === null ? now : new Date(plusAncien).getTime();

  return {
    allowed: false,
    remaining: 0,
    resetAt: (Number.isNaN(oldest) ? now : oldest) + windowMs,
  };
}

/**
 * Ménage : supprime les tentatives sorties de la plus longue fenêtre.
 *
 * Appelé par `/api/entretien`. Sans lui la table grossit indéfiniment — ce
 * qui ne casse rien mais finit par peser sur un hébergement mutualisé.
 */
export async function purgeRateLimits(olderThanMs: number, now: number = Date.now()): Promise<number> {
  return execute('delete from rate_limits where hit_at < ?', [
    toMysqlDateTime(new Date(now - olderThanMs)),
  ]);
}
