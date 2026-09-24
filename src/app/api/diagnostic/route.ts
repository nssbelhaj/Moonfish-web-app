import { NextResponse, type NextRequest } from 'next/server';

import { SPOTS } from '@/data/spots';
import { diagnostiquer, verdictGlobal } from '@/lib/diagnostic/etat';
import { BUILD_STAMP } from '@/lib/build-stamp';
import { estProprietaire } from '@/lib/auth/proprietaire';
import { etatMigrations } from '@/lib/diagnostic/migrations';
import { refusExplique } from '@/lib/diagnostic/refus';
import { essaiBase } from '@/lib/diagnostic/essai-base';
import { etatDesMareesConservees } from '@/lib/diagnostic/marees-conservees';
import { etatDesVisites } from '@/lib/diagnostic/visites';
import { databaseEnabled } from '@/lib/db/mysql';
import { MysqlTideTableStore } from '@/lib/providers/mysql/marees';
import { essaiPhotos } from '@/lib/diagnostic/essai-photos';
import { emplacementsPossibles } from '@/lib/diagnostic/emplacements';
import { auditPhotos } from '@/lib/diagnostic/audit-photos';
import { essaiSmtp } from '@/lib/diagnostic/smtp';
import { uploadsDir } from '@/lib/photo/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * L'état de la configuration, lisible avec un `curl`.
 *
 * Les avertissements de `src/instrumentation.ts` partent dans les journaux du
 * serveur. Encore faut-il savoir où un hébergement mutualisé les range — la
 * question est restée sans réponse simple, et un diagnostic qu'on ne peut pas
 * lire ne diagnostique rien.
 *
 * Cette route sert le même constat en JSON. Elle ne divulgue AUCUNE valeur de
 * secret : « définie » ou « absente », et pour une URL l'hôte seul.
 *
 * ── Fermée dès que possible ─────────────────────────────────────────────
 *
 * Le même secret que l'entretien la protège. Sans CRON_SECRET elle reste
 * ouverte — c'est le seul moment où elle est vraiment utile, puisque c'est
 * l'état où l'on cherche encore ce qui manque — et elle le dit dans sa propre
 * sortie plutôt que de le taire.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  /*
    Deux clés pour la même porte, et c'est délibéré.

    Le secret sert à la tâche planifiée, qui n'a pas de session. La session du
    propriétaire sert à un humain — qui, lui, n'a pas à retrouver une variable
    d'environnement dans un panneau d'hébergeur pour savoir si son site va
    bien. Six échanges ont été perdus sur exactement cela.
  */
  const secret = process.env.CRON_SECRET?.trim();
  const parSecret = secret !== undefined && request.headers.get('authorization') === `Bearer ${secret}`;

  if (secret && !parSecret && !(await estProprietaire())) {
    return refusExplique(request.headers.get('authorization'));
  }

  const points = diagnostiquer({
    env: process.env,
    buildStamp: BUILD_STAMP,
    spotCount: SPOTS.length,
    spotSlugs: SPOTS.map((spot) => spot.slug),
    uploadsDir: uploadsDir(),
    appDir: process.cwd(),
  });

  // L'état des migrations demande une requête, pas une variable : il ne peut
  // pas vivre dans le diagnostic purement synchrone.
  /*
    L'essai de connexion PRÉCÈDE l'état des migrations : si la base refuse,
    tout ce qui suit ne fait que répéter la même panne sous d'autres noms.
  */
  points.push(await essaiBase(process.env.DATABASE_URL));
  points.push(await etatMigrations());
  if (databaseEnabled()) points.push(await etatDesVisites());

  /*
    L'état des tables de marée conservées, quand elles le sont : c'est la
    réponse à « pourquoi telle page affiche encore des marées simulées ».
  */
  if (
    databaseEnabled() &&
    process.env.STORMGLASS_API_KEY?.trim() &&
    process.env.TIDE_PROVIDER !== 'mock'
  ) {
    points.push(
      await etatDesMareesConservees(
        new MysqlTideTableStore(),
        SPOTS.map((spot) => spot.slug),
      ),
    );
  }

  /*
    Un octet écrit, puis retiré. La configuration disait « les photos vont
    là » ; elle ne disait pas que « là » refusait l'écriture, et c'est
    pourtant ce qui se passait en production.
  */
  const photos = await essaiPhotos(uploadsDir());
  points.push(photos);
  // Chercher OÙ l'on peut écrire n'a d'intérêt que si l'on ne peut pas
  // écrire là où l'on a pointé — et cet essai touche plusieurs dossiers.
  if (photos.etat !== 'ok') points.push(await emplacementsPossibles(process.env, process.cwd()));

  /*
    L'essai SMTP ouvre une vraie connexion. On ne le fait que sur demande
    explicite (`?smtp=1`) : le diagnostic ordinaire doit rester instantané et
    sans effet de bord, et une route qu'on peut faire se connecter en boucle
    à un tiers est un levier gratuit.
  */
  /*
    L'audit relit CHAQUE photo du disque. Sur demande explicite seulement,
    comme l'essai SMTP : le diagnostic ordinaire doit rester instantané, et
    une route qu'on peut faire lire des centaines de fichiers en boucle est un
    levier gratuit.

    C'est la seule façon honnête de vérifier la promesse : le CDN de
    l'hébergeur ré-encode les images qu'il sert, donc en télécharger une et
    l'inspecter décrit le CDN, pas le fichier stocké.
  */
  if (request.nextUrl.searchParams.get('photos') === '1') {
    points.push(await auditPhotos(uploadsDir()));
  }

  if (request.nextUrl.searchParams.get('smtp') === '1') {
    points.push(await essaiSmtp(process.env.EMAIL_SERVER, process.env.EMAIL_FROM));
  }

  const verdict = verdictGlobal(points);

  return NextResponse.json(
    {
      ok: verdict !== 'absent',
      verdict,
      resume: {
        ok: points.filter((p) => p.etat === 'ok').length,
        attention: points.filter((p) => p.etat === 'attention').length,
        absent: points.filter((p) => p.etat === 'absent').length,
      },
      // Les points en défaut d'abord : c'est ce qu'on vient chercher.
      points: [...points].sort((a, b) => rang(a.etat) - rang(b.etat)),
    },
    {
      headers: {
        'cache-control': 'no-store',
        // Le charset est DÉCLARÉ : sans lui, un navigateur ou un terminal
        // devine, et « réglages » devient « rÃ©glages » dans ce qu'on colle.
        'content-type': 'application/json; charset=utf-8',
      },
    },
  );
}

function rang(etat: 'ok' | 'attention' | 'absent'): number {
  return etat === 'absent' ? 0 : etat === 'attention' ? 1 : 2;
}
