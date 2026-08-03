import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Primer el sistema de disseny (tipografies + tokens), després els estils de
// l'aplicació, que en consumeixen les variables. Invertir l'ordre deixaria les
// variables sense resoldre.
import './styles/index.css'
import './index.css'
import App from './App.tsx'
import { initServiceWorker } from './offline/registerServiceWorker'
import { installGtagAnalytics } from './analytics/gtag'

/*
 * EL SERVICE WORKER ES REGISTRA AQUÍ, I FINS ARA NO ES REGISTRAVA ENLLOC.
 *
 * `dist/sw.js` es construïa i es pujava a producció, i no el cridava ningú:
 * `injectRegister: null` a la configuració de Vite i cap import d'`src/offline`
 * en tot el projecte. O sigui que tota la capa de funcionament sense xarxa era
 * codi mort. Les tessel·les del terreny —deu o vint megabytes per perfil
 * d'horitzó— i les del mapa no es guardaven enlloc més que a la memòria cau
 * del navegador, i el dia de l'eclipsi, dalt d'un turó i sense cobertura,
 * l'app no podia calcular l'horitzó. Que és la seva raó de ser.
 *
 * Va abans de `createRoot` perquè el registre no depèn de React i com més
 * aviat comenci, més aviat hi ha memòria cau.
 */
initServiceWorker()

/*
 * L'ANALÍTICA S'ENGANXA AQUÍ, I ÉS UNA LÍNIA QUE VAL PER TOT EL MÒDUL.
 *
 * `src/core/analytics` no sap que Google Analytics existeix: sap el vocabulari,
 * la porta de privadesa i les franges, i escup els esdeveniments cap a la
 * frontera que li declarin. Aquesta crida és la declaració, i és l'única.
 * Sense ella, `track()` segueix funcionant a tot arreu i no envia res —que és
 * el que ha de passar als tests i a qualsevol eina que carregui l'app fora
 * d'un navegador—, però a producció seria una capa sencera de codi mort.
 *
 * AQUEST PROJECTE JA HI HA CAIGUT: `UpdatePrompt` es muntava dins d'un panell
 * que no muntava ningú i les versions noves s'instal·laven sense poder-se
 * activar; el service worker es compilava i no el registrava cap línia. Per
 * això la connexió va al costat d'`initServiceWorker`, a la vista, i no
 * amagada dins d'un component.
 *
 * NO ENVIA CAP VISTA DE PÀGINA: d'això se n'encarrega `index.html` amb el seu
 * escoltador de `hashchange`, i n'hi ha d'haver un de sol.
 */
installGtagAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
