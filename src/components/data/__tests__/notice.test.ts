import { describe, expect, it } from 'vitest';
import type { SourceMeta } from '@/lib/providers';
import { simulatedSources } from '../DemoDataNotice';

const source = (name: string, kind: SourceMeta['kind']): SourceMeta => ({
  name,
  kind,
  precision: '',
});

describe('sources simulées', () => {
  it('ne retient que ce qui est réellement inventé', () => {
    const sources = [
      source('Marées — modèle de démonstration Luna Marea', 'simulated'),
      source('Open-Meteo — modèles Marine & Forecast', 'forecast'),
      source('Météo marine — modèle de démonstration Luna Marea', 'simulated'),
    ];
    expect(simulatedSources(sources)).toHaveLength(2);
  });

  it('ne retient rien quand tout est réel ou calculé', () => {
    const sources = [
      source('Stormglass — modèle de marée', 'forecast'),
      source('Calcul astronomique local', 'computed'),
      source('Catalogue Luna Marea', 'measured'),
    ];
    expect(simulatedSources(sources)).toHaveLength(0);
  });
});
