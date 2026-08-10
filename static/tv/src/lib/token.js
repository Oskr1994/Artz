// Credenciales de sesión en almacenamiento local.
//
// Dentro del paquete .wgt de Tizen la página se carga desde `file://`, así que
// todas sus llamadas son cross-origin y una cookie `SameSite=Lax` sencillamente
// no viaja. En el televisor la sesión tiene que guardarse aquí.
const CLAVE = 'fp_token';

export function leerToken() {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    // Algunos navegadores en modo privado lanzan al tocar localStorage. No
    // poder leer no es fatal: se sigue sin token y se pedirá acceso otra vez.
    return null;
  }
}

export function guardarToken(token) {
  try {
    if (token) localStorage.setItem(CLAVE, token);
    else localStorage.removeItem(CLAVE);
  } catch {
    // Ídem: si no se puede persistir, la sesión durará lo que dure la app.
  }
}
