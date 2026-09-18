import type { Spot } from '@/data/schemas';
import { localDateKey, localHours } from '@/lib/time';
import type { ForecastDay, ForecastSlot } from './slots';

/**
 * « Ce soir » et « demain matin » plutôt qu'un classement.
 *
 * ─── Pourquoi pas un podium ───────────────────────────────────────────────
 *
 * La page d'accueil montrait les trois meilleurs créneaux, tous spots
 * confondus et toutes heures confondues. C'est un CLASSEMENT, pas un
 * conseil : il répond à « quel est le meilleur score du catalogue ? », une
 * question que personne ne se pose. Un pêcheur se demande s'il sort ce soir
 * ou demain à l'aube — les deux moments où l'on pêche réellement du bord.
 *
 * On cherche donc le meilleur créneau DANS une fenêtre horaire nommée, ce
 * qui donne une phrase actionnable : « ce soir 19 h – 21 h, Gravelines ».
 */

export interface Moment {
  /** Identifiant stable, pour les clés de rendu. */
  cle: 'ce-soir' | 'demain-matin';
  titre: string;
  spot: Spot;
  slot: ForecastSlot;
}

/*
  ─── Pourquoi `localHours` et `localDateKey`, et pas un `Intl` local ──────

  La première version lisait l'heure avec
  `new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', hour12: false })`.
  En français, ce format rend « 02 h » — avec l'unité — et `Number('02 h')`
  vaut `NaN`. Or `NaN < 16` est faux, et `NaN >= 23` aussi : le filtre de
  fenêtre horaire ne rejetait donc RIEN. « Ce soir » retenait un créneau de
  deux heures du matin, et rien ne le signalait, puisque le filtre de jour
  civil, lui, fonctionnait — la page affichait un créneau plausible.

  Les deux helpers de `@/lib/time` existaient déjà, testés et corrects. La
  leçon n'est pas « attention à `Intl` » : c'est qu'une conversion de temps
  ne se réécrit pas en local.
*/

export interface FenetreHoraire {
  cle: Moment['cle'];
  titre: string;
  /** Heure locale de début, incluse. */
  de: number;
  /** Heure locale de fin, exclue. */
  a: number;
  /** 0 = aujourd'hui, 1 = demain, dans le fuseau du spot. */
  joursApres: 0 | 1;
}

/**
 * Les deux fenêtres. Le crépuscule et l'aube, larges, parce que l'heure du
 * coucher de soleil varie de quatre heures entre décembre et juin.
 */
export const FENETRES: readonly FenetreHoraire[] = [
  { cle: 'ce-soir', titre: 'Ce soir', de: 16, a: 23, joursApres: 0 },
  { cle: 'demain-matin', titre: 'Demain matin', de: 5, a: 12, joursApres: 1 },
];

/**
 * Le meilleur créneau de chaque fenêtre, parmi les spots fournis.
 *
 * Un créneau en conditions dangereuses n'est JAMAIS retenu, même s'il porte
 * le meilleur score : la règle de sécurité prime, et mettre en avant une
 * sortie dangereuse depuis la page d'accueil serait le pire endroit pour
 * l'oublier.
 *
 * Rend une fenêtre sans candidat comme absente plutôt qu'avec un créneau de
 * repli : « aucun créneau praticable ce soir » est une information, un
 * créneau médiocre présenté comme le meilleur n'en est pas une.
 */
export function momentsFor(
  spots: readonly { spot: Spot; days: readonly ForecastDay[] }[],
  maintenant: Date,
): Moment[] {
  const moments: Moment[] = [];

  for (const fenetre of FENETRES) {
    let meilleur: Moment | null = null;

    for (const { spot, days } of spots) {
      const aujourdhui = localDateKey(maintenant, spot.timezone);
      const vise = localDateKey(
        new Date(maintenant.getTime() + fenetre.joursApres * 86_400_000),
        spot.timezone,
      );

      for (const jour of days) {
        for (const slot of jour.slots) {
          if (slot.score.value === null) continue;
          if (slot.score.safety.level === 'danger') continue;
          // Un créneau déjà passé ne se propose pas.
          if (new Date(slot.end).getTime() <= maintenant.getTime()) continue;

          const jourDuSlot = localDateKey(new Date(slot.start), spot.timezone);
          if (jourDuSlot !== vise) continue;
          // Sécurité : « ce soir » ne doit pas déborder sur demain si le
          // fuseau du spot a déjà changé de date.
          if (fenetre.joursApres === 0 && jourDuSlot !== aujourdhui) continue;

          const heure = localHours(new Date(slot.start), spot.timezone);
          if (heure < fenetre.de || heure >= fenetre.a) continue;

          if (meilleur === null || slot.score.value > (meilleur.slot.score.value ?? -1)) {
            meilleur = { cle: fenetre.cle, titre: fenetre.titre, spot, slot };
          }
        }
      }
    }

    if (meilleur !== null) moments.push(meilleur);
  }

  return moments;
}
