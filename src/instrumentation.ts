/**
 * Contrôles au démarrage du serveur.
 *
 * ─── Pourquoi ce fichier a dû être écrit ──────────────────────────────────
 *
 * `storageWarning()` existait, était documenté comme « le code avertit au
 * démarrage »… et n'était appelé NULLE PART. Une garde que rien n'exécute est
 * pire qu'une garde absente : elle figure dans la documentation, on compte
 * dessus, et elle ne se déclenche jamais. Le même vide guettait le contrôle
 * de l'URL SMTP.
 *
 * Next.js appelle `register()` une fois, au lancement du serveur. C'est le
 * seul endroit qui s'exécute avant toute requête et après la lecture des
 * variables d'environnement.
 *
 * ─── Ce que ces contrôles ne font PAS ─────────────────────────────────────
 *
 * Ils n'empêchent rien de démarrer. Marées, météo, guides et score ne
 * dépendent ni de la base, ni du courriel, ni du stockage des photos : refuser
 * de servir le site pour une variable mal saisie ferait tomber ce qui marche
 * afin de protéger ce qui ne marche pas.
 *
 * Ils existent pour qu'une panne PORTE SON NOM. Sans eux, chacun de ces
 * défauts se présente sous un déguisement : « les comptes ne sont pas
 * ouverts » (mode prévu), « le serveur ne répond pas » (panne réseau), « les
 * photos ont disparu » (sans lien apparent avec le déploiement de mardi).
 */

export async function register(): Promise<void> {
  // `nodejs` uniquement : le runtime Edge n'a ni système de fichiers ni accès
  // à ces modules, et y importer `node:path` casserait la compilation.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const [{ smtpWarning }, { storageWarning }] = await Promise.all([
    import('@/lib/auth/config'),
    import('@/lib/photo/storage'),
  ]);

  const avertissements = [smtpWarning(), storageWarning()].filter(
    (message): message is string => message !== null,
  );

  for (const message of avertissements) console.warn(`[config] ${message}`);
}
