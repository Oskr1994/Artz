// La pista que el usuario eligió la última vez.
//
// Se guarda la POSICIÓN, pero al aplicarla se comprueba que sigue siendo del
// mismo idioma. El número de pista cambia de un fichero a otro —en una película
// el español es la 0 y en otra la 2—, así que aplicarlo a ciegas pondría el
// idioma equivocado sin avisar de nada.
//
// NO se borra al cerrar sesión: es un gusto del usuario, no una credencial.
const CLAVE = 'fp_pistas';

export function leerPreferencia() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null') || {};
    return {
      audio: guardado.audio || null,
      subtitulo: guardado.subtitulo || null,
    };
  } catch {
    return { audio: null, subtitulo: null };
  }
}

/** `tipo` es 'audio' o 'subtitulo'. `pista` puede ser null para olvidarla. */
export function guardarPreferencia(tipo, pista) {
  try {
    const previo = leerPreferencia();
    const valor = pista
      ? { indice: pista.indice, idioma: pista.idioma || null }
      : null;
    localStorage.setItem(CLAVE, JSON.stringify({ ...previo, [tipo]: valor }));
  } catch {
    // Almacenamiento lleno o bloqueado: la elección durará lo que dure la app.
  }
}

/**
 * La pista que hay que seleccionar, o `null` para dejar la del fichero.
 *
 * Devuelve la pista ENTERA, no el índice, para que quien la aplique pueda
 * enseñar su etiqueta sin volver a buscarla.
 */
export function pistaAAplicar(pistas, guardada) {
  if (!Array.isArray(pistas) || !guardada) return null;
  const enEsaPosicion = pistas.find((p) => p.indice === guardada.indice);
  if (!enEsaPosicion) return null;
  // Aquí está la salvaguarda: misma posición Y mismo idioma.
  if ((enEsaPosicion.idioma || null) !== (guardada.idioma || null)) return null;
  return enEsaPosicion;
}
