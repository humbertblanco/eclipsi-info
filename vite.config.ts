import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** HTML castellà real per a Google i les previsualitzacions de `/es`. */
function spanishIndex(html: string): string {
  return html
    .replace('<html lang="ca">', '<html lang="es">')
    .replace(
      '<title>Eclipsi solar 2026: visibilitat i durada al teu punt | eclipsi.info</title>',
      '<title>Eclipse solar 2026: visibilidad y duración en tu ubicación | eclipsi.info</title>',
    )
    .replace(
      `rel="canonical" href="${SITE_URL}"`,
      `rel="canonical" href="${SITE_URL}es/"`,
    )
    .replace(
      `<meta property="og:url" content="${SITE_URL}" />`,
      `<meta property="og:url" content="${SITE_URL}es/" />`,
    )
    .replace(`"url": "${SITE_URL}"`, `"url": "${SITE_URL}es/"`)
    .replace('<meta property="og:locale" content="ca_ES" />', '<meta property="og:locale" content="es_ES" />')
    .replace('<meta property="og:locale:alternate" content="es_ES" />', '<meta property="og:locale:alternate" content="ca_ES" />')
    .replaceAll(
      'Quants segons d’eclipsi veuràs des d’on seràs',
      'Cuántos segundos de eclipse verás desde donde estarás',
    )
    .replaceAll(
      'Eclipsi solar 2026: quants segons veuràs al teu punt?',
      'Eclipse solar 2026: ¿cuántos segundos verás en tu ubicación?',
    )
    .replaceAll(
      'Càlcul topocèntric i horitzó real del teu punt: la durada que et deixa el relleu, no la del catàleg.',
      'Cálculo topocéntrico y horizonte real de tu punto: la duración que permite el relieve, no la del catálogo.',
    )
    .replace(
      'Calcula l’eclipsi solar del 12 d’agost de 2026 al teu punt: hora, segons de totalitat, núvols, relleu, mapa de visibilitat i llocs oficials.',
      'Calcula el eclipse solar del 12 de agosto de 2026 en tu ubicación: hora, segundos de totalidad, nubes, relieve, mapa de visibilidad y puntos oficiales.',
    )
    .replaceAll(
      'eclipsi.info, durada i visibilitat de l’eclipsi solar al teu punt',
      'eclipsi.info, duración y visibilidad del eclipse solar en tu ubicación',
    )
    .replace(
      'Simulador dels eclipsis solars del 2026, 2027 i 2028 amb càlcul topocèntric i perfil d’horitzó real del punt de l’observador.',
      'Simulador de los eclipses solares de 2026, 2027 y 2028 con cálculo topocéntrico y perfil del horizonte real del punto del observador.',
    )
    .replaceAll('Eclipsi solar total del 12 d’agost de 2026', 'Eclipse solar total del 12 de agosto de 2026')
    .replaceAll('Eclipsi solar del 2 d’agost de 2027', 'Eclipse solar del 2 de agosto de 2027')
    .replaceAll('Eclipsi solar anular del 26 de gener de 2028', 'Eclipse solar anular del 26 de enero de 2028')
    .replaceAll('Franja de totalitat: Islàndia i el nord d’Espanya', 'Franja de totalidad: Islandia y el norte de España')
    .replaceAll('Nord d’Àfrica; parcial des d’Espanya', 'Norte de África; parcial desde España')
    .replaceAll('Anular des de la península Ibèrica', 'Anular desde la península ibérica')
}

