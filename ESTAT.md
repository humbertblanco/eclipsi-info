# Estat del projecte

Document de traspàs. Diu **on som, què s'ha comprovat, què queda obert i què
no s'ha de tornar a trencar**. Actualitzat el 3 d'agost de 2026.

> Si ets un agent o un model que arriba nou: llegeix primer `CLAUDE.md` (les
> regles de com s'escriu aquí) i després aquest fitxer sencer. Els dos van
> junts; aquest mana.

---

## 1. Com es desplega

**EL DOMINI PRINCIPAL ÉS eclipsi.info** (vhost propi al mateix servidor,
subscripció `eclipsi.info` del client cosesdelhumbert, creat el 2-8-2026;
usuari de sistema `eclipsiinfo`). El build per defecte ja surt amb base `/` i
canònica `https://eclipsi.info/`.

**DNS PENDENT (2-8-2026):** els registres A de `@` i `www` cap a
37.187.151.83 els ha de posar l'Humbert al panell del registrador. Fins
llavors el vhost només respon per IP amb capçalera Host. Quan el DNS resolgui,
emetre el certificat Let's Encrypt des de Plesk (`plesk bin extension --exec
letsencrypt cli.php ...` o el botó SSL/TLS del panell) — sense certificat, la
càmera i el GPS no funcionen perquè el navegador exigeix HTTPS:

```bash
npm run build                     # SI AIXÒ FALLA, PARA. Vegeu l'avís de sota.
rsync -az --delete dist/ root@server.estic.online:/var/www/vhosts/eclipsi.info/httpdocs/
ssh root@server.estic.online 'chown -R eclipsiinfo:psaserv /var/www/vhosts/eclipsi.info/httpdocs/'
```

Després **verifica per checksum**, no per vista:

```bash
BUNDLE=$(ls -t dist/assets/index-*.js | head -1 | xargs basename)
shasum -a 256 dist/assets/$BUNDLE
curl -s "https://eclipsi.info/assets/$BUNDLE" | shasum -a 256
```

El desplegament de LLEGAT al camí antic (lacuinade.estic.online/eclipsi/), si
mai cal refer-lo, necessita les dues variables:

```bash
ECLIPSI_BASE=/eclipsi/ ECLIPSI_SITE_URL=https://lacuinade.estic.online/eclipsi/ npm run build
rsync -az --delete dist/ root@server.estic.online:/var/www/vhosts/lacuinade.estic.online/httpdocs/eclipsi/
```

**AVÍS QUE JA HA COSTAT DUES VEGADES:** `npm run build` pot fallar per un error
de tipus i deixar el `dist/` anterior intacte. Si després corres el `rsync`, el
que puges és la versió vella i sembla que el desplegament ha anat bé. Encadena
les dues comandes amb `&&` o mira la sortida del build abans de pujar.

**HI HA CLOUDFLARE AL DAVANT, I CACHEJA ELS 404 QUATRE HORES.** Això va tombar
el lloc el 3-8-2026 i la causa era la comprovació mateixa: es va demanar
`https://eclipsi.info/assets/index-XXXX.js` per curiositat ABANS de fer el
`rsync`. Aquella petició va tornar 404 —encara no hi era—, Cloudflare se'l va
desar amb `max-age=14400`, i quan el fitxer va arribar al servidor el CDN va
seguir servint el 404 durant hores. El resultat per a l'usuari: `index.html`
es serveix fresc (`cf-cache-status: DYNAMIC`), demana el seu paquet i rep un
404. Pantalla blanca, sense cap error al servidor i amb el fitxer al disc amb
el checksum correcte.

Tres regles que en surten:

1. **MAI demanis una URL d'actiu abans de pujar-la.** Ni per comprovar, ni per
   curiositat. Si el nom encara no existeix, l'estàs enverinant.
2. **La verificació per checksum va DESPRÉS del `rsync`, sempre**, i s'ha de
   fer per la URL pública, no per `ssh`: el fitxer al disc pot ser perfecte
   mentre el CDN serveix una altra cosa. `sha256sum` per `ssh` només serveix
   per distingir un problema de pujada d'un problema de cau.
3. **Si passa, la sortida ràpida és tornar a compilar.** El peu de l'app duu la
   data i hora de compilació, o sigui que cada build canvia el contingut del
   paquet i, amb ell, el seu nom amb hash. Un nom nou no té cap 404 desat i
   entra net. Purgar la cau de Cloudflare demanaria credencials que aquest
   projecte no té a mà.

Per saber si el que serveix el CDN és el que hi ha al disc, `?cb=<a l'atzar>`
salta la cau i respon amb l'origen: si amb el paràmetre el checksum quadra i
sense no, el problema és de cau i no de desplegament.

**El servidor és compartit.** `lacuinade.estic.online` allotja desenes de
vhosts. Toca NOMÉS `httpdocs/eclipsi/`. Res de reiniciar serveis, tocar
configuració global ni res que surti d'aquella carpeta.

### Saber quina versió corres

El peu de l'app diu la data i hora de compilació (`2026-08-01 16:42`). Amb el
service worker registrat, això no és una curiositat: és l'única manera de
distingir el que acabes de pujar del que el navegador et serveix de memòria.

---

## 2. On són les coses

`src/core` és el motor i **no depèn del DOM** — corre a Node i és on viu el
gruix de les proves. `src/features` són les vistes. `src/ui` és el sistema de
disseny. `src/screens` són les quatre pantalles.

| Carpeta | Què decideix |
|---|---|
| `core/astro` | Contactes, obscuració, incertesa del caire, gradient, moviment de l'ombra |
| `core/eclipses` | Elements besselians i trajectòria de la franja |
| `core/horizon` | Tessel·les de terreny i perfil d'horitzó de 360° |
| `core/visibility` | El veredicte: quants segons sobreviuen al relleu |
| `core/timer` | Compte enrere, veu i **comporta de seguretat ocular** |
| `core/places` | Topònims (Photon/OSM) |
| `core/spots` | Cercador de llocs millors a prop |
| `features/ar` | Càmera, fusió de sensors, **ancoratge al terreny** |
| `offline` | Service worker i precàrrega per anar sense cobertura |
| `core/heat` | Mapa de calor de visibilitat: graella, càlcul en dos nivells i memòria cau |
| `core/timeline` | El rellotge de simulació, pur i sense navegador |
| `core/analytics` | Vocabulari tancat d'esdeveniments i la porta de privadesa |
| `core/geo` | Geometria esfèrica compartida (sectors, polilínies) |
| `data/observation-points` | Catàleg curat de punts oficials, amb font i enllaç |
| `features/map/layers` | Una capa de MapLibre per fitxer, totes idempotents |

**Els generadors de dades i d'actius viuen a `scripts/`** i es corren a mà:
`build-minimap.ts` (la imatge base de la portada), `build-og.ts` (la targeta
social), `build-viewpoints.ts` (miradors i cims d'OSM via Overpass),
`build-cloud-clim.ts` (la climatologia de núvols d'Open-Meteo, amb punt de
control per poder-la reprendre entre finestres horàries). Cap d'ells no corre
al build: el que es publica són els seus resultats, comitejats.

---

## 3. Coses que no s'han de tornar a trencar

Cadascuna va costar trobar-la i cadascuna té un test que la vigila. Si un
d'aquests tests es posa vermell, **no el toquis: has trencat alguna cosa**.

1. **La comporta de seguretat ocular** (`core/timer/safety.ts`). Ha estat codi
   mort DUES vegades, cada cop una capa més enfora: primer perquè
   `ScheduleInput` no tenia el camp, després perquè `useEclipseTimer` muntava
   la llista a mà i s'oblidava de passar-l'hi. Qualsevol camí nou que parli de
   treure's el filtre ha de passar per `canRemoveFilter`. Tests:
   `core/timer/edge-gate.test.ts`, `features/countdown/timer-gate.test.ts`,
   `features/ar/naked-eye.test.ts`.
2. **El 99,7 % no és 100 %.** La regla viu a `core/astro/obscuration.ts` i s'ha
   escrit per separat a nou llocs diferents al llarg del projecte, mentint a
   set. Si necessites formatar una obscuració, importa-la.
3. **La franja ha de ser DIBUIXABLE, no només correcta.** La trajectòria del
   2026 passa pel pol i Web Mercator no ho pot projectar: el mapa sortia sense
   franja amb la geometria perfecta. Test: `core/eclipses/path.test.ts`.
4. **El mapa i la precàrrega han de demanar la mateixa URL de tessel·la.** Les
   memòries cau es claven a la URL sencera. Test:
   `offline/basemap-agreement.test.ts`.
5. **Un horitzó a mitges no es publica.** Amb una tessel·la de cent cinquanta,
   el perfil surt pla i optimista i l'app diu «102,1 s de 102,1» on la realitat
   és zero. El llindar és el 95 % a `core/horizon/raycast.ts`.
7. **Un actiu binari no es revisa llegint el diff: se'n miren els PÍXELS.**
   `public/brand/minimapa-iberia.png` es va publicar amb 1296×1008 píxels a
   (0,0,0,0) —transparent i negre alhora— i va arribar al lloc publicat: el
   mini-mapa de la portada ensenyava la franja surant damunt del no-res i el
   `filter: brightness(1.9)` del CSS no hi podia fer res, perquè 1,9 per zero
   segueix sent zero. Ara la imatge la fa `scripts/build-minimap.ts` (RGB sense
   canal alfa a posta: així aquell error és impossible per construcció) i hi ha
   dues proves que miren píxels de veritat, `features/map/minimap-asset.test.ts`
   i `tests/actius-binaris.test.ts`. La segona tanca l'inventari: tot PNG o SVG
   publicat ha d'estar declarat.
8. **Cap frase per a l'usuari neix a `src/core`.** El nucli dona CODIS amb les
   seves xifres (`core/horizon/errors.ts`, `core/spots/errors.ts`,
   `SpotSearchProgress.stage`) i la frase la munta la capa de vista, que és
   l'única que sap en quin idioma s'està parlant. Hi havia errors i canals de
   progrés escrits en català que arribaven tal qual a qui llegeix en castellà.
9. **Tota URL que l'app demani surt de `src/offline/config.ts` i té regla al
   service worker.** L'invariant 4 s'amplia més enllà de la cartografia: també
   les tessel·les d'elevació del relleu ombrejat
   (`offline/terrain-agreement.test.ts`) i els catàlegs de `public/data/`
   (`offline/budget.test.ts`), que no van al precache sinó a `eclipsi-dades-v1`
   perquè pesen centenars de kB i només els necessita qui encén aquelles capes.
   Un JSON orfe no dona error ni avís: al camp, l'usuari només veu una capa que
   no hi és.
6. **El calibratge de la focal es reinicia en aplicar-se.** Si no, el guany es
   mesura contra una focal i s'aplica a una altra, i el camp de visió cau de 50°
   a 25° en tres segons — i es desa.

---

## 4. Què queda obert

L'auditoria de l'agost de 2026 (sis revisions independents, cada punt
verificat corrent el codi) va llistar onze coses. El 2-8-2026 es van tancar
totes les de gravetat alta: la `k` mitjana (ara magnitud, obscuració i disc
surten del radi umbral — el daurat de `circumstances.test.ts` vigila que no
torni), el paquet d'1,52 MB (React.lazy: 384 kB de primera pintada), la
càmera que no sobrevivia la pèrdua de pista, el `-0` de l'inventari offline
(amb migració en llegir), les coordenades amb punt, els vuit ambres de la
guia (vocabulari fixat al tipus `Tone`), el rellotge mai qüestionat
(`features/clock` contra el servidor, amb la incertesa dita) i el cercador
de llocs i l'enquadrament sense pantalla (les 5 vistes del mapa). La
discrepància ΔT dels dos motors d'ombra NO es toca: és decisió de producte
(vegeu §5). El que segueix és el que QUEDA.

**El 3-8-2026 (matinada) es va fer la gran passada de disseny i pàgines**,
amb orquestració multiagent i verificació visual real a 390 i 1440 px. Tancat:
la guia amb escriptori de debò (dues columnes, índex enganxós, àncores per
secció), el bàner de lloc que es plega en desplaçar (histèresi, mai amb el
punt d'exemple), **rutes hash** (`#/mapa`, `#/cel`, `#/guia/<secció>`,
`#/com-funciona` — l'Enrere del navegador ja no expulsa de l'app), la pantalla
nova **«Com funciona»** amb bloc de premsa (logos, og.png, descripcions per
copiar), el countdown d'escriptori equilibrat (taula d'efemèrides a la dreta,
una sola còpia visible), el mapa amb cerca de topònims (marcador blau amb el
nom del lloc), miniatura de la trajectòria i diàleg de crèdits/ODbL, la fitxa
del mapa capada a 45dvh a mòbil, el mode **«Durant»** (la prosa del guió de la
totalitat per fi es llegeix, lligada al mateix rellotge que la veu), el tint
del cel del punt al card del compte enrere (core/sky), la targeta social
1200×630 pròpia (`public/brand/og.png` + `summary_large_image`), robots.txt,
sitemap.xml, 404.html i .htaccess, les tres contradiccions de contingut
(altures del Sol pel motor, el 2027 és de matí, lux amb enfosquiment de
limbe), el canal de progrés de l'horitzó en CODIS bilingües, l'AR sense bucle
amb la càmera tancada i pintant al ritme real del vídeo, el smoke amb 187
assercions i els tres eclipsis, `strict` a `tsconfig.app.json`, fora els
`.woff` morts (els `@font-face` van escrits a mà — i **els `@import` dels
tokens HAN D'ANAR ABANS de qualsevol regla** o el CSS els descarta en silenci:
ja va passar), el contrast AA del distintiu ennuvolat, els ~17 tokens
fantasmes d'`align.css`, el desempat del geocodificador (ciutat/municipi) i el
llindar 20→40 s de `gate-invariant`.

**La segona onada del mateix dia** (reports de camp de l'usuari, tot amb test):
la DENT de 40 km al límit nord del 2026 vora Menorca (pathLimitsAt triava el
tall de limbe espuri; ara la tangència mana mentre viu i el més extrem només
desempata talls — el mateix criteri va salvar la derivació d'incertesa, que
per 13 metres transversals entre punts a 650 km saltava de branca al 2028);
«Ubica'm» que no responia (el timeout del GPS no corre amb el diàleg de
permís descartat: gos guardià de 18 s, errors en caixa `--status-danger` que
el mode compacte no pot plegar, la fulla es tanca en èxit); la fulla «On
seràs» amb el cercador com a camp universal (entén coordenades enganxades,
comes decimals incloses; el camp tècnic, plegat); topònims, xinxetes
numerades i «Comparteix» amb enllaç propi a cada lloc candidat; la targeta
de compartir ensenya EL CEL DEL MÀXIM (renderEclipseSky) amb l'adreça
impresa, i el porta-retalls surt amb enllaç i imatge alhora; la fitxa del
mapa a mòbil amb trio de xifres + línia C1–C4 dins del 45dvh; noms per
davant de coordenades a Dateline, portada i capçalera; el peu reduït a
signatura + privacitat + meta (les fonts, senceres a «Com funciona» i al
diàleg del mapa); l'aparador de la càmera a la portada.

**EL 3 D'AGOST, LA RESPOSTA AL MAPA DE LA COMPETÈNCIA.** app.treseclipses.es
(freemium, 9,99 €) té una cosa que semblava relleu i és un **mapa de calor de
qualitat d'observació** sobre ombrejat, amb punts oficials, 22.000 miradors,
nuvolositat històrica i una línia de temps 1x-600x. La ironia era que
nosaltres ja teníem el motor que ells venen —horitzó 360° per DEM,
`computeVisibility`, `core/spots`, la incertesa del caire— i el mapa pintava un
raster pla que no ho ensenyava. El que s'ha tancat:

- **Relleu ombrejat** amb LES MATEIXES tessel·les terrarium que ja baixava
  l'horitzó (cap dada nova, memòria cau compartida), i amb la llum posada a
  l'azimut del Sol al màxim del teu punt i ancorada al MAPA, no a la pantalla:
  els vessants foscos són els que estaran a contrallum aquella tarda. El primer
  intent no es veia —ombra negra sobre mapa negre—; qui dibuixa el relleu aquí
  és la llum.
- **Con de visió** de C1 a C4, amb el radi fins a l'obstacle que et fa
  d'horitzó en aquell rumb, i **control de capes** que recorda la tria.
- **La fitxa diu cap on miraràs i amb quant de marge sobre el terreny.** A
  Tafalla: oest 283,7°, 6,9°. Les mateixes xifres que dona la competència, més
  els segons visibles que ells no donen.
- **Analítica d'ús** (`core/analytics` + `analytics/gtag.ts`) amb la porta de
  privadesa escrita com a codi: només passen paraules d'una llista tancada,
  cap número mai. Una latitud és un número. El retall de l'adreça és
  paràmetre GLOBAL perquè la mesura millorada de GA4 envia vistes pel seu
  compte a cada `replaceState`, i aquesta app en fa un a cada toc al mapa.
- **Rellotge de simulació** reutilitzable (`core/timeline`) amb el seu
  reproductor, que distingeix sempre simulació de temps real.

**LA FAMÍLIA D'ERRORS DEL 3 D'AGOST, que val més que la llista de funcions.**
Tot el que va sortir malament aquell dia tenia la mateixa forma: *una cosa
construïda a sobre d'una altra que ningú no havia comparat mai amb res*. Val la
pena tenir-la present abans d'afegir res:

| Què semblava correcte | Què li faltava |
|---|---|
| La franja dibuixada al mapa | Ningú comparava **el dibuixat** amb **el calculat**. Deixava València fora amb 62 s de totalitat |
| El text del catàleg i de la guia | Ningú comparava **el text** amb **el motor**. Anunciava «Galícia» d'una franja que no passa per Vigo ni Santiago |
| La imatge base del mini-mapa | Ningú en mirava **un sol píxel**. Es va publicar transparent de dalt a baix |
| El catàleg de miradors | Extret amb una màscara amb forat: no s'havia demanat mai res de Mallorca ni d'Eivissa |
| La capa de vora d'incertesa | Escrita, provada i connectada… i el pare no li passava mai les dades |
| El JSON dels miradors al servidor | Ni al precache ni a cap regla: al camp la capa no hi hauria estat, sense error |

La conseqüència pràctica: **quan facis una cosa nova, pregunta't què la compara
amb la realitat.** Si la resposta és «res», aquella és la feina que falta. Les
proves noves que en van sortir són `band-agreement.test.ts`,
`afirmacions-del-text.test.ts`, `actius-binaris.test.ts`,
`minimap-asset.test.ts`, `terrain-agreement.test.ts` i `budget.test.ts`.

### Mitjà

- **Cap component de React té cap test.** `vitest.config.ts` només inclou
  `*.test.ts` amb entorn `node`, i no hi ha ni un `*.test.tsx`. La política
  fins ara: les parts pures es testegen (i en tenen molts), el render queda al
  protocol manual. Si mai es munta jsdom, començar pels components amb lògica
  de decisió (LocationSheet, CloudPanel, i ara el col·lapse del bàner i el
  mode «Durant»), no pels de pintar.
- **Els ERRORS de l'horitzó encara viatgen en català** (el PROGRÉS ja són
  codis): «Només s'han pogut baixar X de N tessel·les…» arriba tal qual a
  l'usuari ES. Mateix camí pendent per als canals de progrés de
  `core/spots/search.ts` i `offline/prepare.ts`.

