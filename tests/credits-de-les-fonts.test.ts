/**
 * CAP DADA QUE ENSENYEM POT NO DIR D'ON VE.
 *
 * PER QUÈ EXISTEIX AQUEST FITXER. Perquè ja va passar, i va passar en silenci.
 * El 3 d'agost de 2026 l'app va guanyar dues fonts —els miradors i cims
 * d'OpenStreetMap i la climatologia i la previsió d'Open-Meteo— i cap de les
 * dues sortia als crèdits amb la seva llicència. No era un deute d'ordre: l'ODbL
 * i la CC BY són OBLIGACIONS, i s'incomplien amb la dada ja pintada al mapa. A
 * sobre, la llista de fonts existia DUES vegades (una al peu i una còpia a «Com
 * funciona», amb la nota escrita al costat que era candidata a morir), o sigui
 * que hi havia dos llocs on oblidar-se'n i cap on el compilador digués res.
 *
 * L'ARREGLADA D'AQUELL DIA NO ÉS EL QUE VIGILA AQUESTA PROVA. Escriure les dues
 * files que faltaven es fa en cinc minuts i no torna a fer mal fins d'aquí a tres
 * mesos, quan entri la font següent i ningú se'n recordi. El que vigila aquesta
 * prova és la FORMA de l'error: que una dada nova pugui arribar al producte
 * sense passar per la llista.
 *
 * ── COM ES CAÇA LA FONT SEGÜENT ─────────────────────────────────────────────
 *
 * Per l'AMFITRIÓ. Una font de dades es fa servir demanant-li bytes, i per
 * demanar-los cal escriure el seu servidor al codi. Aquesta prova recorre el
 * codi que es publica i els generadors de `scripts/`, en treu tot amfitrió que
 * aparegui dins d'un `https://…`, i exigeix que cadascun surti d'alguna fila de
 * `features/about/credits.ts` o d'una llista declarada aquí de coses que no són
 * cap font. Qui afegeixi una font haurà d'escriure el seu servidor en algun lloc
 * i, en aquell moment, la prova es posarà vermella i li dirà què li falta. No cal
 * que se'n recordi ningú.
 *
 * Els `scripts/` hi entren A POSTA i no per completisme: el catàleg de miradors
 * i la graella de nuvolositat no es demanen en execució —viatgen dins del
 * paquet—, i per tant la porta per la qual va entrar la font que faltava era
 * justament aquella. Una dada que entra al producte per la porta de la
 * compilació no deixa de ser una dada del producte.
 *
 * LES PROVES NO HI ENTREN, i també a posta: els seus amfitrions són decorats
 * (`exemple.cat`, un `https://usuari:clau@…` per a la porta de privadesa) i mai
 * bytes de ningú. Fer que un cas de prova nou obligui a tocar els crèdits seria
 * la manera més segura que algú acabés eixamplant la llista del que no és cap
 * font fins a deixar-la sense sentit.
 *
 * QUÈ NO VIGILA. La direcció de sortida: qui pot rebre una petició nostra i amb
 * quines dades. Això és una altra promesa i té les seves pròpies proves —la
 * porta de privadesa de `core/analytics/`, i `offline/budget.test.ts` amb
 * `offline/terrain-agreement.test.ts`, que exigeixen que tota URL que l'app
 * demani surti d'`offline/config.ts` i tingui regla al service worker. La mesura
 * d'ús (`googletagmanager`) hi viu i per això no és fila de crèdits: no és cap
 * font de dades, és el contrari.
 *
 * ── LA COMPROVACIÓ INVERSA, I PER QUÈ ÉS DESIGUAL ───────────────────────────
 *
 * També es demana que tot amfitrió declarat existeixi de debò al codi: una
 * atribució a una font que ja no es fa servir és tan mentidera com una font
 * sense atribució, i les llistes d'aquesta mena es podreixen sempre cap al mateix
 * cantó —creixen i no minven mai.
 *
 * Ara bé, per a l'amfitrió de l'`url` d'una fila la comprovació no val res: la
 * fila mateixa escriu aquella adreça i per tant sempre hi és. El que de debò
 * vigila són els altres amfitrions, els que es demanen: si algú retira el
 * geocodificador, `photon.komoot.io` desapareix del codi i la fila queda òrfia
 * amb una atribució que ja no atribueix res.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CREDITS } from '../src/features/about/credits';
import { OSM_COPYRIGHT_URL, OSM_ODBL_ATTRIBUTION } from '../src/core/places/viewpoints';
import { PLACES_ATTRIBUTION_URL } from '../src/core/places/photon';
import { OPEN_METEO_ATTRIBUTION } from '../src/core/weather/openMeteo';
import {
  OBSERVATION_ECLIPSE_IDS,
  allObservationSources,
  observationSourcesFor,
  pointsForEclipse,
} from '../src/data/observation-points/catalog';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');

/* ── El que apareix al codi i NO és cap font de dades ─────────────────────── */

