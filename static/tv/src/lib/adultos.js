// El candado de la categoría de adultos.
//
// NO es una medida de seguridad, y no hay que venderlo como tal: son cuatro
// cifras —diez mil combinaciones— y viven en el almacenamiento del televisor,
// que cualquiera con el Modo Desarrollador puede leer. Es una barrera para que
// no abra la categoría un menor. La web dice lo mismo en `lib/pin.js`.
//
// Dos cosas con vidas distintas, y ahí está todo el diseño:
//
//   el código        -> `localStorage`, porque es un ajuste y tiene que
//                       sobrevivir a apagar el televisor
//   si está abierto  -> una variable de este módulo, porque se pidió que al
//                       cerrar la app vuelva a estar oculta
const CLAVE = 'fp_adultos';
const CLARO = 'claro:';

export const CODIGO_POR_DEFECTO = '1234';

function leerHuella() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

/**
 * Lo que se guarda: SHA-256 si el televisor lo permite, y si no el código con
 * el prefijo `claro:`.
 *
 * `crypto.subtle` solo existe en contextos seguros, y dentro del .wgt la página
 * se sirve desde `file://`: puede no estar, y está sin comprobar en el aparato.
 * El prefijo hace que al mirar el almacenamiento se vea de un vistazo cuál de
 * los dos caminos se tomó.
 *
 * Que por dentro sea SHA-256 no cambia lo que esto protege: contra diez mil
 * combinaciones, cifrar es teatro. Se hace porque es barato, no porque sirva.
 */
async function huella(codigo) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return CLARO + codigo;
  const bytes = await subtle.digest('SHA-256', new TextEncoder().encode(codigo));
  return Array.prototype.map
    .call(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** `false` mientras siga valiendo el de fábrica. */
export function hayCodigoPropio() {
  return leerHuella() != null;
}

export async function comprobarCodigo(entrada) {
  const codigo = String(entrada);
  const guardada = leerHuella();
  // Sin nada guardado manda el de fábrica, que NO se escribe al arrancar: así
  // la app funciona desde el primer encendido sin configurar nada.
  if (guardada == null) return codigo === CODIGO_POR_DEFECTO;
  // Lo guardado en claro se compara en claro, aunque AHORA haya `crypto.subtle`.
  // Sin esta línea, un código guardado donde no lo hay dejaría de valer donde sí
  // lo hay, y el usuario se quedaría fuera sin haber tocado nada.
  if (guardada.startsWith(CLARO)) return guardada === CLARO + codigo;
  return guardada === (await huella(codigo));
}

export async function guardarCodigo(nuevo) {
  const valor = await huella(String(nuevo));
  try {
    localStorage.setItem(CLAVE, valor);
  } catch {
    // Almacenamiento lleno o bloqueado: se queda el anterior, que es lo menos
    // malo. Decir que se cambió y que no fuera verdad sería peor.
  }
}

// Ni se lee ni se escribe en el almacenamiento A PROPÓSITO: esto es exactamente
// lo que se pierde al cerrar la app.
let visibles = false;

export function adultosVisibles() {
  return visibles;
}

export function mostrarAdultos(si) {
  visibles = Boolean(si);
}
