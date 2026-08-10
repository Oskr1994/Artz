// Puente con las APIs del televisor.
//
// Todo se detecta por CAPACIDAD, nunca por User-Agent: es la misma regla que
// sigue `frontend/src/lib/capacidades.js` y la misma que aplica el backend con
// `?nativo=1`. Es también lo que permite desarrollar esta app entera en
// Chromium: allí no hay `webapis` ni `tizen`, y todo cae con elegancia al
// camino de respaldo en vez de reventar.

export const TECLAS = {
  IZQUIERDA: 37,
  ARRIBA: 38,
  DERECHA: 39,
  ABAJO: 40,
  OK: 13,
  // 10009 es la tecla ATRÁS del mando de Samsung. No es un código estándar: no
  // existe en ningún navegador de escritorio, por eso va aquí con nombre y no
  // como un número suelto en un `switch`.
  ATRAS: 10009,
};

export function hayAvplay() {
  return typeof window !== 'undefined' && Boolean(window.webapis?.avplay);
}

// Las flechas y OK llegan solas. Estas hay que pedirlas explícitamente o el
// televisor se las queda para su propia interfaz.
const TECLAS_A_REGISTRAR = ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop'];

export function registrarTeclas() {
  const dispositivo =
    typeof window !== 'undefined' ? window.tizen?.tvinputdevice : undefined;
  if (!dispositivo?.registerKey) return; // Chromium: no hay nada que registrar.
  for (const tecla of TECLAS_A_REGISTRAR) {
    try {
      dispositivo.registerKey(tecla);
    } catch {
      // Un modelo antiguo puede no tener alguna de estas teclas. Que falte una
      // no debe impedir registrar las demás.
    }
  }
}

export function salirDeLaApp() {
  // Solo se llama al pulsar ATRÁS en la pantalla raíz, que es lo que espera
  // quien usa un televisor. En Chromium no hace nada, a propósito: cerrar la
  // pestaña durante el desarrollo sería molesto.
  try {
    window.tizen?.application?.getCurrentApplication?.()?.exit?.();
  } catch {
    // Fuera de Tizen no existe; no es un error.
  }
}
