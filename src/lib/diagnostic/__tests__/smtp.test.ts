import { describe, expect, it } from 'vitest';

import { essaiSmtp } from '../smtp';

/*
  Ces tests ouvrent de vraies connexions — vers un port fermé, ce qui échoue
  en quelques millisecondes et sans réseau sortant. C'est le seul moyen
  d'exercer la traduction des erreurs du serveur : la simuler reviendrait à
  vérifier que nos propres chaînes se ressemblent.
*/

const MOT_DE_PASSE = 'MotDePasseTresReconnaissable';

describe('l’essai de connexion au serveur d’envoi', () => {
  it('sans EMAIL_SERVER : le dit, plutôt que d’échouer', async () => {
    const p = await essaiSmtp(undefined, 'contact@lunamarea.fr');
    expect(p.etat).toBe('absent');
    expect(p.constat).toContain('absente');
  });

  it('URL illisible : donne la forme attendue', async () => {
    const p = await essaiSmtp('ceci-nest-pas-une-url', 'contact@lunamarea.fr');
    expect(p.etat).toBe('absent');
    expect(p.remede).toContain('smtp://');
  });

  it('port fermé : nomme le port comme piste, pas les identifiants', async () => {
    // Le port 1 est réservé et fermé : refus immédiat, aucun réseau sortant.
    const p = await essaiSmtp(`smtp://contact%40lunamarea.fr:${MOT_DE_PASSE}@127.0.0.1:1`, 'contact@lunamarea.fr');

    expect(p.etat).toBe('absent');
    expect(p.remede).toContain('587');
  });

  it('ne recopie JAMAIS le mot de passe, quoi que dise le serveur', async () => {
    /*
      Cette sortie est faite pour être collée dans un message. Le message
      d'erreur vient du serveur distant : on ne contrôle pas ce qu'il contient,
      donc on retire le mot de passe avant de le rendre.
    */
    const p = await essaiSmtp(`smtp://contact%40lunamarea.fr:${MOT_DE_PASSE}@127.0.0.1:1`, 'contact@lunamarea.fr');

    expect(JSON.stringify(p)).not.toContain(MOT_DE_PASSE);
  });

  it('nomme quand même l’hôte joint : c’est lui qui trahit une URL coupée', async () => {
    const p = await essaiSmtp(`smtp://u:${MOT_DE_PASSE}@127.0.0.1:1`, 'contact@lunamarea.fr');
    expect(p.constat).toContain('127.0.0.1:1');
  });
});
