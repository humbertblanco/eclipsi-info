import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

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