- **La climatologia de núvols està a mitges, i a posta.** El 2026 té 888
  cel·les amb 12-13 anys (2011-2023): el sostre horari d'Open-Meteo va tallar
  la sèrie i el fitxer ho diu ell mateix. Falten el 2024 i el 2025 (~1.130
  crides, una finestra horària neta) i **els eclipsis del 2027 i del 2028 no
  estan generats**: 5.280 i 8.863 crides, tres dies de pla gratuït. Es reprèn
  amb `npx tsx scripts/build-cloud-clim.ts <eclipseId>` — el punt de control va
  per casella de la malla i sobreviu als canvis de geometria de la franja.
- **Els punts oficials del 2027 i del 2028 estan buits, i és la resposta
  correcta.** Es va comprovar font per font el 3-8-2026: el portal de l'Estat
  només enllaça portals autonòmics, tots del 2026; Andalusia (la franja del
  2027) encara està DECIDINT els emplaçaments —la jornada del 2 d'agost va ser
  l'assaig de camp per triar-los— i Múrcia diu que «estudia» els espais. Tot el
  que hi ha publicat per al nord d'Àfrica són paquets d'agències. Inventar-se un
  punt oficial és pitjor que no tenir-ne: algú hi conduiria.
- **`nearestSeaLevelLimit` és inestable a l'últim minut de la trajectòria**, i
  ja ho era abans de les tapes del terminador: salta 200 km entre segons
  consecutius. Es va deixar sense tocar a posta perquè arreglar-ho demana
  revalidar `uncertainty.ts` contra l'IGN, que és una feina amb el seu propi
  daurat. Candidat clar per a la propera sessió.

