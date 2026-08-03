/**
 * Proves del panell de nuvolositat.
 *
 * PER QUÈ AQUEST COMPONENT. Perquè és l'únic de l'app que ensenya una xifra
 * que NO ÉS CERTA. L'astronomia és exacta al segon; el cel del dia 12 a les
 * 20:30 no el sap ningú. La capçalera de `CloudPanel.tsx` es compromet a una
 * cosa molt concreta —«l'edat de la dada i la fiabilitat surten SEMPRE, també
 * quan tot va bé, perquè si només apareixen quan hi ha problemes la seva
 * absència passa a voler dir que això és segur»— i un compromís d'aquesta mena
 * només és real si hi ha alguna cosa que el vigili. Aquesta bateria és això.
 *
 * QUÈ PROVA:
 *   · Que la fiabilitat i l'edat hi siguin fins i tot al cas que més convida a
 *     callar: cel net, dada acabada de baixar i tot en verd.
 *   · Que una PREVISIÓ i una CLIMATOLOGIA no es puguin confondre, que és tota
 *     la feina del panell: dues respostes a dues preguntes diferents, amb la
 *     insígnia al costat de la xifra gran i cadascuna amb la seva fila pròpia
 *     (antelació la primera, repartiment dels anys la segona) i sense la de
 *     l'altra.
 *   · Que el veredicte de fiabilitat que decideix el nucli arribi sencer a la
 *     pantalla: amb menys de dotze anys d'arxiu la climatologia baixa de
 *     «Mitjana» a «Baixa» i el panell ho ha de dir amb aquelles paraules.
 *   · Que allò que no s'ha consultat no es pinti com si s'hagués consultat: la
 *     climatologia conserva la geometria de la línia de visió però només mira
 *     el punt de l'observador, i llavors les píndoles de distància no hi són.
 *   · Que els quatre estats sense dada (sense lloc, carregant, avaria, avaria
 *     sense connexió) diguin cadascun una cosa diferent, i que una recàrrega
 *     amb dada anterior NO la faci desaparèixer.
 *   · Que amb el resultat donat pel pare no es demani res a la xarxa.
 *
 * QUÈ NO PROVA:
 *   · Les frases del nucli. `describeDominantLayer`, `describeLineOfSight` i la
 *     puntuació surten de `core/weather`, corren a Node i ja tenen
 *     `describe.test.ts`, `layers.test.ts` i `outlook.test.ts` al darrere.
 *     Aquí es comprova que ARRIBIN, no què diuen.
 *   · Res de com es veu. Ni una assercíó sobre una classe de CSS. Que la barra
 *     d'una capa es pinti amb l'opacitat física de la capa és una decisió bona
 *     i es verifica MIRANT-LA, que és el que fa el protocol manual.
 *   · La xarxa. `getCloudOutlook` té la seva bateria pròpia amb `fetchImpl`.
 *
 * ELS OUTLOOKS NO SÓN LITERALS ESCRITS A MÀ. Es munten amb les funcions de
 * debò del nucli —`scoreCloudLayers`, `planLineOfSight`, `confidenceForYears`,
 * `confidenceForLead`— perquè el que es prova sigui el que passarà. Un literal
 * amb `confidence: 'low'` clavat provaria que el panell sap pintar la paraula
 * «Baixa», que no és la pregunta; el que s'ha de saber és que vuit anys
 * d'arxiu ACABEN dient «Baixa» a la pantalla de la persona.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import type { GeoLocation } from '../../core/astro/types';
import {
  CONFIDENCE_LABEL,
  climatologyCaveat,
  confidenceForLead,
  confidenceForYears,
  describeAge,
  forecastCaveat,
  planLineOfSight,
  scoreCloudLayers,
  type ClimatologyOutlook,
  type CloudLayers,
  type CloudOutlook,
  type ForecastOutlook,
} from '../../core/weather';
import type { Locale } from '../../i18n';
import { CloudPanel } from './CloudPanel';
import { ws } from './strings';
import type { UseCloudOutlookResult } from './useCloudOutlook';

/*
 * Tafalla, que és el punt de referència d'aquest projecte, i el màxim del 12
 * d'agost de 2026. Números fixos i mai `Date.now()`: aquesta prova ha de dir
 * exactament el mateix el 2027.
 */
