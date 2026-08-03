/**
 * El control de capes del mapa: un botó flotant i un plafó petit de
 * interruptors.
 *
 * PER QUÈ NO ÉS UNA VISTA MÉS DEL SEGMENTAT. El segmentat de `MapScreen`
 * commuta què respon LA FITXA (franja, núvols, durada…); les capes d'aquí
 * responen al MAPA mateix i tenen sentit a totes les vistes alhora: el relleu
 * és context de lectura i el con de visió acompanya el punt vagi on vagi la
 * fitxa. Barrejar les dues coses al mateix control faria que canviar de
 * pregunta apagués el territori.
 *
 * L'ESTAT ES RECORDA (localStorage, una clau amb versió): qui apaga el relleu
 * al mòbil per estalviar dades no ho ha de repetir cada visita. El valor per
 * defecte el decideix `MapScreen` (escriptori sí, mòbil no) i només s'aplica
 * mentre l'usuari no ha dit la seva.
 */

import { useEffect, useRef, useState } from 'react';
import { IconButton, Switch } from '../../ui';
import type { Locale } from '../../i18n';
import { s } from '../../screens/strings';

/**
 * QUÈ ÉS UNA CAPA D'AQUÍ I QUÈ NO.
 *
 * Aquí només hi ha les capes TRANSVERSALS: les que tenen sentit mentre mires
 * qualsevol cosa, perquè no responen cap pregunta de la fitxa sinó que
 * descriuen el territori. El relleu i el con acompanyen sempre; els punts
 * oficials i els miradors són llocs que hi són tant si penses en núvols com
 * si penses en durada.
 *
 * Les altres capes del mapa —el mapa de calor de visibilitat, la nuvolositat,
 * la fletxa del gradient i la vora d'incertesa— NO són aquí a posta: cada una
 * és la cara cartogràfica d'una vista concreta de la fitxa i s'encén amb
 * ella. Posar-les també en aquest plafó voldria dir tenir dos comandaments
 * per a la mateixa cosa, i el dia que discrepessin no hi hauria manera de
 * saber quin mana.
 */
export interface MapLayerState {
  /** Relleu ombrejat amb el model d'elevació. */
  hillshade: boolean;
  /** Con de visió cap al Sol des del punt triat. */
  cone: boolean;
  /** Punts d'observació oficials, amb la seva font. */
  official: boolean;
  /** Miradors i cims d'OpenStreetMap. */
  viewpoints: boolean;
  /** Mapa de calor: quants segons sobreviuen al relleu, per cel·la. */
  heat: boolean;
}

/*
 * LA CLAU PUJA DE VERSIÓ CADA COP QUE CANVIA LA FORMA. Un estat desat amb la
 * forma vella deixaria els camps nous indefinits, i un booleà indefinit no
 * apaga una capa: la deixa en un tercer estat que ningú no ha triat.
 */
const STORAGE_KEY = 'eclipsi:mapLayers:v2';

/**
 * L'estat desat, o el defecte que li passin. Exportada perquè `MapScreen`
 * pugui arrencar amb el valor bo al primer render, sense parpelleig.
 */
export function readStoredLayers(fallback: MapLayerState): MapLayerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const record = parsed as Record<string, unknown>;
    // Camp a camp: una versió anterior de la clau no tenia `official` ni
    // `viewpoints`, i el que hi manqui ha de caure al defecte en comptes de
    // deixar la capa apagada per sempre a qui ja havia fet servir l'app.
    return {
      hillshade:
        typeof record.hillshade === 'boolean' ? record.hillshade : fallback.hillshade,
      cone: typeof record.cone === 'boolean' ? record.cone : fallback.cone,
      official:
        typeof record.official === 'boolean' ? record.official : fallback.official,
      viewpoints:
        typeof record.viewpoints === 'boolean' ? record.viewpoints : fallback.viewpoints,
      heat: typeof record.heat === 'boolean' ? record.heat : fallback.heat,
    };
  } catch {
    // localStorage vetat (mode privat estricte): es viu amb el defecte.
    return fallback;
  }
}

function storeLayers(state: MapLayerState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sense persistència no passa res greu: només es perd el record.
  }
}

interface Props {
  locale: Locale;
  value: MapLayerState;
  onChange: (next: MapLayerState) => void;
}

export function LayerControl({ locale, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Tancar en tocar fora: el plafó sura sobre el mapa i el gest natural per
  // sortir-ne és tornar al mapa, no buscar cap creu.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      if (rootRef.current === null) return;
      if (event.target instanceof Node && rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const set = (next: MapLayerState): void => {
    storeLayers(next);
    onChange(next);
  };

  return (
    <div className="mapscreen__layers" ref={rootRef}>
      <IconButton
        icon="layers"
        variant="ghost"
        label={s('map.layers.open', locale)}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="mapscreen__layerpanel" role="group" aria-label={s('map.layers.open', locale)}>
          <Switch
            checked={value.hillshade}
            onChange={(hillshade) => set({ ...value, hillshade })}
            label={s('map.layers.hillshade', locale)}
            description={s('map.layers.hillshadeDesc', locale)}
          />
          <Switch
            checked={value.cone}
            onChange={(cone) => set({ ...value, cone })}
            label={s('map.layers.cone', locale)}
            description={s('map.layers.coneDesc', locale)}
          />
          {/*
            El mapa de calor baixa relleu de debò i triga segons: la
            descripció ho diu ABANS de tocar l'interruptor, i la pantalla hi
            posa una porta de cost la primera vegada.
          */}
          <Switch
            checked={value.heat}
            onChange={(heat) => set({ ...value, heat })}
            label={s('map.layers.heat', locale)}
            description={s('map.layers.heatDesc', locale)}
          />
          <Switch
            checked={value.official}
            onChange={(official) => set({ ...value, official })}
            label={s('map.layers.official', locale)}
            description={s('map.layers.officialDesc', locale)}
          />
          {/*
            Els miradors baixen un fitxer de centenars de kB en encendre's, i
            per això la descripció ho diu ABANS de tocar l'interruptor: en
            aquesta app res no es demana sense explicar-ho.
          */}
          <Switch
            checked={value.viewpoints}
            onChange={(viewpoints) => set({ ...value, viewpoints })}
            label={s('map.layers.viewpoints', locale)}
            description={s('map.layers.viewpointsDesc', locale)}
          />

          {/*
            LA FRASE QUE EXPLICA PER QUÈ NO HI SÓN TOTES.
            Sense ella, la pregunta òbvia en obrir això és «i la nuvolositat?
            i la fletxa?». Hi són, però lligades a la seva vista de la fitxa,
            que és on es fa la pregunta que responen. Dir-ho val una línia i
            estalvia la sensació que falten coses.
          */}
          <p className="mapscreen__layernote">{s('map.layers.byView', locale)}</p>
        </div>
      )}
    </div>
  );
}