### Baix

- Diversos tests asserteixen damunt dels seus propis simulacres o dins de
  bucles que poden no córrer cap vegada (`search.test.ts:328,338,356,411,468`,
  `schedule.test.ts:180-187`).
- `design-reference/_adherence.oxlintrc.json` (anti-hex, anti-px, whitelists
  de props) segueix sense connectar a `.oxlintrc.json`.
- Tota la tipografia és en px absoluts: el zoom de font del navegador no fa
  res. El pas a rem és mecànic (÷16) però demana verificació visual sencera.
- Cap `prefers-contrast` ni `prefers-reduced-transparency` per al crom de
  vidre amb blur(18px).
- Les pestanyes per moment de la guia (Abans/Durant/Fotografia) i la landing
  pública prerenderitzada queden DESCARTADES de moment per decisió d'usuari
  (2-8-2026): l'arrel és l'app, sense passos intermedis.

---

## 5. Decisions que s'han pres i per què

Perquè no es desfacin per accident.

- **Català per defecte**, castellà al selector de la capçalera. Res de detectar
  l'idioma del navegador: es va treure a posta.
- **L'altitud MAI del GPS.** L'error vertical d'un GPS de mòbil és de ±10 a
  ±30 m i trenta metres canvien el veredicte de si una muntanya et tapa el Sol.
  La posició horitzontal sí que és bona, i amb ella el model del terreny dona
  l'altitud molt millor que el propi GPS.
