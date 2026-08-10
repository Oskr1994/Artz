// Películas (VOD). Ver sección 5 de `API_XUI_DOCUMENTACION.md`.
import { ErrorDeApi } from '../errores.js';
import {
  panel, consultar, lista, credenciales, unaSola,
  normalizarCategorias, categoriasDe, estaVetada, hayVetadas,
} from './nucleo.js';

const CATALOGO = 'vod';

// Si el panel no dice el contenedor, mp4 es lo más probable y lo que más
// televisores aceptan. Nunca se usa `allowed_output_formats`: eso es del
// directo, y una película en mkv hay que pedirla como .mkv aunque la línea solo
// declare m3u8 y ts.
const EXTENSION_POR_DEFECTO = 'mp4';

export async function categoriasDePeliculas({ adultos = false } = {}) {
  // Al abrir Películas esto lo piden a la vez el gancho de la barra lateral y
  // `peliculas()`, que necesita saber qué vetar: sin `unaSola` salían dos
  // peticiones idénticas.
  return unaSola(`${CATALOGO}:categorias:${adultos}`, async () => {
    const crudas = lista(
      await consultar({ action: 'get_vod_categories' }),
      'get_vod_categories',
    );
    return normalizarCategorias(CATALOGO, crudas, adultos);
  });
}

function normalizar(c) {
  return {
    id: c.stream_id,
    name: c.name,
    icon: c.stream_icon || null,
    year: c.year || String(c.release_date || '').slice(0, 4) || null,
    // En películas `rating` llega como número y en series como texto: se
    // convierte siempre, y un 0 o un vacío se quedan en null para no pintar
    // "★ 0" en media biblioteca.
    rating: Number(c.rating) || null,
    genre: c.genre || '',
    extension: c.container_extension || EXTENSION_POR_DEFECTO,
    fuenteDirecta: c.direct_source || null,
  };
}

/**
 * Películas de una categoría, o del catálogo entero si no se da ninguna.
 *
 * Con categoría se le pide al panel solo esa (`category_id`): unos cientos en
 * vez de las 2 918 del catálogo completo, que son 2,5 MB en una sola respuesta
 * porque el panel NO pagina. El catálogo entero solo se pide al elegir «Todas»
 * o al buscar.
 */
export async function peliculas({ category = null, q = '', adultos = false } = {}) {
  // Las dos a la vez, no una detrás de otra: así se espera la más lenta y no la
  // suma. Sin categoría hay que saber cuáles vetar; con una elegida manda esa,
  // aunque esté vetada, porque el usuario la ha activado a propósito. Con los
  // adultos a la vista no hay nada que vetar y la petición sobra.
  const [datos] = await Promise.all([
    consultar({ action: 'get_vod_streams', category_id: category }),
    category == null && !adultos && !hayVetadas(CATALOGO) ? categoriasDePeliculas() : null,
  ]);
  const crudas = lista(datos, 'get_vod_streams');

  const texto = String(q || '').trim().toLowerCase();
  const items = crudas
    .filter((c) => {
      if (category != null || adultos) return true;
      // Se veta si CUALQUIERA de sus categorías lo está: una película de
      // adultos puede tener una categoría principal inocente.
      for (const id of categoriasDe(c)) if (estaVetada(CATALOGO, id)) return false;
      return true;
    })
    .filter((c) => !texto || String(c.name || '').toLowerCase().includes(texto))
    .map(normalizar);

  return { items, total: items.length };
}

/** Ficha completa. `get_vod_info` parte los datos en `info` y `movie_data`. */
export async function pelicula(streamId) {
  const datos = await consultar({ action: 'get_vod_info', vod_id: streamId });
  const info = (datos && datos.info) || {};
  const base = (datos && datos.movie_data) || {};
  return {
    id: base.stream_id != null ? base.stream_id : streamId,
    name: base.name || info.name || '',
    icon: info.movie_image || info.cover_big || base.stream_icon || null,
    extension: base.container_extension || EXTENSION_POR_DEFECTO,
    year: base.year || String(info.release_date || '').slice(0, 4) || null,
    duracionSegundos: Number(info.duration_secs) || null,
    rating: Number(info.rating) || null,
    genre: info.genre || '',
    plot: info.plot || info.description || '',
    director: info.director || '',
    cast: info.cast || info.actors || '',
    fuenteDirecta: base.direct_source || null,
  };
}

/**
 * URL de reproducción de una película.
 *
 * El servidor responde 302 hacia una URL con token de un solo uso; AVPlay sigue
 * la redirección por su cuenta. No se puede cachear la URL con token, solo esta.
 */
export function urlDePelicula(streamId, extension, fuenteDirecta = null) {
  if (fuenteDirecta) return fuenteDirecta;
  const guardadas = credenciales();
  if (!guardadas) throw new ErrorDeApi(401, '');
  const usuario = encodeURIComponent(guardadas.usuario);
  const clave = encodeURIComponent(guardadas.clave);
  const ext = extension || EXTENSION_POR_DEFECTO;
  return `${panel()}/movie/${usuario}/${clave}/${streamId}.${ext}`;
}