/** HTML anglès real per a cercadors i previsualitzacions de `/en`. */
function englishIndex(html: string): string {
  return html
    .replace('<html lang="ca">', '<html lang="en">')
    .replace(
      '<title>Eclipsi solar 2026: visibilitat i durada al teu punt | eclipsi.info</title>',
      '<title>2026 solar eclipse: visibility and duration at your location | eclipsi.info</title>',
    )
    .replace(
      `rel="canonical" href="${SITE_URL}"`,
      `rel="canonical" href="${SITE_URL}en/"`,
    )
    .replace(
      `<meta property="og:url" content="${SITE_URL}" />`,
      `<meta property="og:url" content="${SITE_URL}en/" />`,
    )
    .replace(`"url": "${SITE_URL}"`, `"url": "${SITE_URL}en/"`)
    .replace('<meta property="og:locale" content="ca_ES" />', '<meta property="og:locale" content="en_GB" />')
    .replace('<meta property="og:locale:alternate" content="en_GB" />', '<meta property="og:locale:alternate" content="ca_ES" />')
    .replaceAll(
      'Quants segons d’eclipsi veuràs des d’on seràs',
      'How many seconds of eclipse will you see from your location?',
    )
    .replaceAll(
      'Eclipsi solar 2026: quants segons veuràs al teu punt?',
      '2026 solar eclipse: how many seconds will you see?',
    )
    .replaceAll(
      'Càlcul topocèntric i horitzó real del teu punt: la durada que et deixa el relleu, no la del catàleg.',
      'Topocentric calculations and your real horizon: the duration the terrain allows, not the catalogue figure.',
    )
    .replace(
      'Calcula l’eclipsi solar del 12 d’agost de 2026 al teu punt: hora, segons de totalitat, núvols, relleu, mapa de visibilitat i llocs oficials.',
      'Calculate the 12 August 2026 solar eclipse at your location: times, seconds of totality, clouds, terrain, visibility map and official viewing sites.',
    )
    .replaceAll(
      'eclipsi.info, durada i visibilitat de l’eclipsi solar al teu punt',
      'eclipsi.info, solar eclipse duration and visibility at your location',
    )
    .replace(
      'Simulador dels eclipsis solars del 2026, 2027 i 2028 amb càlcul topocèntric i perfil d’horitzó real del punt de l’observador.',
      'Solar eclipse simulator for 2026, 2027 and 2028 with topocentric calculations and the observer’s real horizon profile.',
    )
    .replaceAll('Eclipsi solar total del 12 d’agost de 2026', 'Total solar eclipse of 12 August 2026')
    .replaceAll('Eclipsi solar del 2 d’agost de 2027', 'Solar eclipse of 2 August 2027')
    .replaceAll('Eclipsi solar anular del 26 de gener de 2028', 'Annular solar eclipse of 26 January 2028')
    .replaceAll('Franja de totalitat: Islàndia i el nord d’Espanya', 'Path of totality: Iceland and northern Spain')
    .replaceAll('Nord d’Àfrica; parcial des d’Espanya', 'North Africa; partial from Spain')
    .replaceAll('Anular des de la península Ibèrica', 'Annular from the Iberian Peninsula')
}

function frenchIndex(html: string): string {
  return html
    .replace('<html lang="ca">', '<html lang="fr">')
    .replace('<title>Eclipsi solar 2026: visibilitat i durada al teu punt | eclipsi.info</title>', '<title>Éclipse solaire 2026 : visibilité et durée à votre position | eclipsi.info</title>')
    .replace(`rel="canonical" href="${SITE_URL}"`, `rel="canonical" href="${SITE_URL}fr/"`)
    .replace(`<meta property="og:url" content="${SITE_URL}" />`, `<meta property="og:url" content="${SITE_URL}fr/" />`)
    .replace(`"url": "${SITE_URL}"`, `"url": "${SITE_URL}fr/"`)
    .replace('<meta property="og:locale" content="ca_ES" />', '<meta property="og:locale" content="fr_FR" />')
    .replace('<meta property="og:locale:alternate" content="fr_FR" />', '<meta property="og:locale:alternate" content="ca_ES" />')
    .replaceAll('Quants segons d’eclipsi veuràs des d’on seràs', 'Combien de secondes d’éclipse verrez-vous depuis votre position ?')
    .replaceAll('Eclipsi solar 2026: quants segons veuràs al teu punt?', 'Éclipse solaire 2026 : combien de secondes verrez-vous ?')
    .replaceAll('Càlcul topocèntric i horitzó real del teu punt: la durada que et deixa el relleu, no la del catàleg.', 'Calcul topocentrique et horizon réel : la durée permise par le relief, pas celle du catalogue.')
    .replace('Calcula l’eclipsi solar del 12 d’agost de 2026 al teu punt: hora, segons de totalitat, núvols, relleu, mapa de visibilitat i llocs oficials.', 'Calculez l’éclipse solaire du 12 août 2026 à votre position : horaires, durée de totalité, nuages, relief, carte de visibilité et sites officiels.')
    .replaceAll('eclipsi.info, durada i visibilitat de l’eclipsi solar al teu punt', 'eclipsi.info, durée et visibilité de l’éclipse solaire à votre position')
    .replace('Simulador dels eclipsis solars del 2026, 2027 i 2028 amb càlcul topocèntric i perfil d’horitzó real del punt de l’observador.', 'Simulateur des éclipses solaires de 2026, 2027 et 2028 avec calcul topocentrique et profil réel de l’horizon de l’observateur.')
    .replaceAll('Eclipsi solar total del 12 d’agost de 2026', 'Éclipse solaire totale du 12 août 2026')
    .replaceAll('Eclipsi solar del 2 d’agost de 2027', 'Éclipse solaire du 2 août 2027')
    .replaceAll('Eclipsi solar anular del 26 de gener de 2028', 'Éclipse solaire annulaire du 26 janvier 2028')
    .replaceAll('Franja de totalitat: Islàndia i el nord d’Espanya', 'Bande de totalité : Islande et nord de l’Espagne')
    .replaceAll('Nord d’Àfrica; parcial des d’Espanya', 'Afrique du Nord ; partielle depuis l’Espagne')
    .replaceAll('Anular des de la península Ibèrica', 'Annulaire depuis la péninsule Ibérique')
}

