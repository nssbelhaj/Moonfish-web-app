'use client';

import { useEffect } from 'react';

/**
 * Le filet de sécurité d'un DÉPLOIEMENT en cours.
 *
 * ─── La panne, telle qu'elle se présente ──────────────────────────────────
 *
 * Une page ouverte au moment d'une mise en ligne référence des fichiers
 * JavaScript qui, une seconde plus tard, n'existent plus : Next renomme ses
 * morceaux à chaque construction. Le navigateur demande l'ancien nom, reçoit
 * un 404, et l'hydratation échoue. Ce que voit la personne est une page vide
 * portant « Application error: a client-side exception has occurred » — un
 * message en anglais, sans cause ni recours, sur un site entièrement en
 * français. Vu en production le 17 septembre, sur la page d'un spot.
 *
 * Le serveur, lui, va parfaitement bien : la même adresse rechargée s'affiche.
 * C'est exactement ce que fait ce composant.
 *
 * ─── Recharger UNE fois, et pas en boucle ─────────────────────────────────
 *
 * Un rechargement automatique sur une panne qui n'est pas passagère
 * enfermerait le navigateur dans une boucle. Le marqueur est donc posé dans
 * `sessionStorage` : la deuxième fois, on n'insiste pas, on explique et on
 * laisse la main.
 */

const MARQUEUR = 'luna-marea:rechargement-apres-erreur';

/** Signature d'un morceau de JavaScript manquant, plutôt que d'une vraie panne. */
function ressembleAUnDeploiement(erreur: Error): boolean {
  const texte = `${erreur.name} ${erreur.message}`;
  return (
    /ChunkLoadError/i.test(texte) ||
    /Loading chunk [\w-]+ failed/i.test(texte) ||
    /Failed to fetch dynamically imported module/i.test(texte) ||
    /error loading dynamically imported module/i.test(texte) ||
    /Importing a module script failed/i.test(texte)
  );
}

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    if (!ressembleAUnDeploiement(error)) return;

    try {
      if (sessionStorage.getItem(MARQUEUR) !== null) return;
      sessionStorage.setItem(MARQUEUR, '1');
    } catch {
      // Navigation privée ou stockage bloqué : on ne recharge pas plutôt que
      // de risquer la boucle qu'on cherche précisément à éviter.
      return;
    }

    location.reload();
  }, [error]);

  return (
    <html lang="fr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '24px',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
          lineHeight: 1.6,
        }}
      >
        {/*
          ─── Aucune couleur, et c'est délibéré ───────────────────────────
          `global-error` remplace la racine du document, feuille de style
          comprise : ni classe Tailwind ni jeton `var(--…)` n'y arrivent. Il
          ne reste que des littéraux — que la règle D22 interdit, et le test
          de couleurs a eu raison de les refuser : un jeu de teintes recopié
          ici cesserait de suivre le thème le jour où la palette bouge, et
          personne ne le verrait, cette page ne s'affichant presque jamais.
          On s'en passe donc. Les couleurs par défaut du navigateur suivent
          le thème du système, contrastent toujours, et cet écran dure le
          temps d'un rechargement.
        */}
        <main style={{ maxWidth: '38rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '21px', fontWeight: 600, margin: 0 }}>
            Cette page n’a pas pu s’afficher
          </h1>
          <p style={{ margin: '12px 0 0' }}>
            Cela arrive quand le site vient d’être mis à jour pendant que vous le consultiez :
            l’onglet ouvert attend une version qui n’existe plus. Rechargez la page, elle
            fonctionnera.
          </p>
          <p style={{ margin: '20px 0 0' }}>
            <button
              type="button"
              onClick={() => location.reload()}
              style={{
                minHeight: '48px',
                padding: '0 24px',
                borderRadius: '10px',
                font: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Recharger la page
            </button>
          </p>
          {error.digest !== undefined && (
            <p style={{ margin: '16px 0 0', fontSize: '12px', opacity: 0.7 }}>
              Référence : {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  );
}
