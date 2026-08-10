// Cliente del panel XUI.ONE, hablado DIRECTAMENTE desde el televisor.
//
// La app de televisor no pasa por el backend propio: va contra `player_api.php`
// del panel. Este fichero solo reexporta; el código vive en `xui/`, un módulo
// por catálogo, porque cada uno guarda su propio estado —categorías vetadas,
// índice por id— y tenerlos juntos los hacía pisarse.
//
// Lo que se pierde al ir directo, y conviene tener presente:
//   - El desentrelazado con ffmpeg que hacía el backend. En el televisor no
//     hace falta (decodifica H.264 entrelazado por hardware), pero el respaldo
//     de mpegts.js en Chromium sí lo necesitaba: ahí los canales entrelazados
//     dejarán de verse bien.
//   - El aislamiento de credenciales. Usuario y clave viven ahora en el
//     televisor y viajan en cada petición y en la propia URL del vídeo.
//
// Comportamientos del panel que NO son los del Xtream de manual (medidos contra
// el servidor real, ver `API_XUI_DOCUMENTACION.md`):
//   - Credenciales inválidas devuelven 404 con HTML de nginx, no un JSON con
//     `auth: 0`.
//   - Una `action` desconocida se ignora y devuelve la respuesta de
//     autenticación con 200. Hay que validar los nombres en el cliente.
//   - No hay paginación: el catálogo entero viene en una sola respuesta.
export {
  panel, guardarCredenciales, credenciales, olvidarCredenciales,
  infoDeCuenta,
} from './xui/nucleo.js';

export { categorias, canales, epg, urlDeDirecto } from './xui/directo.js';

export {
  categoriasDePeliculas, peliculas, pelicula, urlDePelicula,
} from './xui/vod.js';

export {
  categoriasDeSeries, series, serie, urlDeEpisodio,
} from './xui/series.js';