- **Un sol ambre per pantalla**, i és de la xifra que decideix. `--status-partial`
  és el mateix hexadecimal que `--accent`: fer-lo servir compta com un segon
  ambre.
- **No es demana res sense explicar-ho abans.** La ubicació té una pantalla
  d'introducció pròpia; la càmera no s'obre mai sola.
- **La càmera no es calibra tocant el Sol.** Ho feia i es va treure: demanava
  apuntar el dit a un Sol que encara no hi és, o mirar-lo per encertar-lo.
- **La ΔT dels dos motors d'ombra NO s'unifica, a posta.** La franja del mapa
  (`besselian.ts`, ΔT 71,4-71,9 s) i el motor de punts (`deltaT.ts`, 69,19-69,32 s
  IERS) discrepen 2,9 km — però la ΔT només n'explica 0,41; la resta és el residu
  entre `astronomy-engine` i DE441, que no és a les nostres mans. Unificar-la
  faria que la franja dibuixada DISCREPÉS de les taules publicades de la NASA i
  de l'IGN, que és amb qui la compara tothom, per guanyar 400 m d'una precisió
  que el motor no té. El test daurat ho diu literalment: «que ningú no hi perdi
  temps». `edgeUncertain` ja fa que la interfície digui «al caire, ves-hi amb
  marge» exactament on aquests quilòmetres importen.
