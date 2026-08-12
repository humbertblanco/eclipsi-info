/**
 * Proves de l'adreça que surt de la targeta d'un candidat.
 *
 * PER QUÈ AQUEST FITXER NOMÉS MIRA UNA COSA. Les xifres i les frases de
 * `SpotCard` ja es proven soles (`format.test.ts`, `strings.test.ts`) i la
 * llista sencera es prova a `SpotSearchPanel.test.tsx`, que ho diu ben clar:
 * «el contingut d'una targeta» no és cosa seva. L'única decisió que la targeta
 * pren tota sola és QUINA ADREÇA ENVIA quan es prem «Comparteix», i aquella no
 * la comparava ningú amb res.
 *
 * ── L'ERROR QUE HI HAVIA ────────────────────────────────────────────────────
 *
 * El botó muntava l'adreça sumant trossos: `origin + pathname +
 * buildShareLink(...)`. En aquella suma no hi ha cap lloc on posar el fragment,
 * i el fragment és la VISTA. Aquest botó només es pot prémer des de la vista de
 * llocs del mapa (`#/mapa/llocs`), o sigui que l'enllaç sortia sempre sense
 * fragment i qui el rebia obria el compte enrere: no veia la llista de
 * candidats que li acabaven d'ensenyar, que és tot el motiu pel qual algú envia
 * aquest enllaç. `buildShareUrl` existia des del primer dia per a això exacte i
 * no el cridava ningú.
 *
 * ── QUÈ COMPARA AIXÒ AMB LA REALITAT ────────────────────────────────────────
 *
 * El text que el component EMET de debò —el que rep `navigator.share`— contra
 * les dues construccions possibles, per a un joc de camins reals: l'arrel, el
 * subdirectori de desplegament, l'idioma al camí, i amb fragment i sense.
 *
 * La construcció a mà es torna a escriure aquí dins, amb el mateix
 * `buildShareLink` de producció, i hi és a posta: cada cas afirma que l'adreça
 * emesa és exactament aquella MÉS el fragment. Si algú torna a sumar trossos
 * dins del component, els quatre casos amb fragment cauen amb la diferència a
 * la vista, que és exactament el que ha de passar.
 *
 * ── EL QUE NO ES PROVA AQUÍ ─────────────────────────────────────────────────
 *
 * Què fa `buildShareUrl` amb consultes rares o amb un `destinationHash`: això
 * és de `share/link.test.ts`, que corre a Node i no ha de muntar cap DOM per
 * saber-ho. Aquí la pregunta és una altra: si el component el fa servir.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { SpotResult } from '../../core/spots/types';
import { buildShareLink, parseShareLink } from '../share';
import { SpotCard } from './SpotCard';
import { sp } from './strings';

const ECLIPSI = '2026-08-12';

/**
 * Un candidat complet. Els números són de l'ordre dels d'un lloc a 8 km al
 * nord-oest de Tafalla, i els que decideixen aquesta prova són només dos: la
 * latitud i la longitud, que són el que ha de viatjar per l'enllaç.
 *
 * ES TORNA A ESCRIURE I NO S'IMPORTA de `SpotSearchPanel.test.tsx`: importar
 * d'un fitxer de proves n'executaria les proves aquí dins. Trenta camps
 * duplicats és el preu, i és més barat que dues bateries que es disparen l'una
 * a l'altra.
 */
const CANDIDAT: SpotResult = {
  id: 'g-42.60--1.70',
  lat: 42.601,
  lon: -1.702,
  elevation: 612,
  distanceKm: 8.4,
  bearingDeg: 315,
  score: 87,
  parts: { centralSeconds: 0.9, clearance: 0.8, closeness: 0.7, altitude: 0.6 },
  detail: 'full',
  centralVisibleSec: 101,
  centralTotalSec: 101,
  centralLostSec: 0,
  clearanceDeg: 1.4,
  horizonAltitudeDeg: 5.5,
  blockingDistanceKm: 12.3,
  climbToRecoverM: null,
  sunAzimuthDeg: 283.7,
  sunAltitudeDeg: 6.9,
  midCentralMs: Date.UTC(2026, 7, 12, 20, 29, 0),
  status: 'central-visible',
  edgeUncertain: false,
  coverage: 1,
};