/**
 * Noms de les memòries cau en temps d'execució.
 *
 * Han de coincidir EXACTAMENT amb `src/offline/config.ts`: la precàrrega
 * manual ("prepara'm per anar-hi") escriu les tessel·les directament dins
 * d'aquestes memòries cau perquè el service worker les hi trobi després. Si
 * els dos costats se separen, la precàrrega semblarà funcionar i l'app estarà
 * buida al camp — el pitjor error possible en aquesta aplicació.
 */
const CACHE_TERRAIN = 'eclipsi-relleu-v1'
const CACHE_BASEMAP = 'eclipsi-mapa-v1'
const CACHE_DATA = 'eclipsi-dades-v1'

/** Un any. El terreny i la cartografia base no canvien en escales humanes. */
const ONE_YEAR_S = 60 * 60 * 24 * 365

/**
 * Subdirectori on es publica l'app.
 *
 * En desenvolupament es serveix a l'arrel; en producció va a
 * https://lacuinade.estic.online/eclipsi/. Servir des d'un subdirectori no és
 * només cosmètic: afecta les rutes dels actius, l'àmbit del service worker
 * —que NO pot controlar res per damunt del seu propi directori— i el manifest.
 *
 * Es pot sobreescriure amb la variable d'entorn ECLIPSI_BASE per publicar-ho
 * a un altre lloc sense tocar codi — el desplegament de llegat al camí
 * /eclipsi/ de lacuinade.estic.online passa `ECLIPSI_BASE=/eclipsi/`.
 */
const BASE = process.env.ECLIPSI_BASE ?? '/'

/**
 * On viu l'app, amb origen i tot.
 *
 * Les etiquetes Open Graph i les dades estructurades NO admeten rutes
 * relatives: WhatsApp, Telegram, Slack i X resolen `og:image` abans de tenir
 * cap pàgina, i una ruta relativa allà no és res. O sigui que en algun lloc hi
 * ha d'haver l'origen escrit, i val més que sigui aquí que escampat per
 * l'`index.html`.
 *
 * EL DOMINI JA ÉS NOSTRE. eclipsi.info es va comprar i el vhost viu al
 * servidor (2 d'agost de 2026): aquesta és la línia que la nota d'aquí sota
 * deia que es canviaria aquell dia, canviada. El desplegament de llegat al
 * camí de lacuinade passa `ECLIPSI_SITE_URL` explícita si mai cal refer-lo.
 */
const SITE_URL = (
  process.env.ECLIPSI_SITE_URL ?? 'https://eclipsi.info/'
).replace(/\/?$/, '/')

// https://vite.dev/config/
/*
 * IDENTIFICADOR DE COMPILACIÓ.
 *
 * Va al peu de l'app. Amb un service worker pel mig, no saber quina versió
 * corres no és una curiositat: és la diferència entre provar el que acabes de
 * fer i provar el que hi havia abans. Es fa servir la data i hora de la
 * compilació, que és el que de veritat distingeix dos desplegaments.
 */
const BUILD_ID = new Date().toISOString().slice(0, 16).replace('T', ' ')

