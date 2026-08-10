import { urlDeDirecto } from './xui.js';

/**
 * URL lista para entregarle al reproductor.
 *
 * Ya no hay ticket. Antes la app pasaba por el backend propio, que emitía uno
 * de 60 segundos porque AVPlay descarga el vídeo con su propia pila HTTP
 * nativa: no comparte el almacén de cookies del WebView y no admite cabeceras
 * de forma fiable, así que la URL era su única forma de autenticarse.
 *
 * Yendo directo al panel XUI el problema no desaparece, se resuelve distinto:
 * el panel mete usuario y clave en la propia ruta
 * (`/live/<usuario>/<clave>/<id>.ts`), que es exactamente el mismo truco.
 *
 * Lo que SÍ se pierde con el cambio es el `nativo=1` que le decía al backend
 * que no desentrelazara con ffmpeg. En el televisor da igual, porque decodifica
 * H.264 entrelazado por hardware; pero el respaldo de mpegts.js en Chromium
 * dependía de ese desentrelazado, así que fuera del televisor los canales
 * entrelazados dejarán de verse bien.
 *
 * El panel responde con un 302 hacia una URL con token de un solo uso. AVPlay
 * sigue redirecciones por su cuenta, así que no hay nada que hacer aquí; pero
 * conviene no cachear la URL final, solo esta.
 */
export async function urlDeCanal(streamId) {
  return urlDeDirecto(streamId);
}
