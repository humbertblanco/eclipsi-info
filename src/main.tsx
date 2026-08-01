import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Primer el sistema de disseny (tipografies + tokens), després els estils de
// l'aplicació, que en consumeixen les variables. Invertir l'ordre deixaria les
// variables sense resoldre.
import './styles/index.css'
import './index.css'
import App from './App.tsx'
import { initServiceWorker } from './offline/registerServiceWorker'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