export default defineConfig(({ command }) => ({
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(BUILD_ID) },
  // En `vite dev` mantenim l'arrel: així el certificat autofirmat i les proves
  // al mòbil per IP local funcionen sense haver d'escriure el subdirectori.
  base: command === 'build' ? BASE : '/',
  // HTTPS amb certificat autofirmat en desenvolupament.
  //
  // No és opcional: iOS només dona `getUserMedia` i
  // `DeviceOrientationEvent.requestPermission()` en un context segur. Servir
  // el Vite per l'IP de la xarxa local amb http deixaria la càmera i la
  // brúixola fora de joc, que és justament el que hem de provar al mòbil.
  // El navegador avisarà que el certificat no és de confiança: cal acceptar-lo
  // una vegada des del telèfon.
  //
  // El service worker també ho necessita: fora de `localhost`, cap navegador
  // en registra un sense HTTPS. Sense basicSsl no es podria provar l'offline
  // al telèfon, que és exactament l'escenari real.
  plugins: [
    react(),
    basicSsl(),
    /*
     * `%SITE_URL%` a l'`index.html`.
     *
     * Vite ja substitueix `%BASE_URL%` sol, però només dona la ruta
     * (`/eclipsi/`), i les metadades socials volen l'origen sencer. Es fa amb
     * un connector de quatre línies en comptes d'escriure el domini a mà a vuit
     * etiquetes: així no hi ha vuit llocs que puguin divergir el dia que es
     * canviï de domini.
     */
    {
      name: 'eclipsi-site-url',
      transformIndexHtml: (html: string) => html.replaceAll('%SITE_URL%', SITE_URL),
    },
    {
      name: 'eclipsi-localised-indexes',
      async writeBundle(options) {
        const outDir = resolve(options.dir ?? 'dist')
        const html = await readFile(resolve(outDir, 'index.html'), 'utf8')
        await mkdir(resolve(outDir, 'es'), { recursive: true })
        await mkdir(resolve(outDir, 'en'), { recursive: true })
        await mkdir(resolve(outDir, 'fr'), { recursive: true })
        await writeFile(resolve(outDir, 'es/index.html'), spanishIndex(html), 'utf8')
        await writeFile(resolve(outDir, 'en/index.html'), englishIndex(html), 'utf8')
        await writeFile(resolve(outDir, 'fr/index.html'), frenchIndex(html), 'utf8')
      },
    },
    VitePWA({
      // 'prompt' i no 'autoUpdate' a propòsit. Una actualització automàtica
      // recarrega la pàgina quan el service worker nou pren el control. El 12
      // d'agost de 2026 la totalitat dura menys de dos minuts: una recàrrega
      // en aquell moment és una experiència arruïnada i irrepetible. Amb
      // 'prompt' l'usuari decideix quan.
      registerType: 'prompt',
      // Registrem nosaltres, des de `src/offline/registerServiceWorker.ts`,
      // per poder ensenyar l'avís d'actualització amb el nostre sistema de
      // disseny en comptes d'un `confirm()` del navegador.
      injectRegister: null,
      // El manifest és un fitxer estàtic escrit a mà a `public/`. Deixem que
      // el plugin no en generi cap: dos manifests competint pel mateix nom de
      // fitxer a `dist/` és una font de sorpreses.
      manifest: false,
      workbox: {
        // L'esquelet sencer: JS, CSS, HTML, icones i les tipografies
        // autoallotjades (woff2). Sense els woff2 al precache, la primera
        // obertura offline es veuria amb la tipografia de sistema.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff2}'],
        /*
         * LA TARGETA SOCIAL NO ES PRECACHEJA, I SÓN 320 kB.
         *
         * `og.png` és la imatge que ensenyen WhatsApp, X o Slack quan algú
         * comparteix un enllaç: qui la baixa és el RASTREJADOR d'aquells
         * serveis, des del servidor i sense passar mai pel service worker.
         * Dins de l'app no la pinta cap pantalla; només hi ha l'enllaç de
         * descàrrega del kit de premsa a «Com funciona». Precachejar-la era
         * prop d'un terç del pes d'instal·lació de tothom per a un fitxer que
         * l'usuari no veu mai — i el paga sencer la primera vegada que obre
         * l'app, que sovint és amb dades mòbils.
         */
        // El material editorial només es baixa quan algú el demana a Premsa;
        // no ha d'afegir més de 3 MB a la primera instal·lació de tothom.
        globIgnores: [
          '**/brand/og.png',
          '**/press/**',
          // Les pàgines SEO són documents HTML independents, generats després
          // de Workbox. Indexables i compartibles, però no formen part de la
          // instal·lació offline de l'app ni han d'inflar-ne el precache.
          '**/eclipsi/**',
          '**/eclipse/**',
          '**/ciutat/**',
          '**/ciudad/**',
          '**/city/**',
          '**/ville/**',
          '**/punt-oficial/**',
          '**/punto-oficial/**',
          '**/official-site/**',
          '**/site-officiel/**',
          '**/guia/**',
          '**/guide/**',
        ],
        // L'app és una SPA: qualsevol ruta ha de tornar l'esquelet. Ha
        // d'incloure el subdirectori, o el service worker respondria amb una
        // ruta que al servidor no existeix.
        navigateFallback: `${command === 'build' ? BASE : '/'}index.html`,
        // El worker de l'horitzó i astronomy-engine són trossos grossos; el
        // límit per defecte (2 MiB) els deixaria fora del precache i l'app no
        // podria calcular res offline.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // No reclamem els clients ja oberts a mitja sessió... excepte a la
        // primera visita, on sí que interessa: `clientsClaim` fa que el
        // service worker controli la pestanya de seguida, i això és el que
        // permet que un "prepara'm per anar-hi" fet un minut després
        // d'obrir l'app per primer cop passi ja pel service worker.
        clientsClaim: true,
        skipWaiting: false,
        runtimeCaching: [
          {
            // Tessel·les d'elevació terrarium (AWS Open Data, sense clau).
            // CacheFirst perquè el model digital del terreny és immutable:
            // demanar-lo per xarxa una segona vegada només gasta dades.
            urlPattern: /^https:\/\/s3\.amazonaws\.com\/elevation-tiles-prod\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: CACHE_TERRAIN,
              expiration: {
                // Un perfil d'horitzó de 150 km de radi són unes 700
                // tessel·les. 4000 deixa desar entre cinc i sis llocs
                // candidats sencers abans de començar a podar.
                maxEntries: 4000,
                maxAgeSeconds: ONE_YEAR_S,
                // Si el navegador ens diu que no hi cap més, buidem aquesta
                // memòria cau en comptes de deixar l'app trencada.
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Cartografia base. El patró cobreix els proveïdors de tessel·les
            // rasteritzades que fem servir o podríem fer servir; el que mana
            // de veritat és `BASEMAP` a src/offline/config.ts.
            urlPattern:
              /^https:\/\/(?:[a-d]\.)?(?:basemaps\.cartocdn\.com|tile\.openstreetmap\.org|tiles\.stadiamaps\.com|api\.maptiler\.com|demotiles\.maplibre\.org)\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: CACHE_BASEMAP,
              expiration: {
                maxEntries: 2500,
                maxAgeSeconds: ONE_YEAR_S,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            /*
             * ELS NOSTRES CATÀLEGS DE `public/data/`: miradors d'OSM,
             * climatologia de núvols. Són fitxers nostres i podrien anar al
             * precache afegint `json` als `globPatterns`, però NO hi van a
             * posta: pesen centenars de kB i només els necessita qui encén
             * aquelles capes del mapa. Al precache els pagaria tothom, en la
             * primera visita i abans de veure res.
             *
             * `StaleWhileRevalidate` i no `CacheFirst` perquè, a diferència
             * d'una tessel·la, aquests fitxers els regenerem nosaltres: qui
             * els tingui desats els segueix veient a l'instant (i sense
             * cobertura), i la versió nova entra silenciosament a la següent
             * visita amb xarxa.
             *
             * Ho vigila `src/offline/budget.test.ts`: cap fitxer de `public/`
             * pot quedar sense precache ni regla. Un JSON orfe no dona error
             * ni avís — al camp l'usuari només veu una capa que no hi és.
             */
            urlPattern: /\/data\/[^/]+\.json$/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: CACHE_DATA,
              /*
               * SENSE `purgeOnQuotaError`, i és a posta. Aquella opció no poda:
               * esborra el calaix SENCER. Per a les tessel·les és una decisió
               * defensable —n'hi ha milers i es tornen a baixar—, però aquests
               * catàlegs pesen kilobytes, són el que fa possible una capa
               * sencera i, un cop esborrats sense cobertura, no tornen. Si la
               * quota s'omple, val més que el navegador es mengi els calaixos
               * de tessel·les, que és on són els megabytes.
               */
              expiration: { maxEntries: 24, maxAgeSeconds: ONE_YEAR_S },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Desactivat en desenvolupament: un service worker viu mentre es fa
        // hot-reload serveix versions velles i fa perdre hores. Per provar
        // l'offline de veritat cal `npm run build && npm run preview`.
        enabled: false,
        type: 'module',
      },
    }),
  ],
  server: {
    // Escolta a totes les interfícies perquè el mòbil hi pugui arribar.
    host: true,
  },
}))