- **`src/core` no toca el DOM.** L'única excepció que queda és el
  `document.createElement('canvas')` de reserva a `horizon/elevation.ts`, que
  dins d'un Worker peta i es reporta com un problema de connexió.

---

## 6. La part de la càmera, que és la que costa

És el que l'usuari considera la funció diferencial. Tres capes que se sumen:

1. **Sensors** (`useDeviceOrientation` → `smoothing`): quaternions i filtre d'un
   euro amb terra de soroll. Sol, tremola 0,20° amb una brúixola normal. A iOS,
   el quaternió es construeix amb l'alpha RELATIVA més un offset de guinyada
   après del compass (`iosHeading`), pesat per la postura i congelat apuntant
   amunt: el compass ja no entra disfressat d'alpha, que era el que feia lliscar
   l'azimut en inclinar.
2. **Seguiment visual** (`visualTracker`): compara fotogrames. És RELATIU i
   necessita textura — apuntant a cel serè no en troba i retorna `null`. Graella
   de 3×5 (el costat llarg, el vertical en mà, té cinc files: el cel es menja
   les de dalt), pista de roll del sensor, comptador de fotogrames fosos,
   igualació d'exposició, i `pitchDegraded` quan el braç de palanca vertical
   col·lapsa — llavors la fusió fa recular NOMÉS l'altura cap al sensor.