const TAFALLA: GeoLocation = { lat: 42.531, lon: -1.675, elevation: 426 };
const MAXIM = Date.UTC(2026, 7, 12, 20, 29, 0);

/**
 * El Sol del màxim des de Tafalla: 6,9° d'altura cap a l'oest.
 *
 * L'altura importa i no és decoració. Per sota dels 15° la línia de visió
 * s'inclina i els núvols que et taparan són a dos-cents quilòmetres; per damunt
 * són damunt teu. Els dos casos es proven, i aquest és el de l'eclipsi de debò.
 */
const SOL_BAIX = { az: 283.7, alt: 6.9 };
/** El mateix punt amb el Sol alt, que és el cas on la tira no ha de sortir. */
const SOL_ALT = { az: 200, alt: 55 };

/** Cel gairebé net. */
const CEL_NET: CloudLayers = { low: 2, mid: 0, high: 5, total: 7 };
/** Cirrus i prou: tapa, però la corona encara passa. */
const CIRRUS: CloudLayers = { low: 0, mid: 5, high: 85, total: 85 };

interface Munta {
  layers?: CloudLayers;
  /** Cert quan el model no ha donat el desglossament per capes. */
  totalOnly?: boolean;
  sun?: { az: number; alt: number };
  fetchedAtMs?: number;
  stale?: boolean;
  locale?: Locale;
}

/** Una previsió, amb l'antelació que se li demani. */
function previsio(leadDies: number, opcions: Munta = {}): ForecastOutlook {
  const {
    layers = CEL_NET,
    totalOnly = false,
    sun = SOL_BAIX,
    fetchedAtMs = MAXIM - leadDies * 86_400_000,
    stale = false,
    locale = 'ca',
  } = opcions;

  return {
    mode: 'forecast',
    location: TAFALLA,
    targetTimeMs: MAXIM,
    fetchedAtMs,
    stale,
    layers,
    score: scoreCloudLayers(layers, !totalOnly),
    sampling: {
      ...planLineOfSight(TAFALLA.lat, TAFALLA.lon, sun.az, sun.alt),
      // Una previsió sí que consulta tots els punts del pla: són set peticions
      // a la mateixa passada del model, no quinze anys d'arxiu.
      lineOfSightUsed: true,
    },
    confidence: confidenceForLead(leadDies),
    caveat: forecastCaveat(leadDies, confidenceForLead(leadDies), totalOnly, locale),
    leadDays: leadDies,
    validAtMs: MAXIM,
    haze: null,
  };
}

/** Una climatologia, amb els anys d'arxiu que se li demanin. */
function climatologia(anys: number, opcions: Munta = {}): ClimatologyOutlook {
  const {
    layers = CIRRUS,
    sun = SOL_BAIX,
    fetchedAtMs = MAXIM - 86_400_000,
    stale = false,
    locale = 'ca',
  } = opcions;

  return {
    mode: 'climatology',
    location: TAFALLA,
    targetTimeMs: MAXIM,
    fetchedAtMs,
    stale,
    layers,
    score: scoreCloudLayers(layers),
    sampling: {
      ...planLineOfSight(TAFALLA.lat, TAFALLA.lon, sun.az, sun.alt),
      /*
       * LA CLIMATOLOGIA NOMÉS MIRA EL PUNT DE L'OBSERVADOR, i això és el que
       * diu `SamplingPlan.lineOfSightUsed`: quinze anys per set punts serien
       * cent peticions. La geometria es conserva per poder-la explicar, però
       * no s'ha consultat. És el cas de la prova de l'honestedat de la tira.
       */
      lineOfSightUsed: false,
    },
    confidence: confidenceForYears(anys),
    caveat: climatologyCaveat(anys, locale),
    stats: {
      meanScore: 61,
      medianScore: 66,
      p25: 38,
      p75: 88,
      clearFraction: 0.41,
      cloudyFraction: 0.22,
      years: anys,
      sampleCount: anys * 11 * 3,
    },
    firstYear: 2025 - anys,
    lastYear: 2024,
    windowDays: 5,
    // El tipus l'exigeix i val `null` per definició: una climatologia no diu
    // res de la boirina d'un dia concret.
    haze: null,
  };
}

