# Instruccions per a qui treballi en aquest projecte

Això és `eclipsi.info`: una aplicació que respon **quants segons d'eclipsi
veuràs des d'on seràs**. No és un simulador astronòmic ni una fitxa de dades:
és una eina per decidir on plantar-se el 12 d'agost del 2026.

Llegeix **`ESTAT.md`** abans de tocar res. És el document de traspàs i mana
sobre aquest fitxer: hi ha què s'ha desplegat, què no s'ha de tornar a trencar
i per què s'ha decidit cada cosa.

---

## Les regles que no es negocien

**1. El to del codi ÉS el producte.** Cada fitxer comença amb una capçalera en
català que explica **quina decisió es va prendre i per què**, no què fa el codi.
Amb els números mesurats i els errors passats escrits amb totes les lletres.
Models a imitar: `src/core/spots/search.ts`, `src/core/eclipses/path.ts`,
`src/features/map/minimapFrame.ts`, `src/offline/basemap-agreement.test.ts`.
Un comentari que digui «aquesta funció calcula la durada» és soroll; un que
digui «això ja va fallar dues vegades i per això la comprovació és aquí» val el
que costa.

**2. Honestedat radical amb les xifres.** Una estimació no es vesteix mai de
mesura. El 99,7 % no és 100 % (`core/astro/obscuration.ts`: importa-la, no la
reescriguis). Una graella de 25 km no es pinta com si fos una foto. Una
climatologia de 12 anys no s'anuncia com una de 15. Quan una font oficial
contradiu el nostre motor, **guanya el motor i s'escriu per què**.

**3. Un sol accent ambre per pantalla**, i és el de la xifra que decideix. Al
mapa, l'ambre és de la franja: cap capa nova pot ser ambre. El vermell vol dir
seguretat ocular i no es gasta en res més. Colors sempre via `readPalette()` /
`withAlpha()` de `src/styles/palette.ts`, mai hexadecimals escrits a mà.

**4. Res no es demana ni es baixa sense explicar-ho abans.** La ubicació té
pantalla d'introducció pròpia, la càmera no s'obre mai sola, i una capa que
baixa megabytes ho diu a la descripció **abans** que toquis l'interruptor.

**5. `src/core` no toca el DOM.** Corre a Node i dins de Workers. El càlcul
pesat va a un Worker; la vista rep dades, no promeses de feina.

**6. Cap frase per a l'usuari neix a `src/core`.** El nucli dona **codis** amb
les seves xifres i la capa de vista hi posa les paraules — és l'única que sap en
quin idioma s'està parlant. Català per defecte, castellà al selector; res de
detectar l'idioma del navegador.

**7. La privacitat és una promesa escrita.** El peu diu que la teva ubicació no
surt d'aquí. Cap coordenada, cap topònim i cap adreça amb consulta pot sortir
cap a fora. La porta és codi provat (`src/core/analytics/sanitize.ts`): només
passen paraules d'una llista tancada, **cap número mai**.

---

## Com es prova

- **Vitest**, entorn `node`, fitxers `*.test.ts`. Els tests de `src/` es
  comproven amb `tsconfig.test.json` (tenen tipus de Node i poden llegir del
  disc); `tsconfig.app.json` els exclou a posta.
- Els noms dels tests són frases en català: `«el mar no és un lloc»`,
  `«un horitzó a mitges no es publica»`.
- **Un test ha de provar la decisió, no el marcatge.** Si et trobes assertant
  classes de CSS o comptant nodes, has triat malament el cas.
- **Els tests que menteixen són pitjor que no tenir-ne.** Vigila els que
  s'asserteixen damunt del seu propi simulacre, els que viuen dins d'un bucle
  que pot no córrer cap vegada, i els que comparen contra el valor equivocat i
  passen per casualitat.
- Abans de donar res per bo: `npx tsc -b && npx vitest run`.

## Com es desplega

Ho explica `ESTAT.md` §1 amb detall. El resum del que costa car:

- `npm run build` pot fallar i deixar el `dist/` anterior intacte: encadena amb
  `&&` o el `rsync` puja la versió vella i sembla que ha anat bé.
- **Hi ha Cloudflare al davant i cacheja els 404 quatre hores.** No demanis mai
  la URL d'un actiu abans de pujar-lo, ni per comprovar. Verifica per checksum
  **després** del `rsync` i per la URL pública.

---

## El mapa, que és on hi ha més coses alhora

L'ordre de les capes és la jerarquia de la resposta, i es declara a
`EclipseMap.syncLayers`:

```
relleu i núvols   → CONTEXT: sota la franja, mai la poden tapar
mapa de calor     → DADA: sota la vora ambre
franja            → LA RESPOSTA, i l'únic ambre
xinxetes          → LLOCS: a sobre de tot, perquè es puguin tocar
```

**El commutador de la fitxa** (Franja, Núvols, Durada, Llocs, Enquadra) respon
preguntes *sobre el teu punt*. **El plafó de capes** només té les capes
transversals, les que descriuen territori. Les altres van lligades a la seva
pestanya: tenir-ne dos comandaments és demanar que un dia discrepin.

Trampes de MapLibre que ja han costat feina:
- Reparteix el **mateix** clic als escoltadors de capa i als globals. Sense una
  porta, tocar una xinxeta n'obre la fitxa **i** et mou el punt.
- `hillshade-illumination-anchor` és `viewport` per defecte: sense posar-lo a
  `map`, els graus d'azimut no volen dir res geogràfic.
- Les tres peces de la franja (farciment, vores, línia central) han de sortir de
  la **mateixa** font. Si es calculen a part, apareixen vores surant al mar.

---

## Coses que semblen correctes i no ho són

Aquest projecte ha acumulat una família d'errors que val la pena conèixer,
perquè totes tenien la mateixa forma: **una cosa construïda a sobre d'una altra
que ningú no havia comparat mai amb res**.

- El mapa dibuixava una franja que deixava València fora, amb 62 segons de
  totalitat. Cap prova comparava **el que es dibuixa** amb **el que es calcula**.
- El text anunciava «Galícia» d'una franja que no passa per Vigo ni Santiago.
  Cap prova comparava **el text** amb **el motor**.
- Un actiu binari publicat era transparent de dalt a baix. Cap prova en mirava
  **un sol píxel**.
- Un catàleg extret amb una màscara amb forat no havia demanat mai res de
  Mallorca ni d'Eivissa.
- Una capa sencera era codi mort perquè ningú omplia la seva propietat.

**La lliçó, i és la instrucció més important d'aquest fitxer:** quan facis una
cosa nova, pregunta't què la compara amb la realitat. Si la resposta és «res»,
aquella és la feina que falta.