3. **Ancoratge al terreny** (`skyline`): detecta la silueta de la muntanya i
   l'aparella amb la que el model del terreny diu que hi ha d'haver. És
   ABSOLUT: no deriva, i corregeix la brúixola de passada. Mesurat al banc,
   recupera un error de brúixola de 10° fins a menys de 0,5°. Endurit: la
   predicció per columna es llavora i comprova convergència (NaN si no), la
   silueta ha de cobrir el 35% de l'amplada, un horitzó pla dona un fix
   `altitudeOnly` (altura sí, azimut no — i no toca el biaix d'azimut), un fix
   que afirmi més de 3° d'error d'altura es descarta (l'acceleròmetre no pot
   anar tan errat: allò és una teulada), i corre a ~10 Hz.
4. **Àncora de Sol** (`sunAnchor`): la taca que satura el sensor contra les
   efemèrides DE L'INSTANT REAL (mai el del simulador). És el calibratge
   automàtic cap on apuntava la decisió del §5: no demana res a ningú. Detecta
   per components connexes del sostre del rang (autonormalitzat), poda per
   compacitat, rebutja fantasmes de lent per col·linearitat amb el centre
   òptic, refina el centroide a resolució plena (~0,05°), corregeix el
   centroide del CREIXENT durant la parcialitat (integració d'anells de
   `solarDisc`, validada contra 2D al banc) i s'apaga amb el flux a tocar de
   la totalitat. Portes: ±25° az, ±3° alt, mai sota la carena del model. De
   nit, la Lluna (assajos). Els fixos de Sol i terreny es FUSIONEN
   (`mergeAnchors`): fallen al revés l'un de l'altre, i als eclipsis d'aquest
   catàleg — Sol arran d'horitzó — el cas normal és tenir tots dos al quadre.

La FUSIÓ (`poseFusion`) té dues regles amb física pròpia:

- **El biaix és asimètric.** El d'azimut corregeix el magnetòmetre: fins a
  ±40°, no caduca mai, i s'aprèn de l'error del fix MESURAT A LA CAPTURA
  (`anchorBias`), que és independent de la postura i per això segueix
  aprenent a mig gest. El d'altura corregeix una referència, no el sensor
  (l'acceleròmetre va fi a dècimes): es capa a ±1,5° i caduca (τ 12 s) quan
  no hi ha terreny a la vista. Abans un skyline fals podia ensenyar 40° de
  biaix vertical per sempre — el «queda tort i no es recupera» del camp.
- **Quiet vol dir quiet.** Les correccions (estirada + àncora, com a suma) es
  retallen a 0,3°/s amb el mòbil parat: per sota del que l'ull distingeix
  d'estar clavat. El límit s'obre amb la velocitat, la seva cua (1,5 s) i
  l'excés de desalineació (>1° — l'arrencada amb la brúixola fora va igual de
  ràpida que sempre). El sostre dur de 8° queda fora del retall. I la
  discrepància imatge−sensor es limita a 1,5° per fotograma: cap
  correspondència falsa no es pot injectar sencera.

La tercera capa és la que fa que es quedi quiet, i és la que cap altra app pot
fer perquè cap altra té el perfil d'horitzó del punt de l'usuari. El banc
sintètic ara també sap fer obturador rodant (`renderFrameRS`), rampes
d'exposició i ancoratge dins de `runSequence`: el gest d'inclinar amb àncora
queda a ~1° pic a pic durant el gest i recollit a <0,3° als dos segons.

DUES MILLORES TRANSVERSALS DE TEMPS: cada fotograma de càmera es compara amb
la postura DE QUAN ES VA CAPTURAR (`poseHistory` + `frameCaptureMs` — exacte
amb `metadata.captureTime` a Chrome, estimat −50 ms a Safari; abans es colaven
40-80 ms de canonada sencers a totes les mesures), i la postura DIBUIXADA
s'empeny ~30 ms endavant amb el giroscopi cru (`motionPredict`,
`devicemotion.rotationRate`, costat de la multiplicació clavat al banc contra
Euler) — el retard percebut en moviment queda a ~zero.

