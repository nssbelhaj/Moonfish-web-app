import { describe, expect, it } from 'vitest';

import { SPOTS } from '@/data/spots';
import { getSpotForecast } from '@/lib/forecast';
import { previsionEnJson, sourceEnJson } from '@/lib/api/serialisation';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  Une donnée qui circule sans sa provenance est un défaut
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * C'est la règle que ce projet tient depuis le début, et l'API est l'endroit
 * où elle risque le plus de se perdre : il suffirait d'oublier un champ dans
 * une sérialisation pour que l'application affiche une marée inventée sans
 * pouvoir dire qu'elle l'est. Sur le site, le cadre pointillé et
 * `DataSourceTag` s'en chargent ; sur le téléphone, il n'y a que ce JSON.
 */

const MAINTENANT = new Date('2026-09-01T09:00:00Z');

describe('« sources » voyage avec les données', () => {
  it('accompagne chaque prévision, pour les trois familles de données', async () => {
    const json = previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT));

    expect(Object.keys(json.sources).sort()).toStrictEqual(['astro', 'tide', 'weather']);
  });

  it('porte tout ce qu’il faut pour afficher l’âge d’une donnée hors ligne', async () => {
    const json = previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT));

    for (const [nom, source] of Object.entries(json.sources)) {
      expect(source.name, `${nom} sans nom de source`).toBeTruthy();
      expect(['measured', 'forecast', 'computed', 'simulated']).toContain(source.kind);
      expect(source.precision, `${nom} sans précision annoncée`).toBeTruthy();
      /*
        Ces quatre champs sont ce qui permet d'écrire « prévision du 12
        septembre à 18 h, pas rafraîchie depuis ». Sans `refreshedAt`,
        l'application afficherait l'heure de son propre appel — et une table
        sortie d'un cache de 24 h se présenterait comme fraîche de la minute,
        exactement le défaut que `SourceStatus` a été créé pour corriger.
      */
      expect(Object.keys(source)).toContain('refreshedAt');
      expect(Object.keys(source)).toContain('validityHours');
      expect(Object.keys(source)).toContain('degraded');
      expect(Object.keys(source)).toContain('url');
    }
  });

  it('annonce « simulated » quand la marée est simulée, sans l’habiller', async () => {
    // La suite force `TIDE_PROVIDER=mock` : la marée DOIT se déclarer simulée.
    const json = previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT));

    expect(json.sources.tide.kind).toBe('simulated');
  });

  it('distingue un repli après panne d’un mode démonstration choisi', () => {
    const demo = sourceEnJson({
      source: { name: 'Modèle de démonstration', kind: 'simulated', precision: 'onde M2' },
      refreshedAt: '2026-09-01T09:00:00.000Z',
    });
    const panne = sourceEnJson({
      source: {
        name: 'Modèle de démonstration',
        kind: 'simulated',
        precision: 'onde M2',
        degraded: true,
      },
      refreshedAt: '2026-09-01T09:00:00.000Z',
    });

    /*
      Les deux rendent `simulated`, et ils ne veulent pas dire la même chose.
      Un voyant « Interrompu » allumé en permanence sur une démonstration
      apprend à ne plus le regarder — et le jour d'une vraie panne, plus
      personne ne le voit.
    */
    expect(demo.degraded).toBe(false);
    expect(panne.degraded).toBe(true);
  });

  it('résout la durée de validité au lieu de laisser le client la deviner', () => {
    const declaree = sourceEnJson({
      source: { name: 'Stormglass', kind: 'forecast', precision: '…', validityHours: 72 },
      refreshedAt: null,
    });
    const parDefaut = sourceEnJson({
      source: { name: 'Open-Meteo', kind: 'forecast', precision: '…' },
      refreshedAt: null,
    });
    const calculee = sourceEnJson({
      source: { name: 'Calcul local', kind: 'computed', precision: '…' },
      refreshedAt: null,
    });

    expect(declaree.validityHours).toBe(72);
    expect(parDefaut.validityHours).toBe(6);
    // L'astronomie ne périme pas : `null` est une valeur, pas un oubli.
    expect(calculee.validityHours).toBeNull();
  });

  it('survit à un aller-retour JSON', async () => {
    const json = JSON.parse(
      JSON.stringify(previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT))),
    );

    expect(json.sources.tide.kind).toBeTruthy();
    expect(json.sources.weather.kind).toBeTruthy();
    expect(json.sources.astro.kind).toBeTruthy();
  });
});

describe('ce que la prévision publiée contient, et ce qu’elle ne contient pas', () => {
  it('rend sept jours de douze créneaux', async () => {
    const json = previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT));

    expect(json.days).toHaveLength(7);
    for (const jour of json.days) expect(jour.slots).toHaveLength(12);
  });

  it('garde les créneaux dont une source manque, au lieu de les effacer', async () => {
    const json = previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT));
    const creneaux = json.days.flatMap((jour) => jour.slots);

    // Supprimer un créneau sans données ferait disparaître deux heures de la
    // journée sans rien expliquer : une panne ressemblerait à un trou naturel.
    expect(creneaux).toHaveLength(84);
  });

  it('ne rend jamais 0 pour un facteur dont la source manque', async () => {
    const json = previsionEnJson(await getSpotForecast(SPOTS[0]!, MAINTENANT));

    for (const creneau of json.days.flatMap((jour) => jour.slots)) {
      for (const facteur of Object.values(creneau.score.breakdown)) {
        if (facteur.score === null) {
          // Poids effectif nul, mais poids nominal conservé : c'est ce qui
          // permet d'afficher « écarté du calcul (pesait 20 %) ».
          expect(facteur.weight).toBe(0);
          expect(facteur.nominalWeight).toBeGreaterThan(0);
        }
      }
    }
  });
});
