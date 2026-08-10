import { guardarToken, leerToken } from './token.js';
import { olvidarUltimoCanal } from './ultimoCanal.js';

// La sesión del televisor es permanente a propósito: se escribe usuario y
// contraseña una sola vez con el teclado en pantalla -que con un mando es
// incómodo- y no se vuelve a pedir. El token caduca según `session_ttl_days`
// del backend (30 días), y cuando eso pase la app vuelve sola a Acceso.

export { leerToken };

export function iniciarSesionGuardada(token) {
  guardarToken(token);
}

export function cerrarSesion() {
  guardarToken(null);
  // Si no, el siguiente que entre abre con el canal del anterior.
  olvidarUltimoCanal();
}

export function haySesion() {
  return Boolean(leerToken());
}