/**
 * Cada entrada porta el motiu escrit, i el motiu ha de ser d'aquesta forma:
 * «aquest amfitrió no serveix cap dada que l'app ensenyi». Si algú hi afegeix un
 * servidor del qual sí que baixem res, s'estarà mentint a si mateix per escrit,
 * que és molt més difícil que oblidar-se'n.
 */
const NO_SON_FONTS: Readonly<Record<string, string>> = {
  'eclipsi.info': 'el nostre domini: canòniques i identificació de l’app, no cap dada de ningú',
  'lacuinade.estic.online':
    'el desplegament de llegat, dins del User-Agent que s’envia a Photon fora del navegador',
  'x.com': 'el perfil de qui signa l’app, al peu i al bloc de contacte de premsa',
  'damosenelblanco.com': 'el despatx que signa l’app, al peu i al bloc de contacte de premsa',
  'www.w3.org':
    'l’espai de noms de l’SVG (`xmlns`): és un identificador, no s’hi fa cap petició mai',
  'schema.org':
    'el vocabulari de les dades estructurades: és un identificador, no s’hi fa cap petició mai',
  'www.sitemaps.org':
    'l’espai de noms XML del sitemap: és un identificador, no s’hi fa cap petició mai',
  '127.0.0.1':
    'la màquina mateixa: els guions de premsa (`press-*.ts`) hi parlen amb el Chrome ' +
    'que condueixen i hi serveixen les seves pròpies plantilles. No hi ha cap dada de ' +
    'ningú al darrere ni res que l’app ensenyi, i no surt del paquet publicat',

  /*
   * LA COBERTURA EDITORIAL VA EN DIRECCIÓ CONTRÀRIA A UNA FONT.
   *
   * Aquests vuit amfitrions són els mitjans que han escrit sobre l'app, i
   * `AboutScreen.tsx` en publica el titular enllaçat. La fletxa apunta cap a
   * fora: no baixem cap byte seu ni n'ensenyem cap dada, i per tant no hi ha res
   * a atribuir. El logotip que sí que ensenyem no és una dada de ningú, és la
   * seva marca, i qui el vigila és `tests/actius-binaris.test.ts`.
   *
   * Si algun dia se n'extreu res —un titular llegit en execució, una portada
   * incrustada—, aleshores sí que serà una font i haurà de sortir d'aquí.
   */
  'www.vilaweb.cat': 'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'www.timeout.es': 'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'www.diaridetarragona.com':
    'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'www.diaridebarcelona.cat':
    'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'www.metadata.cat': 'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'www.dbalears.cat': 'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'el3devuit.cat': 'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
  'diaricatalunya.cat':
    'mitjà que ens ha citat: l’enllaç surt de nosaltres, no en baixem cap dada',
};

/* ── El codi que es publica ───────────────────────────────────────────────── */

/** Els dos arbres que compten: el que s'empaqueta i el que cou les dades. */
const ARRELS = ['src', 'scripts'];

