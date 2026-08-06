# Seguretat

## Comunicar una vulnerabilitat

No obris una incidència pública ni una pull request amb una vulnerabilitat,
credencial, token, clau, dada personal o detall d'accés a infraestructura.

Fes servir **Report a vulnerability** a la pestanya *Security* del repositori:

<https://github.com/humbertblanco/eclipsi-info/security/advisories/new>

Inclou una descripció, els passos mínims per reproduir-la, l'impacte, el
navegador o dispositiu afectat i, si en tens, una proposta de correcció. No
incloguis dades personals reals. Es confirmarà la recepció tan aviat com sigui
possible i es coordinarà la publicació de la correcció.

## Abast prioritari

Es consideren especialment sensibles:

- qualsevol indicació incorrecta sobre quan es pot retirar la protecció ocular;
- filtracions de coordenades, ubicacions, cerques o dades de sensors;
- execució de codi, injecció de contingut o manipulació de dades astronòmiques;
- exposició de secrets o dades internes de desplegament;
- alteracions del funcionament fora de línia o de les actualitzacions de la PWA.

La branca mantinguda és `main` i el lloc oficial és
<https://eclipsi.info/>. Les bifurcacions i els desplegaments de tercers no
estan coberts per aquesta política.
