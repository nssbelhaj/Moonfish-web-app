import { z } from 'zod';

import { MOT_DE_PASSE_MAX, MOT_DE_PASSE_MIN } from '@/lib/auth/password-regles';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Inscription et connexion classiques
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces schémas sont appliqués DEUX FOIS sur le trajet d'un formulaire : une
 * fois à la réception, une fois avant l'écriture. Ils doivent donc accepter
 * leur propre sortie — c'est la règle d'idempotence du projet, et
 * `schemas-compte.test.ts` la vérifie.
 */

/** Âge minimum du consentement numérique en France (RGPD art. 8, transposition française). */
export const AGE_MINIMUM = 15;

const email = z
  .string({ required_error: 'Indiquez votre adresse e-mail.' })
  .trim()
  .toLowerCase()
  .min(5, 'Adresse e-mail trop courte.')
  .max(255, 'Adresse e-mail trop longue.')
  .regex(/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/, 'Cette adresse e-mail n’est pas valide.');

/**
 * Le mot de passe n'est ni rogné ni normalisé en casse.
 *
 * Un espace en début ou en fin FAIT PARTIE du mot de passe : le rogner
 * accepterait à la connexion une saisie différente de celle enregistrée, ou
 * l'inverse. C'est la seule chaîne de ce projet qu'on ne nettoie pas.
 */
const motDePasse = z
  .string({ required_error: 'Choisissez un mot de passe.' })
  .min(MOT_DE_PASSE_MIN, `Le mot de passe fait ${MOT_DE_PASSE_MIN} caractères au minimum.`)
  .max(MOT_DE_PASSE_MAX, 'Mot de passe trop long.');

const nom = (champ: string) =>
  z
    .string({ required_error: `Indiquez votre ${champ}.` })
    .trim()
    .min(2, `${champ.charAt(0).toUpperCase()}${champ.slice(1)} trop court.`)
    .max(60, `${champ.charAt(0).toUpperCase()}${champ.slice(1)} trop long.`);

/**
 * Date de naissance : une DATE, sans heure ni fuseau.
 *
 * `new Date('2001-04-12')` donne minuit UTC ; affiché à Paris en été, c'est
 * le 12 avril à 2 h, et une comparaison naïve fait basculer l'anniversaire
 * d'un jour. On garde donc la chaîne « AAAA-MM-JJ » et on compare des nombres.
 */
const dateDeNaissance = z
  .string({ required_error: 'Indiquez votre date de naissance.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date de naissance invalide.')
  .refine((valeur) => {
    const [a, m, j] = valeur.split('-').map(Number);
    const date = new Date(Date.UTC(a!, m! - 1, j!));
    return (
      date.getUTCFullYear() === a && date.getUTCMonth() === m! - 1 && date.getUTCDate() === j
    );
  }, 'Cette date n’existe pas.');

/** Âge révolu, en années, à la date donnée. */
export function ageA(naissance: string, aujourdhui: Date = new Date()): number {
  const [a, m, j] = naissance.split('-').map(Number);
  let age = aujourdhui.getUTCFullYear() - a!;

  const moisPasse = aujourdhui.getUTCMonth() + 1 > m!;
  const memeMoisJourPasse = aujourdhui.getUTCMonth() + 1 === m! && aujourdhui.getUTCDate() >= j!;
  if (!moisPasse && !memeMoisJourPasse) age -= 1;

  return age;
}

export const inscriptionSchema = z
  .object({
    email,
    password: motDePasse,
    passwordConfirm: z.string(),
    firstName: nom('prénom'),
    lastName: nom('nom'),
    birthDate: dateDeNaissance,
    consentement: z.literal('oui', {
      errorMap: () => ({
        message: 'Il faut accepter la politique de confidentialité pour créer un compte.',
      }),
    }),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'Les deux mots de passe ne sont pas identiques.',
    path: ['passwordConfirm'],
  })
  .refine((v) => ageA(v.birthDate) >= AGE_MINIMUM, {
    message: `L’inscription est réservée aux ${AGE_MINIMUM} ans et plus.`,
    path: ['birthDate'],
  })
  .refine((v) => ageA(v.birthDate) < 120, {
    message: 'Date de naissance invalide.',
    path: ['birthDate'],
  });

export type InscriptionInput = z.infer<typeof inscriptionSchema>;

export const connexionSchema = z.object({
  email,
  password: z.string().min(1, 'Indiquez votre mot de passe.').max(MOT_DE_PASSE_MAX),
});

export type ConnexionInput = z.infer<typeof connexionSchema>;

export const motDePasseOublieSchema = z.object({ email });

export const nouveauMotDePasseSchema = z
  .object({
    token: z.string().min(16, 'Lien de réinitialisation invalide.'),
    password: motDePasse,
    passwordConfirm: z.string(),
  })
  .refine((v) => v.password === v.passwordConfirm, {
    message: 'Les deux mots de passe ne sont pas identiques.',
    path: ['passwordConfirm'],
  });

/**
 * Champ libre facultatif : vide devient `null`, jamais chaîne vide.
 *
 * La distinction compte en base : une chaîne vide dit « renseigné avec
 * rien », `null` dit « pas renseigné ». L'affichage n'a pas à deviner.
 */
const facultatif = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable();

export const profilSchema = z.object({
  firstName: facultatif(60, 'Prénom trop long.'),
  lastName: facultatif(60, 'Nom trop long.'),
  city: facultatif(80, 'Nom de ville trop long.'),
  country: facultatif(60, 'Nom de pays trop long.'),
  bio: facultatif(280, 'Présentation trop longue (280 caractères au maximum).'),
});

export type ProfilInput = z.infer<typeof profilSchema>;

/**
 * Préférences d'envoi.
 *
 * Une case non cochée n'est PAS transmise par un formulaire HTML : son
 * absence vaut « non ». Lire `formData.get(...) === 'oui'` traite donc
 * correctement les deux cas, là où un schéma booléen strict refuserait
 * l'absence.
 */
export const preferencesSchema = z.object({
  notifyOutings: z.boolean(),
  notifyNews: z.boolean(),
});
