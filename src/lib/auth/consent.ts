/**
 * Version du texte de consentement acceptée à l'inscription.
 *
 * Elle est stockée avec le profil. Sans elle, impossible de dire à quoi une
 * personne a consenti : « l'utilisateur a coché une case » n'est pas une preuve
 * de consentement éclairé si le texte a changé depuis.
 *
 * À incrémenter — c'est-à-dire à redater — dès que la politique de
 * confidentialité change sur ce à quoi les gens consentent. Un simple ajout de
 * précision ne compte pas ; une nouvelle finalité, si.
 */
export const CONSENT_VERSION = '2026-09-01';
