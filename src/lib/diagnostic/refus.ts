import { NextResponse } from 'next/server';

/**
 * Refus d'accès aux routes d'exploitation, expliqué.
 *
 * ── Pourquoi un refus mérite du soin ─────────────────────────────────────
 *
 * `/api/diagnostic` et `/api/entretien` répondaient « Non autorisé. » Exact,
 * et parfaitement inutile : on ne sait ni quel en-tête manque, ni où trouver
 * la valeur, ni si on vient de recopier un texte d'exemple à la place du
 * secret. Ce sont pourtant les deux outils qu'on vient consulter quand plus
 * rien ne marche.
 *
 * Le message dit COMMENT demander, jamais ce qu'il faudrait répondre.
 */
export function refusExplique(enteteRecu: string | null): NextResponse {
  /*
    L'erreur observée deux fois : coller le gabarit de la documentation au
    lieu de la valeur. Le refus est alors identique à celui d'un mauvais
    secret, et rien ne suggère de relire l'en-tête qu'on vient d'envoyer.
  */
  const ressembleAUnExemple = /VOTRE|COLLEZ|VALEUR|XXX|<|\.\.\./i.test(enteteRecu ?? '');

  return NextResponse.json(
    {
      ok: false,
      message: 'Non autorisé.',
      commentDemander:
        'Ajoutez l’en-tête « Authorization: Bearer VALEUR », où VALEUR est le contenu de la variable d’environnement CRON_SECRET de ce déploiement.',
      ouTrouverLaValeur:
        'hPanel → votre site → Web App (ou Node.js) → Variables d’environnement → ligne CRON_SECRET. La valeur y est lisible et modifiable ; vous pouvez aussi la remplacer par une valeur de votre choix, puis redéployer.',
      ...(ressembleAUnExemple
        ? {
            remarque:
              'L’en-tête reçu ressemble à un texte d’exemple, pas à un secret : remplacez-le par la valeur réelle de CRON_SECRET.',
          }
        : {}),
    },
    { status: 401, headers: { 'cache-control': 'no-store' } },
  );
}