/**
 * El resultat del hook, tal com el dona la pantalla que ja l'ha resolt.
 *
 * `nowMs` és fix a posta: l'edat de la dada és una resta contra aquest valor i
 * una prova que la calculi contra el rellotge de paret és una prova que canvia
 * de resultat cada vegada que corre.
 */
function resultat(over: Partial<UseCloudOutlookResult> = {}): UseCloudOutlookResult {
  return {
    outlook: null,
    loading: false,
    error: null,
    online: true,
    nowMs: MAXIM,
    refresh: () => {},
    ...over,
  };
}

interface PanellProps {
  outlook?: UseCloudOutlookResult;
  location?: GeoLocation | null;
  locale?: Locale;
}

function panell({ outlook, location = TAFALLA, locale = 'ca' }: PanellProps = {}) {
  return render(
    <CloudPanel
      locale={locale}
      location={location}
      targetTimeMs={location === null ? null : MAXIM}
      sunAzimuthDeg={SOL_BAIX.az}
      sunAltitudeDeg={SOL_BAIX.alt}
      outlook={outlook}
    />,
  );
}

/** L'edat que ha de sortir, calculada com la calcula el panell. */
const edatDe = (outlook: CloudOutlook, locale: Locale = 'ca'): string =>
  describeAge(Math.max(0, MAXIM - outlook.fetchedAtMs), locale);

