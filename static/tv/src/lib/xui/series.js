// Series. Ver sección 6 de `API_XUI_DOCUMENTACION.md`.
//
// Jerarquía de tres niveles: serie → temporada → episodio. Lo que se reproduce
// es el EPISODIO, y su identificador no es `series_id` ni `episode_num`: es su
// propio `id`, que además llega como texto.
import { ErrorDeApi } from '../errores.js';
import {
  panel, consultar, lista, credenciales, unaSola,
  normalizarCategorias, categoriasDe, estaVetada, hayVetadas,
} from './nucleo.js';

const CATALOGO = 'series';
const EXTENSION_POR_DEFECTO = 'mp4';

export async function categoriasDeSeries({ adultos = false } = {}) {
  // Ver `vod.js`: la barra lateral y `series()` lo piden a la vez.
  return unaSola(`${CATALOGO}:categorias:${adultos}`, async () => {
    const crudas = lista(
      await consultar({ action: 'get_series_categories' }),
      'get_series_categories',
    );
    return normalizarCategorias(CATALOGO, crudas, adultos);
  });
}

function normalizar(c) {
  return {
    id: c.series_id,
    name: c.name,
    // `cover`, no `stream_icon`: en series el campo se llama distinto.
    icon: c.cover || null,
    year: c.year || String(c.release_date || '').slice(0, 4) || null,
    // Aquí `rating` llega como TEXTO ("7"), al revés que en películas.
    rating: Number(c.rating) || null,
    genre: c.genre || '',
    plot: c.plot || '',
  };
}

export async function series({ category = null, q = '', adultos = false } = {}) {
  // Las dos a la vez, no en serie: se espera la más lenta, no la suma. Con los
  // adultos a la vista no hay nada que vetar y la petición sobra.
  const [datos] = await Promise.all([
    consultar({ action: 'get_series', category_id: category }),
    category == null && !adultos && !hayVetadas(CATALOGO) ? categoriasDeSeries() : null,
  ]);
  const crudas = lista(datos, 'get_series');

  const texto = String(q || '').trim().toLowerCase();
  const items = crudas
    .filter((c) => {
      if (category != null || adultos) return true;
      for (const id of categoriasDe(c)) if (estaVetada(CATALOGO, id)) return false;
      return true;
    })
    .filter((c) => !texto || String(c.name || '').toLowerCase().includes(texto))
    .map(normalizar);

  return { items, total: items.length };
}

function normalizarEpisodio(e) {
  const info = e.info || {};
  return {
    // A texto siempre: el panel lo devuelve unas veces como número y otras como
    // cadena, y la URL tiene que salir igual en ambos casos.
    id: String(e.id),
    numero: Number(e.episode_num) || null,
    title: e.title || '',
    extension: e.container_extension || EXTENSION_POR_DEFECTO,
    duracionSegundos: Number(info.duration_secs) || null,
    plot: info.plot || '',
    imagen: info.movie_image || info.cover_big || null,
    fuenteDirecta: e.direct_source || null,
  };
}

/**
 * Temporadas y episodios de una serie.
 *
 * Las temporadas se derivan de las CLAVES de `episodes`, no del array `seasons`:
 * en este panel `seasons` viene vacío en varias series mientras que `episodes`
 * sí trae los datos, y fiarse de `seasons` deja la ficha en blanco. `seasons`
 * solo se usa para el nombre bonito, cuando lo tiene.
 */
export async function serie(seriesId) {
  const datos = await consultar({ action: 'get_series_info', series_id: seriesId });
  const info = (datos && datos.info) || {};
  const crudos = (datos && datos.episodes) || {};
  const nombres = (datos && datos.seasons) || [];

  const episodiosPorTemporada = {};
  for (const [clave, episodios] of Object.entries(crudos)) {
    if (!Array.isArray(episodios)) continue;
    episodiosPorTemporada[String(clave)] = episodios.map(normalizarEpisodio);
  }

  const temporadas = Object.keys(episodiosPorTemporada)
    .map(Number)
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b)
    .map((numero) => {
      const suyo = nombres.find((s) => Number(s.season_number) === numero);
      return { numero, nombre: (suyo && suyo.name) || `Temporada ${numero}` };
    });

  return {
    id: seriesId,
    name: info.name || '',
    icon: info.cover || null,
    plot: info.plot || '',
    temporadas,
    episodiosPorTemporada,
  };
}

/** URL de reproducción de un EPISODIO. El id es el suyo, no el de la serie. */
export function urlDeEpisodio(episodioId, extension, fuenteDirecta = null) {
  if (fuenteDirecta) return fuenteDirecta;
  const guardadas = credenciales();
  if (!guardadas) throw new ErrorDeApi(401, '');
  const usuario = encodeURIComponent(guardadas.usuario);
  const clave = encodeURIComponent(guardadas.clave);
  const ext = extension || EXTENSION_POR_DEFECTO;
  return `${panel()}/series/${usuario}/${clave}/${episodioId}.${ext}`;
}
