import { z } from 'zod';

/**
 * Forme des réponses Stormglass pour `/v2/tide/extremes/point`.
 *
 * L'API renvoie une liste d'extremums déjà structurée — contrairement à
 * Open-Meteo et ses tableaux parallèles. `meta` porte le quota, qu'on journalise
 * : sur une offre à dix appels par jour, savoir où l'on en est n'est pas un
 * détail.
 */
export const stormglassExtremeSchema = z.object({
  time: z.string(),
  height: z.number(),
  type: z.enum(['high', 'low']),
});

export const stormglassTideSchema = z.object({
  data: z.array(stormglassExtremeSchema),
  meta: z
    .object({
      datum: z.string().optional(),
      requestCount: z.number().optional(),
      dailyQuota: z.number().optional(),
      cost: z.number().optional(),
    })
    .optional(),
});

export type StormglassTide = z.infer<typeof stormglassTideSchema>;

/** Stormglass signale ses refus dans `errors`, avec un code 4xx. */
export const stormglassErrorSchema = z.object({
  errors: z.record(z.string(), z.unknown()),
});
