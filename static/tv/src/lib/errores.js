// Errores de la API, con el código y el mensaje ya redactado para el usuario.
//
// Este módulo no importa NADA a propósito: lo usa `xui.js`, que habla por
// `fetch` directamente con el panel, y cualquier dependencia que se cuele aquí
// acabaría dentro del .wgt.
export class ErrorDeApi extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.name = 'ErrorDeApi';
    this.codigo = codigo;
    this.mensaje = mensaje;
  }
}

// Se distinguen bien las situaciones y la interfaz debe aprovecharlo.
// Colapsarlas todas en "algo ha fallado" deja al usuario sin saber si el
// problema es suyo, nuestro o del proveedor.
// Sin entrada para 401 a propósito: `xui.js` ya redacta el motivo concreto
// (contraseña mal, cuenta caducada, cuenta suspendida) y el 401 sin mensaje
// significa "no hay sesión guardada", que se resuelve mandando al acceso, no
// enseñando un texto.
export const MENSAJES = {
  409: 'Ya estás viendo algo en otro dispositivo. Ciérralo para reproducir aquí.',
  502: 'Este contenido no está disponible ahora mismo. Inténtalo más tarde.',
  503: 'El servicio no está disponible ahora mismo. Inténtalo en unos minutos.',
  404: 'Este contenido ya no está disponible.',
  sinRed: 'No hay conexión. Comprueba tu internet.',
  generico: 'Algo no ha ido bien. Vuelve a intentarlo.',
};

export function mensajeDeError(error) {
  if (!error) return MENSAJES.generico;
  // `xui.js` redacta mensajes concretos para los casos que sabe reconocer: si
  // viene uno, gana al genérico nuestro.
  if (error.mensaje) return error.mensaje;
  if (error.codigo === null) return MENSAJES.sinRed;
  return MENSAJES[error.codigo] ?? MENSAJES.generico;
}

export function esSinSesion(error) {
  return error?.codigo === 401;
}