/**
 * El full natiu de compartir, que jsdom no té.
 *
 * NO DECIDEIX RES: només apunta l'adreça que li arriba i diu que sí. La
 * targeta prefereix aquest camí quan `navigator.share` existeix, i és el que
 * fa que el text a examinar sigui el que de debò aniria a WhatsApp.
 *
 * Es posa amb `defineProperty` i no amb `vi.stubGlobal('navigator', …)` perquè
 * el segon substituiria el `navigator` sencer i React i testing-library també
 * en llegeixen coses. Es treu al `afterEach` d'aquest fitxer: el `afterEach`
 * de `tests/dom-setup.ts` desfà els `stubGlobal` i no els `defineProperty`.
 */
function capturaEnllaços(): string[] {
  const enviats: string[] = [];
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    writable: true,
    value: (data: ShareData) => {
      enviats.push(data.url ?? '');
      return Promise.resolve();
    },
  });
  return enviats;
}

afterEach(() => {
  Reflect.deleteProperty(navigator, 'share');
});

/** Posa la barra del navegador on diu el camí. Mateix origen: jsdom no en té dos. */
function situaA(camí: string): void {
  window.history.replaceState(null, '', camí);
}

const botóCompartir = (): HTMLElement =>
  screen.getByRole('button', { name: sp('card.share', 'ca') });

/** Prem «Comparteix» i torna l'adreça que ha sortit del botó. */
async function enllaçEmès(): Promise<string> {
  const enviats = capturaEnllaços();
  // La xarxa, tancada, com fa la prova del panell: `useSpotPlaceName` demana el
  // topònim del candidat i una prova que el deixi sortir depèn d'un servei de
  // fora per passar. Sense nom, l'enllaç no porta `n=`, que és exactament el
  // que passa quan es comparteix des d'un cim sense cobertura.
  vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('sense xarxa'))));
  render(<SpotCard spot={CANDIDAT} rank={1} locale="ca" eclipseId={ECLIPSI} />);
  fireEvent.click(botóCompartir());
  await waitFor(() => expect(enviats).toHaveLength(1));
  return enviats[0];
}

/**
 * L'adreça tal com es muntava abans, amb el `buildShareLink` de producció.
 * Es llegeix el `location` en el moment de cridar-la, igual que feia el
 * component: aquí no hi ha cap còpia de res, hi ha la mateixa suma.
 */
function comEsMuntavaAMà(): string {
  return `${window.location.origin}${window.location.pathname}${buildShareLink({
    lat: CANDIDAT.lat,
    lon: CANDIDAT.lon,
    eclipseId: ECLIPSI,
    label: null,
  })}`;
}

interface Cas {
  què: string;
  /** On és qui comparteix, tal com ho diria la barra del navegador. */
  ara: string;
  /** L'adreça que ha de sortir del botó, sense l'origen, que aquí no es prova. */
  enllaç: string;
}

/*
 * ELS CAMINS SÓN ELS DE DEBÒ. L'app es desplega a l'arrel d'`eclipsi.info` però
 * ha viscut en un subdirectori (`/eclipsi/`, vegeu ESTAT.md §1) i els idiomes
 * van al camí (`/es/`, `/fr/`), o sigui que les tres formes existeixen alhora.
 * El `?p=` que ja hi ha a la barra és el punt de qui comparteix i no el del
 * candidat: que el de sortida sigui un altre és part del que es comprova.
 */
