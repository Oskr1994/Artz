// Lo ÚNICO que esta app habla con nuestro servidor.
//
// Todo lo demás -catálogo, vídeo, carátulas- va directo al panel del
// proveedor, que es la razón de ser de esta app: el televisor decodifica H.264
// entrelazado por hardware y no necesita el ffmpeg del backend. Aquí solo se
// resuelve quién puede entrar y contra qué panel.
import { ErrorDeApi } from './errores.js';
import { credenciales, guardarCredenciales, olvidarCredenciales } from './xui/nucleo.js';
import { formatearCodigo, normalizarCodigo } from './codigo.js';

// Absoluta a propósito: dentro del .wgt la página vive en `file://`, así que
// una ruta relativa no apuntaría a ningún servidor.
const NUESTRO = import.meta.env?.VITE_API ?? 'https://fast-play.oscar-dev.lat';

// Un televisor puede quedarse encendido días. Sin esto, "revalida al abrir"
// sería "revalida una vez por semana" para quien no lo apaga, y cortar un
// código no surtiría efecto en todo ese tiempo.
export const MS_ENTRE_REVALIDACIONES = 6 * 60 * 60 * 1000;

// Cuánto se aguanta SIN CONSEGUIR revalidar antes de echar. Es la respuesta
// honesta a "¿cuánto tarda como máximo en hacerse efectivo un corte?": al
// instante si el televisor nos alcanza, y como mucho esto si no. El control de
// acceso cede ante la disponibilidad, pero con un tope.
export const DIAS_DE_GRACIA = 7;

// Margen para no preguntar dos veces por lo mismo. `App` revalida al montar, y
// justo antes de montar se ha entrado por `entrar()`, que ya validó: eran dos
// POST idénticos seguidos. Medido en el televisor, el segundo costaba 732 ms de
// los 3 446 que tardaba el inicio de sesión, y obligaba al backend a validar
// contra el panel del proveedor otra vez para nada.
//
// Un minuto no debilita el control de acceso: la caducidad se sigue mirando en
// local y ANTES que esto, y quien cierre y abra la app dentro del mismo minuto
// se revalida igual al siguiente arranque o a las seis horas.
export const MS_MINIMO_ENTRE_PREGUNTAS = 60 * 1000;

const CLAVE_CODIGO = 'fp_codigo';

/**
 * El código se recuerda y SOBREVIVE a cerrar sesión.
 *
 * Salir es cambiar de cuenta del proveedor, no cambiar de proveedor. Con un
 * mando, volver a teclear ocho caracteres es caro. Por eso vive en su propia
 * clave y no dentro de `fp_xui`, que sí se borra al salir.
 */
export function leerCodigoGuardado() {
  try {
    return localStorage.getItem(CLAVE_CODIGO) ?? '';
  } catch {
    // Almacenamiento bloqueado: que no se recuerde es molesto; que no se pueda
    // entrar, no.
    return '';
  }
}

export function recordarCodigo(codigo) {
  try {
    if (codigo) localStorage.setItem(CLAVE_CODIGO, codigo);
    else localStorage.removeItem(CLAVE_CODIGO);
  } catch {
    /* ver leerCodigoGuardado */
  }
}

/** La llamada, cruda. La usan `entrar` y `revalidar`. */
export async function pedirAcceso(codigo, usuario, clave) {
  let respuesta;
  try {
    respuesta = await fetch(`${NUESTRO}/api/v1/tv/acceso`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        codigo: normalizarCodigo(codigo),
        username: usuario,
        password: clave,
      }),
    });
  } catch {
    // Código nulo, que `mensajeDeError` traduce a "no hay conexión". Es lo que
    // distingue "no te dejamos entrar" de "no hemos podido preguntar", y de esa
    // diferencia depende que una caída nuestra no eche a nadie de la tele.
    throw new ErrorDeApi(null, '');
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => ({}));
    throw new ErrorDeApi(respuesta.status, cuerpo.detail ?? '');
  }
  return respuesta.json();
}

/** Entrar: validar contra nosotros y quedarse con lo que hace falta. */
export async function entrar(codigo, usuario, clave) {
  const datos = await pedirAcceso(codigo, usuario, clave);
  guardarCredenciales(usuario, clave, datos.user_info, {
    codigo: normalizarCodigo(codigo),
    base_url: datos.base_url,
    caduca_el: datos.caduca_el,
    revalidado_en: Date.now(),
  });
  // Con guion, que es como se enseña en pantalla.
  recordarCodigo(formatearCodigo(codigo));
  return datos.user_info;
}

/**
 * ¿Se sigue dentro?
 *
 * `false` significa echar a la persona. Se llama al abrir la app y cada
 * `MS_ENTRE_REVALIDACIONES` mientras siga abierta.
 */
export async function revalidar() {
  const guardadas = credenciales();
  if (!guardadas) return false;

  // Primero lo que NO necesita red. El servidor ya dijo cuándo vence este
  // código: si venció, no hay nada que preguntar. Sin esta comprobación
  // bastaría con dejar al televisor sin ruta hacia nosotros para estirar una
  // suscripción vencida los siete días de gracia.
  if (guardadas.caduca_el && new Date(guardadas.caduca_el) <= new Date()) {
    olvidarCredenciales();
    return false;
  }

  // Ya se preguntó hace nada. Va DESPUÉS de la caducidad a propósito: esa se
  // comprueba siempre, o bastaría con reabrir la app a menudo para estirar una
  // suscripción vencida.
  const ultima = guardadas.revalidado_en ?? 0;
  if (Date.now() - ultima < MS_MINIMO_ENTRE_PREGUNTAS) return true;

  try {
    const datos = await pedirAcceso(guardadas.codigo, guardadas.usuario, guardadas.clave);
    // Se ACTUALIZA, no solo se comprueba: es lo que hace que cambiar la URL de
    // un proveedor -o renovar un código- desde /admin llegue a los televisores
    // sin reinstalar nada.
    guardarCredenciales(guardadas.usuario, guardadas.clave, datos.user_info, {
      base_url: datos.base_url,
      caduca_el: datos.caduca_el,
      revalidado_en: Date.now(),
    });
    return true;
  } catch (e) {
    // Un rechazo es un rechazo: fuera. Cualquier otra cosa -sin red, 503, un
    // 500 nuestro- es problema nuestro, y no puede costarle la tele a nadie.
    if (e.codigo === 401) {
      olvidarCredenciales();
      return false;
    }
    const desde = guardadas.revalidado_en ?? 0;
    if (Date.now() - desde > DIAS_DE_GRACIA * 86400000) {
      olvidarCredenciales();
      return false;
    }
    return true;
  }
}
