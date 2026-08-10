import { panel } from './xui.js';

/**
 * Deja la carátula de un canal en una URL absoluta.
 *
 * El panel XUI ya devuelve `stream_icon` absoluta
 * (`http://digitalsmarther.com:80/images/...`), así que lo normal es que esta
 * función la deje pasar tal cual. La rama de rutas relativas se mantiene porque
 * dentro del .wgt la página vive en `file://`: una ruta como `/img/<id>` se
 * resolvería contra la raíz del sistema de ficheros del televisor y daría
 * ERR_FILE_NOT_FOUND en cada logotipo de la lista.
 */
export function urlDeImagen(ruta) {
  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return ruta;
  return `${panel()}${ruta.startsWith('/') ? '' : '/'}${ruta}`;
}