const CASOS: Cas[] = [
  {
    què: 'l’arrel, amb la vista de llocs oberta',
    ara: '/?p=42.531,-1.675&e=2026-08-12#/mapa/llocs',
    enllaç: '/?p=42.601,-1.702&e=2026-08-12#/mapa/llocs',
  },
  {
    què: 'el subdirectori de desplegament',
    ara: '/eclipsi/?p=42.531,-1.675&e=2026-08-12#/mapa/llocs',
    enllaç: '/eclipsi/?p=42.601,-1.702&e=2026-08-12#/mapa/llocs',
  },
  {
    què: 'l’idioma al camí',
    ara: '/es/?p=42.531,-1.675&e=2026-08-12#/mapa/llocs',
    enllaç: '/es/?p=42.601,-1.702&e=2026-08-12#/mapa/llocs',
  },
  {
    què: 'l’idioma dins del subdirectori',
    ara: '/eclipsi/fr/?p=42.531,-1.675&e=2026-08-12#/mapa/llocs',
    enllaç: '/eclipsi/fr/?p=42.601,-1.702&e=2026-08-12#/mapa/llocs',
  },
  {
    què: 'sense fragment no se’n fabrica cap',
    ara: '/?p=42.531,-1.675&e=2026-08-12',
    enllaç: '/?p=42.601,-1.702&e=2026-08-12',
  },
];

describe('SpotCard · l’enllaç d’un candidat', () => {
  for (const cas of CASOS) {
    it(`conserva el camí i la vista: ${cas.què}`, async () => {
      situaA(cas.ara);

      const emès = await enllaçEmès();
      const esperat = `${window.location.origin}${cas.enllaç}`;

      expect(emès).toBe(esperat);

      /*
       * LA COMPARACIÓ QUE ÉS TOTA LA PROVA. L'adreça emesa ha de ser la suma
       * de trossos MÉS el fragment, ni un caràcter més ni un de menys. Diu dues
       * coses alhora: que el helper no s'inventa res que la construcció a mà no
       * tingués (el camí i la consulta són idèntics) i que l'única diferència
       * entre les dues és justament el que la de mà no pot portar.
       */
      const fragment = new URL(esperat).hash;
      expect(emès).toBe(`${comEsMuntavaAMà()}${fragment}`);

      // I la que decideix: amb fragment, la construcció a mà NO és aquesta. Si
      // algú hi torna, aquesta línia és la que ho diu amb totes les lletres.
      if (fragment !== '') expect(comEsMuntavaAMà()).not.toBe(emès);
    });
  }

  it('el punt que viatja és el del candidat i no el de qui comparteix', async () => {
    /*
     * La barra ja porta un `?p=` —el punt de l'usuari, que l'app hi escriu a
     * cada moviment— i l'enllaç d'un candidat ha de substituir-lo sencer. Si
     * s'hi acumulés o s'hi quedés el vell, qui rebés l'enllaç obriria un lloc
     * que no és el que li han recomanat, i vuit quilòmetres al nord-oest són
     * quaranta segons de diferència.
     */
    situaA('/?p=42.531,-1.675&e=2026-08-12&n=Tafalla#/mapa/llocs');

    const emès = await enllaçEmès();
    const tornada = parseShareLink(new URL(emès).search);

    expect(tornada).toEqual({
      lat: CANDIDAT.lat,
      lon: CANDIDAT.lon,
      eclipseId: ECLIPSI,
      // Sense xarxa no hi ha topònim del candidat, i el «Tafalla» de qui
      // comparteix no es pot quedar enganxat: seria posar un nom a un lloc que
      // és a 8 km d'allà.
      label: null,
    });
  });

  it('una vista que aquesta versió no coneix es respecta igual', async () => {
    /*
     * El fragment no és nostre per definició: pot venir d'una versió futura
     * amb una pantalla que aquesta encara no té, o de qualsevol altra cosa
     * enganxada a l'adreça. Esborrar-lo en compartir seria decidir per l'altre.
     * `parseHashRoute` ja el llegeix amb desconfiança quan arriba; aquí només
     * s'ha de deixar passar.
     */
    situaA('/#/mapa/vista-que-encara-no-existeix');

    expect(new URL(await enllaçEmès()).hash).toBe('#/mapa/vista-que-encara-no-existeix');
  });
});
