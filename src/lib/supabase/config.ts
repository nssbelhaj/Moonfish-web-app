/**
 * Configuration Supabase, et le seul endroit qui décide si les comptes sont
 * ouverts.
 *
 * Règle du projet : rien ne fait semblant. Sans projet Supabase configuré, le
 * site ne montre pas un formulaire de connexion qui échouerait — il annonce que
 * les comptes ne sont pas ouverts. Un bouton « Se connecter » qui renvoie une
 * erreur est pire qu'un bouton absent : il fait douter l'utilisateur de son
 * adresse e-mail plutôt que de notre déploiement.
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

function readConfig(): SupabaseConfig | null {
  // Ces deux variables DOIVENT être littérales : Next remplace
  // `process.env.NEXT_PUBLIC_…` à la compilation, et une lecture dynamique
  // (`process.env[nom]`) ne serait pas substituée côté navigateur — elle vaudrait
  // `undefined` en production sans que rien n'échoue au build.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export const SUPABASE_CONFIG: SupabaseConfig | null = readConfig();

/** Les comptes et les contributions sont-ils réellement disponibles ? */
export function accountsEnabled(): boolean {
  return SUPABASE_CONFIG !== null;
}

/**
 * Clé de service, pour les seules opérations qu'un utilisateur ne peut pas
 * faire lui-même : supprimer son compte dans `auth.users`.
 *
 * Elle contourne toute la sécurité au niveau des lignes. Elle n'est donc jamais
 * exposée au navigateur — pas de préfixe `NEXT_PUBLIC_` — et n'est lue que
 * depuis un gestionnaire de route.
 */
export function serviceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

/**
 * Version du texte de consentement acceptée à l'inscription.
 *
 * Elle est stockée avec le profil. Sans elle, impossible de dire à quoi une
 * personne a consenti : « l'utilisateur a coché une case » n'est pas une preuve
 * de consentement éclairé si le texte a changé depuis.
 */
export const CONSENT_VERSION = '2026-09-01';