LA SEGONA RONDA DE QUIETUD (després del primer camp): amb el cel ras i el
mòbil quiet, si el sensor no declara moviment (<5°/s) i cap àncora vigila,
NO s'integra res i es rebasa la referència — el soroll de brúixola ja no
passeja la postura; els residus de menys d'una dècima es tanquen a 0,05°/s
(rampa contínua de banda morta). El Sol es mesura ara A CADA FOTOGRAMA (el
camí complet amb totes les portes — l'adquisició ÉS el seguiment, sense
màquina d'estats que pugui seguir un núvol): l'àncora mai té més de 33 ms i
aguanta el gest fins a ~30-40°/s; la silueta es queda al tick i només vota
fresca (≤250 ms). Els blocs del seguidor són ADAPTATIUS (fins a 18, triats
per variància amb punt-més-llunyà; `pitchDegraded` amb l'abast vertical com
a únic àrbitre). I hi ha CAPTURA: composició vídeo+fosc de l'eclipsi
(ctx.filter, amb vel de recanvi a iOS<18)+overlay+peu → share natiu.

LA PANTALLA: `ARView` accepta `chrome/timeMs/onTimeChange/mode/onState`
(l'antic backlog AR_PROPS_NEEDED, saldat — un sol rellotge per pantalla), i
amb la càmera oberta l'app entra en MODE IMMERSIU (`.shell--immersive`:
barres a 0px amb unitat i tot el que en deriva segueix sol; sortida = botó de
tancar de la càmera, i qualsevol camí que la tanqui restaura les barres).
Píndola de lloc al HUD (cap xifra sense el seu lloc), wake lock amb càmera
oberta, fletxa de guia cap al Sol a la vora del marc, coach del vuit quan la
brúixola balla, pols de confirmació quan el Sol queda fixat i insígnia de qui
aguanta l'overlay. Els dos avisos de seguretat ocular, intactes i no
descartables.

LA PISTA JA ES VIGILA (2-8-2026, `watchTrackLoss` a `camera.ts`): si el
sistema pren la càmera ('ended' — trucada, càmera nativa) tot s'apaga pel
camí únic i la invitació torna amb el motiu escrit, represa d'un toc; si la
silencia ('mute'/'unmute' — segon pla) surt un rètol de vidre i el
rastrejador perd la referència als dos costats del silenci, perquè un
fotograma congelat li semblaria quietud perfecta amb confiança plena.

**El que encara falta a la càmera**: el bucle de dibuix corre encara que la
càmera no estigui oberta; es
dibuixen 60 fotogrames per segon quan la càmera només en dona 30 (el cost del
cos surt ara al panell de diagnòstic, `ms de dibuix`); i l'offset d'iOS
congelat apuntant amunt deixa la deriva del giroscopi sense correcció si no hi
ha NI terreny a la vista NI estones per sota de 35° — acceptable per als
eclipsis del 2026/2028, que passen arran d'horitzó, però mesurable al camp
amb el panell (`heading` vs pitch) si mai cal el pes mínim residual.
