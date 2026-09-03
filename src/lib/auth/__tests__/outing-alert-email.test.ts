import { describe, expect, it } from 'vitest';

import { outingAlertEmail, type OutingAlertContent } from '../email-template';

/*
  Le courriel de la veille a trois visages, et l'ordre entre eux n'est pas
  négociable : le DANGER passe avant tout, y compris avant un bon score. Un
  message qui titrerait « 8,7 — Excellent » avec, plus bas, « ne sortez pas »
  serait lu à moitié par la personne qui a déjà chargé la voiture.

  Le parcours de bout en bout ne peut exercer que le cas que la météo simulée
  produit ce jour-là. Ces tests fixent les trois branches sans dépendre du
  temps qu'il fait.
*/

const base: OutingAlertContent = {
  spotName: 'Pen Hat',
  spotUrl: 'https://moonfish.nssbelhaj.com/spots/france/bretagne/pen-hat/prevision',
  when: 'jeudi 4 septembre, 06:00',
  danger: false,
  dangerMessage: null,
  score: 7.4,
  tierLabel: 'Bon',
  belowThreshold: false,
  minScore: null,
  facts: [
    { label: 'Marée', value: 'montante, coefficient 88' },
    { label: 'Vent', value: '18 km/h NO' },
  ],
  note: null,
  accountUrl: 'https://moonfish.nssbelhaj.com/compte',
  host: 'moonfish.nssbelhaj.com',
};

describe('outingAlertEmail', () => {
  it('cas ordinaire : le sujet porte le score et le palier', () => {
    const m = outingAlertEmail(base);
    expect(m.subject).toBe('Vos conditions à Pen Hat jeudi 4 septembre, 06:00 : 7,4 / 10 · Bon');
    expect(m.text).toContain('Score prévu : 7,4 / 10 · Bon');
    expect(m.text).toContain('Marée : montante, coefficient 88');
    expect(m.text).not.toContain('NE SORTEZ PAS');
    // La sortie de la liste est toujours proposée, et depuis le compte.
    expect(m.text).toContain(base.accountUrl);
  });

  it('sous le seuil : le sujet le dit en premier, le seuil est rappelé', () => {
    const m = outingAlertEmail({ ...base, score: 4.2, tierLabel: 'Passable', belowThreshold: true, minScore: 6 });
    expect(m.subject.startsWith('Sous votre seuil')).toBe(true);
    expect(m.text).toContain('sous le seuil de 6');
  });

  it('DANGER : prime sur tout, même un bon score', () => {
    const m = outingAlertEmail({
      ...base,
      danger: true,
      dangerMessage: 'Houle de 3,1 m : risque de vague de bord.',
      score: 8.7,
      tierLabel: 'Danger',
      belowThreshold: false,
    });
    expect(m.subject.startsWith('Danger — ne sortez pas')).toBe(true);
    expect(m.text.startsWith('NE SORTEZ PAS. Houle de 3,1 m')).toBe(true);
    expect(m.html).toContain('Ne sortez pas.');
  });

  it('score indisponible : ni chiffre inventé, ni « 0 »', () => {
    const m = outingAlertEmail({ ...base, score: null, tierLabel: 'indisponible' });
    expect(m.subject).toContain('indisponible');
    expect(m.text).not.toMatch(/0,0 \/ 10/);
  });

  it('la note personnelle est reprise telle quelle', () => {
    const m = outingAlertEmail({ ...base, note: 'prendre les leurres souples' });
    expect(m.text).toContain('Votre note : prendre les leurres souples');
  });
});
