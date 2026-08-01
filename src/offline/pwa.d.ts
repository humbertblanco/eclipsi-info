/**
 * Tipus dels mòduls virtuals de vite-plugin-pwa (`virtual:pwa-register`).
 *
 * Van aquí i no a `tsconfig.app.json` perquè tota la feina d'offline és
 * autocontinguda a `src/offline/**`: qui reorganitzi el projecte no ha de
 * descobrir que hi ha una entrada de tipus perduda en un fitxer de
 * configuració.
 */
/// <reference types="vite-plugin-pwa/client" />
