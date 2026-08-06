# Col·laborar amb eclipsi.info

Gràcies per voler millorar el projecte. S'accepten correccions, proves,
traduccions, millores d'accessibilitat, documentació i propostes tècniques.

## Preparar l'entorn

Cal Node.js 22.12 o posterior i npm 10 o posterior:

```bash
git clone https://github.com/humbertblanco/eclipsi-info.git
cd eclipsi-info
npm ci
npm run dev
```

No cal cap credencial, clau d'API ni accés al servidor. No afegeixis fitxers
`.env`, certificats, claus, tokens, adreces internes ni instruccions d'accés a
producció. Si una prova necessita configuració, fes servir dades fictícies.

## Abans de canviar codi

Llegeix [ESTAT.md](ESTAT.md) per entendre les decisions i els riscos coneguts.
El codi i els comentaris són en català; la interfície es tradueix mitjançant el
sistema d'i18n existent.

Hi ha tres límits especialment importants:

1. La seguretat ocular és conservadora. Cap canvi pot presentar una fase
   parcial o anular com a segura sense protecció.
2. La ubicació i les coordenades no poden arribar a l'analítica. Qualsevol dada
   nova ha de passar per les barreres i proves de privacitat existents.
3. `src/core` no depèn del DOM. El càlcul ha de continuar funcionant a Node i
   dins de Workers.

## Fer una proposta

- Crea una branca curta des de `main`.
- Manté cada canvi centrat en un sol problema.
- Afegeix o actualitza proves quan canvies comportament.
- Explica el motiu de la decisió i les fonts de qualsevol dada científica.
- No regeneris dades pesants ni actius si el canvi no ho necessita.
- Conserva les atribucions i llicències dels recursos de tercers.

Abans d'obrir una pull request:

```bash
npm test
npm run lint
npm run build
git diff --check
```

El lint pot mostrar avisos coneguts, però no ha d'introduir errors nous. A la
pull request, resumeix què canvia, com ho has comprovat i si afecta seguretat
ocular, privacitat, rendiment, funcionament sense connexió o atribucions.

## Llicències i atribució

En contribuir acceptes que el codi es publiqui sota MIT i el contingut original
sota CC BY 4.0. La reutilització ha de citar `eclipsi.info — Humbert Blanco /
Damos en el Blanco`, conservar els avisos corresponents i indicar els canvis.