function fitxersDeCodi(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...fitxersDeCodi(full));
      continue;
    }
    if (!['.ts', '.tsx'].includes(extname(entry))) continue;
    if (/\.test\.tsx?$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

/**
 * Treu comentaris, que és el que separa una font d'una nota al marge.
 *
 * Aquest projecte escriu capçaleres llarguíssimes plenes d'adreces citades —la
 * capçalera de dalt mateix en té unes quantes—, i comptar-les faria que la prova
 * exigís una fila de crèdits per a cada lloc que algú hagi esmentat mai. El que
 * compta és l'adreça que el codi fa servir de debò.
 *
 * El tall dels comentaris de línia demana que davant de `//` no hi hagi cap dos
 * punts: sense això, `'https://…'` dins d'una cadena es menjaria mig fitxer i la
 * prova passaria per no veure-hi res.
 */
function nomesCodi(font: string): string {
  return font
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

/** Tot amfitrió que surt al codi publicat, amb els fitxers on surt. */
function amfitrionsDelCodi(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const arrel of ARRELS) {
    for (const file of fitxersDeCodi(join(ROOT, arrel))) {
      const codi = nomesCodi(readFileSync(file, 'utf8'));
      for (const match of codi.matchAll(/https?:\/\/([A-Za-z0-9.-]+)/g)) {
        const host = match[1].toLowerCase();
        const where = relative(ROOT, file).split(sep).join('/');
        const llista = found.get(host);
        if (llista === undefined) found.set(host, [where]);
        else if (!llista.includes(where)) llista.push(where);
      }
    }
  }
  return found;
}

const AL_CODI = amfitrionsDelCodi();

/** Els amfitrions que la llista de crèdits declara, sigui com a fila o com a enllaç. */
const DECLARATS = new Set<string>(
  CREDITS.flatMap((credit) => [new URL(credit.url).hostname.toLowerCase(), ...credit.hosts]),
);

/* ── Les proves ──────────────────────────────────────────────────────────── */

describe('cada dada que ensenyem diu d’on ve', () => {
  it('cap amfitrió del codi publicat es queda sense fila de crèdits', () => {
    const orfes = [...AL_CODI.entries()]
      .filter(([host]) => !DECLARATS.has(host) && NO_SON_FONTS[host] === undefined)
      .map(([host, files]) => `${host} (a ${files.join(', ')})`);

    /*
     * El missatge diu QUÈ fer i no només què falla: qui es trobi això vermell
     * acaba d'afegir una font i el que necessita és saber on s'escriu la fila,
     * no rumiar què vol dir «amfitrió no declarat».
     */
    expect(
      orfes,
      'Hi ha amfitrions al codi que no surten enlloc dels crèdits. Si serveixen una ' +
        'dada que l’app ensenyi, afegeix-los una fila a src/features/about/credits.ts ' +
        'amb la seva llicència; si no en serveixen cap, declara’ls a NO_SON_FONTS ' +
        'd’aquesta prova amb el motiu escrit.',
    ).toEqual([]);
  });

  it('cap fila de crèdits no atribueix una font que ja no es fa servir', () => {
    const inexistents = [...DECLARATS].filter((host) => !AL_CODI.has(host));
    expect(
      inexistents,
      'Aquests amfitrions estan declarats als crèdits i no surten al codi. O s’ha ' +
        'retirat la font i la seva fila s’ha de treure, o l’amfitrió s’ha escrit malament.',
    ).toEqual([]);
  });

  it('la llista del que no és cap font no s’infla amb entrades mortes', () => {
    const sobrants = Object.keys(NO_SON_FONTS).filter((host) => !AL_CODI.has(host));
    expect(sobrants).toEqual([]);
  });
});

describe('les files de crèdits', () => {
  it('diuen què, qui i on, en les dues llengües', () => {
    for (const credit of CREDITS) {
      expect(credit.what.ca.trim(), JSON.stringify(credit)).not.toBe('');
      expect(credit.what.es.trim(), JSON.stringify(credit)).not.toBe('');
      expect(credit.who.trim(), JSON.stringify(credit)).not.toBe('');
      expect(credit.url, credit.who).toMatch(/^https:\/\//);
    }
  });

  it('declaren el seu propi enllaç com a amfitrió', () => {
    /*
     * Perquè `hosts` sigui l'inventari de debò i no una llista de servidors
     * amb l'enllaç de la fila fora. Si l'amfitrió de l'`url` no hi fos, la
     * comprovació d'orfes de dalt hauria de mirar dues coses en comptes d'una,
     * i el dia que se n'oblidés una es tornaria a obrir el forat.
     */
    for (const credit of CREDITS) {
      expect(credit.hosts, credit.who).toContain(new URL(credit.url).hostname.toLowerCase());
    }
  });

  it('cada fila té un nom propi, que és amb el que es pinta', () => {
    /*
     * `who` ÉS LA IDENTITAT D'UNA FILA, i això no és una preferència d'estil:
     * és la clau de React amb què es pinten les llistes.
     *
     * L'`url` no pot fer-ho. Les dues files d'OpenStreetMap —la cartografia i
     * els miradors— apunten totes dues a la pàgina de la llicència, que és on
     * són les condicions de totes dues, i han de seguir apuntant-hi. Quan
     * `key={credit.url}` es va escriure només hi havia una fila d'OSM i la
     * coincidència no existia; el dia que se'n va afegir la segona, dues files
     * germanes van passar a compartir clau, que és de les poques maneres que
     * React té de pintar malament sense petar.
     */
    const noms = CREDITS.map((c) => c.who);
    expect(new Set(noms).size, 'hi ha dues files amb el mateix nom').toBe(noms.length);
  });

  it('cap fila no repeteix un amfitrió dins d’ella mateixa', () => {
    for (const credit of CREDITS) {
      expect(new Set(credit.hosts).size, credit.who).toBe(credit.hosts.length);
    }
  });

  it('escriuen els amfitrions com el codi els escriu: en minúscula i sense esquema ni barra', () => {
    for (const credit of CREDITS) {
      for (const host of credit.hosts) {
        expect(host, credit.who).toBe(host.toLowerCase());
        expect(host, credit.who).not.toMatch(/[:/]/);
      }
    }
  });

  it('cap llicència no es queda a mig escriure', () => {
    /*
     * `null` és una resposta vàlida i vol dir «aquesta font no imposa cap
     * llicència d'atribució», amb el motiu escrit al costat de la fila. Una
     * cadena buida o un espai no volen dir res: són el «ja ho miraré» que
     * aquesta prova existeix per no deixar passar.
     */
    for (const credit of CREDITS) {
      if (credit.licence === null) continue;
      expect(credit.licence.trim(), credit.who).toBe(credit.licence);
      expect(credit.licence, credit.who).not.toBe('');
    }
  });
});

describe('les dues llicències que són obligació', () => {
  /**
   * Les busca per amfitrió i no per posició: reordenar la llista —que està
   * ordenada per importància per a l'usuari i pot canviar— no ha de fer caure
   * cap d'aquestes dues proves, i afegir una fila nova d'OSM tampoc.
   */
  function filesAmb(host: string) {
    return CREDITS.filter((c) => c.hosts.includes(host));
  }

  it('l’ODbL surt a totes les files que serveixen dades d’OpenStreetMap', () => {
    const files = filesAmb('www.openstreetmap.org');
    /* Dues: la cartografia i els topònims, i els miradors i cims. */
    expect(files.length).toBeGreaterThanOrEqual(2);
    for (const fila of files) {
      expect(fila.licence, fila.who).toBe('ODbL 1.0');
      /* La mateixa etiqueta que el mapa pinta dins del llenç. Si algú canvia
         l'una i no l'altra, l'usuari llegeix dues llicències diferents per a la
         mateixa dada segons on miri. */
      expect(OSM_ODBL_ATTRIBUTION).toContain(fila.licence);
    }
  });

  it('la CC BY d’Open-Meteo surt a la fila i diu el mateix que el panell de núvols', () => {
    const [meteo, ...resta] = filesAmb('api.open-meteo.com');
    expect(resta).toEqual([]);
    expect(meteo.licence).toBe('CC BY 4.0');
    expect(OPEN_METEO_ATTRIBUTION.ca).toContain(meteo.licence);
    expect(OPEN_METEO_ATTRIBUTION.es).toContain(meteo.licence);
    /* La reanàlisi ERA5 és una API diferent de la previsió i la fa servir tant
       l'app com `scripts/build-cloud-clim.ts`: si algú la traslladés a una fila
       pròpia sense llicència, això ho diria. */
    expect(meteo.hosts).toContain('archive-api.open-meteo.com');
  });

  it('l’enllaç de l’ODbL dels crèdits és el mateix que el del nucli', () => {
    /*
     * `credits.ts` no importa `core` a posta (viu al paquet d'arrencada; vegeu
     * la seva capçalera) i per tant escriu l'adreça literal. Aquesta és la
     * costura, i es vigila igual que `offline/basemap-agreement.test.ts` vigila
     * la URL de les tessel·les.
     */
    const osm = CREDITS.filter((c) => c.licence === 'ODbL 1.0');
    expect(osm.length).toBeGreaterThanOrEqual(2);
    for (const fila of osm) expect(fila.url).toBe(OSM_COPYRIGHT_URL);
    expect(PLACES_ATTRIBUTION_URL).toBe(OSM_COPYRIGHT_URL);
  });
});

describe('els punts d’observació oficials', () => {
  /*
   * No són cap fila de `CREDITS` perquè no en poden ser: són vuit
   * administracions i la llista canvia per eclipsi. Es deriven del catàleg amb
   * `observationSourcesFor()`, i el que s'ha de vigilar és que la derivació no
   * en perdi cap pel camí.
   */
  it('cap punt no es publica sense dir qui l’ha anunciat i on', () => {
    for (const eclipseId of OBSERVATION_ECLIPSE_IDS) {
      for (const point of pointsForEclipse(eclipseId)) {
        expect(point.source.who.trim(), point.id).not.toBe('');
        expect(point.source.url, point.id).toMatch(/^https:\/\//);
      }
    }
  });

  it('la llista de crèdits d’un eclipsi conté totes les administracions dels seus punts', () => {
    for (const eclipseId of OBSERVATION_ECLIPSE_IDS) {
      const alsPunts = new Set(pointsForEclipse(eclipseId).map((p) => p.source.url));
      const alsCredits = new Set(observationSourcesFor(eclipseId).map((s) => s.url));
      expect([...alsPunts].filter((url) => !alsCredits.has(url)), eclipseId).toEqual([]);
    }
  });

  it('la llista de tot el catàleg no perd cap administració de cap eclipsi', () => {
    const totes = new Set(allObservationSources().map((s) => s.url));
    for (const eclipseId of OBSERVATION_ECLIPSE_IDS) {
      for (const source of observationSourcesFor(eclipseId)) {
        expect(totes.has(source.url), `${eclipseId} · ${source.who}`).toBe(true);
      }
    }
  });
});

describe('qui ho pinta', () => {
  /*
   * Una llista de fonts impecable que ningú no ensenya no atribueix res. Això
   * no es pot comprovar sense muntar el DOM, i el que sí que es pot comprovar
   * des d'aquí és que la pantalla que té per feina publicar-les no s'hagi deixat
   * la meitat que fa que serveixin: la llicència.
   *
   * NOMÉS ES MIRA «COM FUNCIONA». El diàleg de crèdits del mapa pinta la mateixa
   * llista i encara no diu la llicència; la línia exacta que li falta és a
   * l'informe de la sessió que ha escrit això, i el dia que hi sigui, aquesta
   * prova ha de créixer amb el seu fitxer. Posar-l'hi abans deixaria la bateria
   * vermella per una feina de tercers, que és la manera de convertir una prova
   * en una molèstia que algú acaba esborrant.
   */
  it('«Com funciona» pinta la llicència de cada font, no només el nom', () => {
    const pagina = readFileSync(join(ROOT, 'src/features/about/AboutScreen.tsx'), 'utf8');
    expect(pagina).toContain('CREDITS.map');
    expect(nomesCodi(pagina)).toContain('licence');
  });

  it('«Com funciona» diu qui publica els punts oficials', () => {
    const pagina = nomesCodi(readFileSync(join(ROOT, 'src/features/about/AboutScreen.tsx'), 'utf8'));
    expect(pagina).toContain('ObservationSources');
  });
});
