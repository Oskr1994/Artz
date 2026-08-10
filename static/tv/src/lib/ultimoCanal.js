// El último canal que se estaba viendo, para reanudarlo al abrir la app.
//
// Un televisor no es un navegador: quien lo enciende quiere ver algo, no elegir
// de una lista. Se guarda lo mínimo para reanudar sin esperar al catálogo —id y
// nombre—, así que el vídeo arranca a la vez que la lista se está cargando.
const CLAVE = 'fp_ultimo_canal';

export function guardarUltimoCanal(canal) {
  try {
    if (!canal || canal.id == null) {
      localStorage.removeItem(CLAVE);
      return;
    }
    localStorage.setItem(CLAVE, JSON.stringify({ id: canal.id, name: canal.name || '' }));
  } catch {
    // Almacenamiento lleno o bloqueado: se pierde la reanudación, nada más.
  }
}

/**
 * `{ id, name }` o `null`.
 *
 * Devuelve `null` ante cualquier cosa que no sea lo que se guardó: un canal
 * borrado del catálogo, un `localStorage` de otra versión o texto corrupto. Es
 * preferible abrir sin canal a arrancar el reproductor con un id inventado.
 */
export function leerUltimoCanal() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!guardado || guardado.id == null) return null;
    return { id: guardado.id, name: guardado.name || '' };
  } catch {
    return null;
  }
}

export function olvidarUltimoCanal() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Nada que hacer.
  }
}
