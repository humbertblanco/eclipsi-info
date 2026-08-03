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

export interface MapLayerState {
  /** Relleu ombrejat amb el model d'elevació. */
  hillshade: boolean;
  /** Con de visió cap al Sol des del punt triat. */
  cone: boolean;
}

const STORAGE_KEY = 'eclipsi:mapLayers:v1';

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
    return {
      hillshade:
        typeof record.hillshade === 'boolean' ? record.hillshade : fallback.hillshade,
      cone: typeof record.cone === 'boolean' ? record.cone : fallback.cone,
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
        </div>
      )}
    </div>
  );
}
