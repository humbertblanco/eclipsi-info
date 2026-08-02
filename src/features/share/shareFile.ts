/**
 * L'escala de compartir un FITXER, en un sol lloc.
 *
 * Hi havia dues escales independents — la del botó de compartir el punt
 * (aquí al costat) i la de la captura de la vista de càmera (SkyScreen) —
 * amb el mateix `canShare`+`share`+recanvi i el mateix tracte a
 * l'`AbortError`. La regla de la casa (`core/spots/grid.ts`): una llista
 * partida en dos fitxers és la manera segura que un dia una creixi i l'altra
 * no. Doncs una sola escala, i que cadascú hi pugi amb el seu fitxer.
 *
 * El recanvi és la descàrrega per object-URL. A iOS obre la imatge a la
 * pestanya i es desa amb una premuda llarga: no s'hi lluita, s'hi conviu.
 */

/** Cert si l'error és l'usuari tancant el full de compartir: no és cap error. */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** Descàrrega d'un blob amb nom, netejant l'URL al cap d'un moment. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Comparteix un fitxer pel full natiu si es pot; si no, el descarrega.
 *
 * `canShare` es pregunta amb el fitxer a la mà: hi ha navegadors que
 * comparteixen text i no fitxers, i altres que rebutgen segons el tipus MIME.
 * Tancar el full (AbortError) vol dir que l'usuari ha canviat d'idea: no es
 * descarrega res ni es pinta cap error.
 */
export async function shareFileOrDownload(file: File, title: string): Promise<void> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[]; title?: string }) => boolean;
  };
  const payload = { files: [file], title };
  if (typeof nav.share === 'function' && nav.canShare?.(payload)) {
    try {
      await nav.share(payload);
      return;
    } catch (error) {
      if (isAbortError(error)) return;
      // El share natiu ha fallat de debò: es cau al recanvi.
    }
  }
  downloadBlob(file, file.name);
}