describe('CloudPanel · la incertesa no s’amaga mai', () => {
  it('amb el cel net i la dada acabada de baixar, la fiabilitat i l’edat hi són igualment', () => {
    /*
     * EL CAS QUE MÉS CONVIDA A CALLAR. Cel net, previsió de demà, tot en verd:
     * és exactament aquí on algú pensaria que les metadades fan nosa i les
     * amagaria «quan no hi ha res a dir». El dia que passi, la seva absència
     * voldrà dir «això és segur» a la resta de casos, i no ho és mai.
     */
    const outlook = previsio(1, { fetchedAtMs: MAXIM });
    panell({ outlook: resultat({ outlook }) });

    expect(screen.getByText(ws('meta.confidence', 'ca'))).toBeTruthy();
    expect(screen.getByText(CONFIDENCE_LABEL[outlook.confidence].ca)).toBeTruthy();
    expect(screen.getByText(ws('meta.age', 'ca'))).toBeTruthy();
    expect(screen.getByText(edatDe(outlook))).toBeTruthy();
    // I el caveat, que és la frase que diu què val la xifra.
    expect(screen.getByText(outlook.caveat)).toBeTruthy();
  });

  it('menys de dotze anys d’arxiu baixen la fiabilitat, i el panell ho diu', () => {
    /*
     * LA CADENA SENCERA, DEL NUCLI A LA PANTALLA. `confidenceForYears` decideix
     * («12 anys o més, mitjana; de 6 a 11, baixa») i el panell ha de pintar
     * aquella decisió i no una altra. Es proven els dos costats del llindar
     * perquè una prova d'un sol costat passaria igual amb un panell que
     * escrivís sempre la mateixa paraula.
     */
    const quinze = climatologia(15);
    const vuit = climatologia(8);
    expect(quinze.confidence).toBe('medium');
    expect(vuit.confidence).toBe('low');

    const primera = panell({ outlook: resultat({ outlook: quinze }) });
    expect(screen.getByText(CONFIDENCE_LABEL.medium.ca)).toBeTruthy();
    expect(screen.queryByText(CONFIDENCE_LABEL.low.ca)).toBeNull();
    primera.unmount();

    panell({ outlook: resultat({ outlook: vuit }) });
    expect(screen.getByText(CONFIDENCE_LABEL.low.ca)).toBeTruthy();
    expect(screen.queryByText(CONFIDENCE_LABEL.medium.ca)).toBeNull();
  });

  it('una previsió a deu dies no es pot ensenyar sense dir que no s’hi pot fiar', () => {
    const outlook = previsio(10);
    expect(outlook.confidence).toBe('very-low');

    panell({ outlook: resultat({ outlook }) });
    expect(screen.getByText(CONFIDENCE_LABEL['very-low'].ca)).toBeTruthy();
  });

  it('una dada desada sense connexió es presenta com el que és, amb l’edat', () => {
    const outlook = previsio(2, { stale: true, fetchedAtMs: MAXIM - 3 * 3_600_000 });
    panell({ outlook: resultat({ outlook }) });

    // El text es parteix entre la frase i l'edat en negreta, i per això es
    // busca l'avís pel seu tros invariable i l'edat pel seu.
    expect(screen.getByText(ws('stale.lead', 'ca'), { exact: false })).toBeTruthy();
    expect(screen.getByText(edatDe(outlook))).toBeTruthy();
  });

  it('sense l’avís de dada vella, la dada fresca no en porta cap', () => {
    panell({ outlook: resultat({ outlook: previsio(2) }) });
    expect(screen.queryByText(ws('stale.lead', 'ca'), { exact: false })).toBeNull();
  });

  it('una puntuació treta només de la cobertura total es declara grollera', () => {
    /*
     * Quan el model no dona les tres capes, la puntuació surt del total i és
     * molt més bruta. La xifra segueix sortint —val més una xifra grollera
     * dita que cap xifra— però amb l'avís al costat.
     */
    const outlook = previsio(2, { layers: CIRRUS, totalOnly: true });
    expect(outlook.score.fromTotalOnly).toBe(true);

    panell({ outlook: resultat({ outlook }) });
    expect(screen.getByText(ws('layers.totalOnly', 'ca'))).toBeTruthy();
  });

  it('amb el desglossament per capes, aquell avís no hi és', () => {
    const outlook = previsio(2, { layers: CIRRUS });
    expect(outlook.score.fromTotalOnly).toBe(false);

    panell({ outlook: resultat({ outlook }) });
    expect(screen.queryByText(ws('layers.totalOnly', 'ca'))).toBeNull();
  });
});

describe('CloudPanel · previsió i climatologia no es confonen', () => {
  it('la previsió porta la seva insígnia i la seva antelació, i cap repartiment d’anys', () => {
    panell({ outlook: resultat({ outlook: previsio(3) }) });

    expect(screen.getByText(ws('badge.forecast', 'ca'))).toBeTruthy();
    expect(screen.queryByText(ws('badge.climatology', 'ca'))).toBeNull();
    expect(screen.getByText(ws('meta.lead', 'ca'))).toBeTruthy();
    // El repartiment dels anys no vol dir res en una previsió: no hi ha anys.
    expect(screen.queryByText(ws('climo.overline', 'ca'))).toBeNull();
    expect(screen.queryByText(ws('climo.series', 'ca'))).toBeNull();
  });

  it('la climatologia porta el repartiment dels anys, i cap antelació', () => {
    /*
     * L'ANTELACIÓ NO EXISTEIX EN UNA CLIMATOLOGIA i ensenyar-la-hi seria dir
     * que això és una previsió a tants dies vista, que és justament la
     * confusió que aquest panell existeix per evitar.
     */
    panell({ outlook: resultat({ outlook: climatologia(15) }) });

    expect(screen.getByText(ws('badge.climatology', 'ca'))).toBeTruthy();
    expect(screen.queryByText(ws('badge.forecast', 'ca'))).toBeNull();
    expect(screen.queryByText(ws('meta.lead', 'ca'))).toBeNull();
    expect(screen.getByText(ws('climo.overline', 'ca'))).toBeTruthy();
    expect(screen.getByText(ws('climo.clearHours', 'ca'))).toBeTruthy();
  });
});

