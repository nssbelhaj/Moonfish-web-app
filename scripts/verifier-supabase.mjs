#!/usr/bin/env node
/*
  Vérification d'un projet Supabase RÉEL.

    node scripts/verifier-supabase.mjs
    node scripts/verifier-supabase.mjs --ecrire   (teste aussi une insertion)

  Pourquoi ce script existe : le code des comptes a été écrit d'après le
  contrat documenté de Supabase, jamais contre un vrai projet. La première mise
  en service est donc le moment où l'on découvre ce qui manque — une migration
  non exécutée, un seau absent, une politique oubliée. Autant le découvrir en
  trente secondes et avec un message qui nomme le correctif, plutôt qu'en
  cliquant dans l'interface en se demandant pourquoi rien ne s'enregistre.

  Il ne lit QUE ce qu'un visiteur anonyme peut lire. Les contrôles de sécurité
  sont donc faits dans le bon sens : on vérifie que ce qui doit être fermé
  REFUSE, pas qu'on a le droit d'entrer.
*/

import { readFileSync } from 'node:fs';

const WRITE_TEST = process.argv.includes('--ecrire');

/** Lit .env.local sans dépendance : le script doit marcher sur un clone nu. */
function loadEnvFile() {
  try {
    for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      const [, key, raw] = match;
      if (!process.env[key]) process.env[key] = raw.replace(/^["']|["']$/g, '');
    }
  } catch {
    // Pas de fichier : les variables viennent peut-être de l'environnement.
  }
}

loadEnvFile();

const URL_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

if (!URL_BASE || !ANON) {
  console.error(
    'Il manque NEXT_PUBLIC_SUPABASE_URL et/ou NEXT_PUBLIC_SUPABASE_ANON_KEY.\n' +
      'Renseignez-les dans .env.local (voir .env.example) puis relancez.',
  );
  process.exit(2);
}

const headers = { apikey: ANON, authorization: `Bearer ${ANON}` };
const results = [];

function record(ok, label, detail = '', blocking = true) {
  results.push({ ok, label, detail, blocking });
  const mark = ok ? '✓' : blocking ? '✗' : '!';
  console.log(`${mark} ${label}${detail ? `\n    ${detail}` : ''}`);
}

async function call(path, init = {}) {
  const started = Date.now();
  try {
    const response = await fetch(`${URL_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(15_000),
    });
    return { response, ms: Date.now() - started };
  } catch (error) {
    return { error, ms: Date.now() - started };
  }
}

console.log(`Projet : ${URL_BASE}\n`);

// ── 1. Le projet répond-il ? ───────────────────────────────────────────────
{
  const { response, error, ms } = await call('/auth/v1/health');

  if (error) {
    record(
      false,
      'Le projet répond',
      `Injoignable (${error.message}). Cause la plus fréquente : le projet est EN PAUSE.\n` +
        '    Relancez-le depuis le tableau de bord Supabase — aucune requête ne le réveille.',
    );
    console.log('\nRien d’autre ne peut être vérifié tant que le projet ne répond pas.');
    process.exit(1);
  }

  record(response.ok, 'Le projet répond', `${response.status} en ${ms} ms`);
}

// ── 2. Les tables publiques existent et sont lisibles ─────────────────────
for (const table of ['spot_reviews', 'catches']) {
  const { response, error } = await call(`/rest/v1/${table}?select=id&limit=1`);

  if (error || !response.ok) {
    const status = response?.status;
    record(
      false,
      `Table « ${table} » lisible par un visiteur`,
      status === 404
        ? 'Table absente : la migration n’a pas été exécutée.\n' +
            '    Ouvrez supabase/migrations/0001_comptes_et_contributions.sql dans l’éditeur SQL du projet.'
        : `Refusé (${status ?? error?.message}). La politique « select » publique manque.`,
    );
  } else {
    record(true, `Table « ${table} » lisible par un visiteur`);
  }
}

// ── 3. Ce qui doit être FERMÉ l'est-il ? ──────────────────────────────────
// Le contrôle le plus important du script : une table sans RLS est lisible par
// quiconque possède la clé publique, laquelle est dans chaque navigateur.
for (const [table, why] of [
  ['profiles', 'les profils ne doivent être lisibles que par leur propriétaire'],
  ['waitlist', 'la liste d’attente ne doit être lisible par personne'],
]) {
  const { response, error } = await call(`/rest/v1/${table}?select=*&limit=1`);

  if (error) {
    record(false, `Table « ${table} » fermée aux anonymes`, error.message);
    continue;
  }

  if (!response.ok) {
    record(true, `Table « ${table} » fermée aux anonymes`, `refus ${response.status}, correct`);
    continue;
  }

  const rows = await response.json().catch(() => null);
  const empty = Array.isArray(rows) && rows.length === 0;

  record(
    empty,
    `Table « ${table} » fermée aux anonymes`,
    empty
      ? 'aucune ligne rendue, comme prévu'
      : `FUITE : ${rows?.length} ligne(s) rendue(s) à un anonyme — ${why}.\n` +
          '    Vérifiez « enable row level security » et les politiques de la migration.',
  );
}

// ── 4. Le seau de photos ──────────────────────────────────────────────────
{
  const { response, error } = await call('/storage/v1/object/list/prises', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ limit: 1, prefix: '' }),
  });

  if (error) {
    record(false, 'Seau de photos « prises »', error.message);
  } else if (response.status === 404 || response.status === 400) {
    record(
      false,
      'Seau de photos « prises »',
      'Absent. Il est créé par la migration ; si elle a été exécutée avant que le\n' +
        '    stockage ne soit activé, créez-le à la main (public, nom « prises »).',
    );
  } else {
    record(true, 'Seau de photos « prises »', `réponse ${response.status}`);
  }
}

// ── 5. Insertion dans la liste d'attente (facultatif) ─────────────────────
if (WRITE_TEST) {
  const email = `verification-${Date.now()}@moonfish.invalid`;
  const { response, error } = await call('/rest/v1/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json', prefer: 'return=minimal' },
    body: JSON.stringify({ email, source: 'verification' }),
  });

  record(
    !error && response.ok,
    'Insertion anonyme dans la liste d’attente',
    error
      ? error.message
      : response.ok
        ? `ligne « ${email} » écrite — pensez à la supprimer depuis l’éditeur de tables`
        : `refusée (${response.status}) : la politique « insert » publique manque`,
  );
} else {
  console.log('· Insertion non testée (relancez avec --ecrire pour l’essayer)');
}

// ── Verdict ───────────────────────────────────────────────────────────────
const failures = results.filter((entry) => !entry.ok && entry.blocking);

console.log('');
if (failures.length === 0) {
  console.log('Tout est en place. Il reste à vérifier à la main ce qu’un script ne peut pas :');
  console.log('  · Authentication → URL Configuration : /auth/callback dans les « Redirect URLs » ;');
  console.log('  · l’envoi d’un lien de connexion, puis l’écriture d’un avis.');
  process.exit(0);
}

console.log(`${failures.length} point(s) à corriger avant d’ouvrir les comptes.`);
process.exit(1);
