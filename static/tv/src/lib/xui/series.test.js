import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guardarCredenciales, olvidarCredenciales, panel } from './nucleo.js';
import { series, serie, urlDeEpisodio } from './series.js';

function json(cuerpo) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => cuerpo,
  };
}

function panelFalso(respuestas) {
  return vi.fn(async (url) => {
    const accion = new URL(String(url)).searchParams.get('action') ?? '';
    const r = respuestas[accion];
    if (!r) throw new Error(`sin respuesta simulada para «${accion}»`);
    return typeof r === 'function' ? r() : r;
  });
}

beforeEach(() => {
  localStorage.clear();
  olvidarCredenciales();
  guardarCredenciales('u', 'p', null);
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  olvidarCredenciales();
});

describe('URL de episodio', () => {
  it('usa el id DEL EPISODIO, no el de la serie', () => {
    // El id del episodio llega como TEXTO y no tiene nada que ver con
    // `series_id` ni con `episode_num`. Es el error más fácil de cometer aquí.
    expect(urlDeEpisodio('6619', 'mp4')).toBe(`${panel()}/series/u/p/6619.mp4`);
  });

  it('direct_source manda sobre la URL construida', () => {
    expect(urlDeEpisodio('6619', 'mp4', 'http://otro/x.mkv')).toBe('http://otro/x.mkv');
  });
});

describe('listado de series', () => {
  it('normaliza cover y el rating que llega como texto', async () => {
    // En series la carátula es `cover` (no `stream_icon`) y `rating` es texto,
    // al revés que en películas. Sin normalizar, la carátula no sale y la nota
    // se pinta rara.
    vi.stubGlobal('fetch', panelFalso({
      get_series_categories: json([
        { category_id: '28', category_name: 'SERIES DE APPLE TV' },
      ]),
      get_series: json([{
        series_id: 92,
        name: 'Acapulco (2021)',
        year: '2021',
        cover: 'http://digitalsmarther.com:80/images/a.jpg',
        rating: '7',
        genre: 'Comedia, Drama',
        plot: 'En 1984...',
        category_id: '28',
        category_ids: [28],
      }]),
    }));
    const { items } = await series();
    expect(items[0]).toEqual({
      id: 92,
      name: 'Acapulco (2021)',
      icon: 'http://digitalsmarther.com:80/images/a.jpg',
      year: '2021',
      rating: 7,
      genre: 'Comedia, Drama',
      plot: 'En 1984...',
    });
  });
});

describe('temporadas y episodios', () => {
  it('deriva las temporadas de las claves de episodes, no de seasons', async () => {
    // `seasons` viene VACÍO en este panel para varias series, mientras que
    // `episodes` sí trae los datos. Fiarse de `seasons` deja la ficha en blanco.
    vi.stubGlobal('fetch', panelFalso({
      get_series_info: json({
        seasons: [],
        info: { name: 'X', cover: null, plot: '' },
        episodes: {
          2: [{
            id: '10', episode_num: '1', title: 'X - S02E01',
            container_extension: 'mp4', info: {},
          }],
          3: [{
            id: '11', episode_num: '1', title: 'X - S03E01',
            container_extension: 'mp4', info: {},
          }],
        },
      }),
    }));
    const s = await serie(1);
    expect(s.temporadas.map((t) => t.numero)).toEqual([2, 3]);
    expect(s.temporadas[0].nombre).toBe('Temporada 2');
  });

  it('ordena las temporadas por número, no por orden de clave', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_series_info: json({
        seasons: [{ season_number: 10, name: 'Décima' }],
        info: {},
        episodes: {
          10: [{
            id: '1', episode_num: '1', title: 'a',
            container_extension: 'mp4', info: {},
          }],
          2: [{
            id: '2', episode_num: '1', title: 'b',
            container_extension: 'mp4', info: {},
          }],
        },
      }),
    }));
    const s = await serie(1);
    expect(s.temporadas.map((t) => t.numero)).toEqual([2, 10]);
    // Cuando `seasons` sí trae nombre, se usa el suyo.
    expect(s.temporadas[1].nombre).toBe('Décima');
  });

  it('normaliza el episodio con su id en texto y su duración', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_series_info: json({
        seasons: [{ season_number: 1 }],
        info: {},
        episodes: {
          1: [{
            id: 6619,
            episode_num: '1',
            title: 'Acapulco - S01E01 - Piloto',
            container_extension: 'mp4',
            direct_source: '',
            info: {
              duration_secs: 2167,
              plot: 'Cuando lo contratan...',
              movie_image: 'http://x/e.jpg',
            },
          }],
        },
      }),
    }));
    const s = await serie(92);
    const e = s.episodiosPorTemporada['1'][0];
    // El id se fuerza a texto: el panel lo devuelve unas veces como número y
    // otras como cadena, y la URL de reproducción tiene que salir igual.
    expect(e.id).toBe('6619');
    expect(e.numero).toBe(1);
    expect(e.duracionSegundos).toBe(2167);
    expect(e.imagen).toBe('http://x/e.jpg');
  });

  it('una serie sin episodios devuelve listas vacías, no revienta', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_series_info: json({ seasons: [], info: {}, episodes: {} }),
    }));
    const s = await serie(1);
    expect(s.temporadas).toEqual([]);
    expect(s.episodiosPorTemporada).toEqual({});
  });
});

describe('listado de series', () => {
  it('sin categoría veta las de adultos', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_series_categories: json([
        { category_id: '30', category_name: 'DRAMA' },
        { category_id: '98', category_name: 'ADULTOS +18' },
      ]),
      get_series: json([
        { series_id: 1, name: 'NORMAL', category_id: '30', category_ids: [30] },
        { series_id: 2, name: 'DISFRAZADA', category_id: '30', category_ids: [30, 98] },
      ]),
    }));
    const { items } = await series();
    // `normalizar` de series.js deja `series_id` tal cual, sin pasarlo a texto:
    // aquí llega el número. En películas es al revés. No se toca: ese
    // comportamiento ya estaba y no es lo que se está cambiando.
    expect(items.map((s) => s.id)).toEqual([1]);
  });

  it('con adultos:true enseña también las vetadas', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_series_categories: json([
        { category_id: '30', category_name: 'DRAMA' },
        { category_id: '98', category_name: 'ADULTOS +18' },
      ]),
      get_series: json([
        { series_id: 1, name: 'NORMAL', category_id: '30', category_ids: [30] },
        { series_id: 2, name: 'DISFRAZADA', category_id: '30', category_ids: [30, 98] },
      ]),
    }));
    // Primero con el candado puesto: es lo que POBLA el conjunto de vetadas.
    // Sin esta llamada la prueba pasaría igual aunque el filtro no mirase
    // `adultos`, porque no habría nada vetado que saltarse.
    expect((await series()).items.map((s) => s.id)).toEqual([1]);
    const { items } = await series({ adultos: true });
    expect(items.map((s) => s.id)).toEqual([1, 2]);
  });
});