describe('CloudPanel · la línia de visió diu només el que s’ha mirat', () => {
  it('amb el Sol arran d’horitzó i els punts consultats, hi surten les distàncies', () => {
    const outlook = previsio(2, { sun: SOL_BAIX });
    expect(outlook.sampling.slanted).toBe(true);

    panell({ outlook: resultat({ outlook }) });
    expect(screen.getByText(ws('los.overline', 'ca'))).toBeTruthy();
    /*
     * Les píndoles són els punts que s'han consultat de veritat, i n'hi ha
     * d'haver una per punt del pla.
     *
     * Es busquen per rol de llista i no per un `/\d+ km/` damunt del text, que
     * és el que hi havia i era una prova FALSA: la frase de `describeLineOfSight`
     * també acaba en «són a 199 km d'aquí», i el patró se la comptava com una
     * píndola més. La tira és l'única llista del panell —les capes són divs i
     * les metadades són `dl`— i el rol la identifica sense mirar cap classe.
     */
    const pindoles = screen.getAllByRole('listitem');
    expect(pindoles).toHaveLength(outlook.sampling.points.length);
    for (const pindola of pindoles) expect(pindola.textContent).toMatch(/^\d+ km$/);
  });

  it('amb el Sol alt no hi ha tira de línia de visió', () => {
    /*
     * Amb el Sol per damunt dels 15° tots els punts col·lapsen sobre
     * l'observador: una tira que digués «els núvols que et taparien són a 0 km
     * d'aquí» seria soroll amb aspecte de precisió.
     */
    const outlook = previsio(2, { sun: SOL_ALT });
    expect(outlook.sampling.slanted).toBe(false);

    panell({ outlook: resultat({ outlook }) });
    expect(screen.queryByText(ws('los.overline', 'ca'))).toBeNull();
  });

  it('la climatologia explica la geometria però NO pinta punts que no ha consultat', () => {
    /*
     * EL CAS D'HONESTEDAT D'AQUEST BLOC. La climatologia conserva el pla
     * sencer —vuit punts fins a dos-cents quilòmetres— però només consulta el
     * de l'observador. Pintar les píndoles igualment diria que s'ha mirat el
     * cel de Valladolid quan no s'hi ha mirat: una estimació vestida de
     * mesura, que és exactament el que aquest projecte no fa.
     */
    const outlook = climatologia(15, { sun: SOL_BAIX });
    expect(outlook.sampling.slanted).toBe(true);
    expect(outlook.sampling.points.length).toBeGreaterThan(1);

    panell({ outlook: resultat({ outlook }) });
    expect(screen.getByText(ws('los.overline', 'ca'))).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('CloudPanel · els estats sense dada', () => {
  it('sense saber on ets, ho diu i no ensenya cap xifra', () => {
    panell({ location: null });

    expect(screen.getByText(ws('empty.noInput', 'ca'))).toBeTruthy();
    // Cap insígnia de font: sense dada no hi ha ni previsió ni climatologia.
    expect(screen.queryByText(ws('badge.forecast', 'ca'))).toBeNull();
    expect(screen.queryByText(ws('badge.climatology', 'ca'))).toBeNull();
    expect(screen.queryByText(ws('meta.confidence', 'ca'))).toBeNull();
  });

  it('carregant sense res anterior, ho diu i s’anuncia ocupat', () => {
    panell({ outlook: resultat({ loading: true }) });

    expect(screen.getByText(ws('loading', 'ca'))).toBeTruthy();
    expect(screen.getByLabelText(ws('title', 'ca')).getAttribute('aria-busy')).toBe('true');
  });

  it('carregant AMB dada anterior, la dada no desapareix', () => {
    /*
     * Prémer «Actualitza» no ha de buidar el panell. Si ho fes, el gest de
     * comprovar si el cel ha canviat costaria perdre de vista el que ja se
     * sabia, i amb una xarxa dolenta al camp això és quedar-se sense res.
     */
    const outlook = previsio(2);
    panell({ outlook: resultat({ outlook, loading: true }) });

    expect(screen.queryByText(ws('loading', 'ca'))).toBeNull();
    expect(screen.getByText(String(outlook.score.score))).toBeTruthy();
    expect(screen.getByLabelText(ws('title', 'ca')).getAttribute('aria-busy')).toBe('true');
    // I el botó de refrescar no es pot prémer dues vegades.
    expect(
      (screen.getByRole('button', { name: ws('refreshing', 'ca') }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('una avaria ensenya el motiu i deixa un camí per tornar-ho a provar', () => {
    const refresh = vi.fn();
    panell({ outlook: resultat({ error: 'La previsió no arriba a l’hora de l’eclipsi.', refresh }) });

    expect(screen.getByText('La previsió no arriba a l’hora de l’eclipsi.')).toBeTruthy();
    screen.getByRole('button', { name: ws('retry', 'ca') }).click();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('una avaria sense connexió ho diu, que és una altra cosa', () => {
    /*
     * «No hi ha dada» i «no hi ha dada I estàs sense cobertura» porten a fer
     * coses diferents: la primera, tornar-ho a provar; la segona, no gastar-hi
     * l'estona. Sense la distinció, qui és al mig del no-res prem un botó que
     * no pot funcionar.
     */
    panell({ outlook: resultat({ online: false }) });

    const text = screen.getByText(
      `${ws('error.none', 'ca')}${ws('error.offline', 'ca')}`,
      { exact: false },
    );
    expect(text).toBeTruthy();
  });
});

describe('CloudPanel · el resultat que ja té la pantalla no es torna a demanar', () => {
  it('amb `outlook` per props no es toca la xarxa', () => {
    /*
     * Open-Meteo ens deixa deu mil peticions al dia i el panell es pot muntar
     * dues vegades a la mateixa pantalla (la fitxa del mapa i el compte
     * enrere). La capçalera del component es compromet a no consultar res quan
     * el pare ja porta el resultat resolt; això ho comprova per l'única via
     * que no menteix, que és mirar si `fetch` s'ha arribat a cridar.
     */
    const xarxa = vi.fn(() => Promise.reject(new Error('cap petició no hauria de sortir d’aquí')));
    vi.stubGlobal('fetch', xarxa);

    panell({ outlook: resultat({ outlook: previsio(2) }) });

    expect(screen.getByText(ws('badge.forecast', 'ca'))).toBeTruthy();
    expect(xarxa).not.toHaveBeenCalled();
  });
});

describe('CloudPanel · idioma', () => {
  it('en castellà, les etiquetes de la dada surten en castellà', () => {
    /*
     * L'INVARIANT 8 D'ESTAT.md. Aquest panell es va escriure sencer en català
     * mentre no el muntava ningú, i és el precedent que hi ha documentat.
     *
     * PER QUÈ NO ES BUSCA L'ABSÈNCIA DEL CATALÀ PER SUBCADENA: «Climatologia»
     * és un prefix de «Climatología» i «Previsió» ho és de «Previsión». Un
     * `textContent.includes` de la cadena catalana és vermell damunt d'una
     * pantalla perfectament castellana. `getByText` compara el text SENCER de
     * l'element i per això sí que distingeix les dues columnes.
     */
    const outlook = climatologia(15, { locale: 'es' });
    panell({ outlook: resultat({ outlook }), locale: 'es' });

    expect(screen.getByText(ws('badge.climatology', 'es'))).toBeTruthy();
    expect(screen.queryByText(ws('badge.climatology', 'ca'))).toBeNull();
    expect(screen.getByText(ws('meta.confidence', 'es'))).toBeTruthy();
    expect(screen.queryByText(ws('meta.confidence', 'ca'))).toBeNull();
    expect(screen.getByText(CONFIDENCE_LABEL.medium.es)).toBeTruthy();
    expect(screen.getByText(edatDe(outlook, 'es'))).toBeTruthy();
  });
});
