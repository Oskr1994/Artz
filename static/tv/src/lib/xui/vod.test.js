import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guardarCredenciales, olvidarCredenciales, panel } from './nucleo.js';
import { categoriasDePeliculas, peliculas, pelicula, urlDePelicula } from './vod.js';

function json(cuerpo) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => cuerpo,
  };
}

/** Responde según la `action` que lleve la URL. */
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

describe('URL de película', () => {
  it('usa la extensión DEL TÍTULO, no el formato de la línea', () => {
    // `allowed_output_formats` es ['m3u8','ts','rtmp'] en esta línea, y aun así
    // una película en mkv tiene que pedirse como .mkv. Confundir ambas cosas es
    // el error clásico al añadir VOD sobre un cliente de directo.
    guardarCredenciales('u', 'p', { allowed_output_formats: ['m3u8', 'ts', 'rtmp'] });
    expect(urlDePelicula(3193, 'mkv')).toBe(`${panel()}/movie/u/p/3193.mkv`);
    expect(urlDePelicula(6225, 'mp4')).toBe(`${panel()}/movie/u/p/6225.mp4`);
  });

  it('escapa usuario y clave', () => {
    guardarCredenciales('u ñ', 'p/q', null);
    expect(urlDePelicula(1, 'mp4')).toBe(`${panel()}/movie/u%20%C3%B1/p%2Fq/1.mp4`);
  });

  it('sin extensión conocida cae a mp4', () => {
    expect(urlDePelicula(1, null)).toBe(`${panel()}/movie/u/p/1.mp4`);
  });

  it('direct_source manda sobre la URL construida', () => {
    expect(urlDePelicula(1, 'mkv', 'http://otro/servidor/x.mkv'))
      .toBe('http://otro/servidor/x.mkv');
  });
});

describe('listado de películas', () => {
  it('pide al panel solo la categoría elegida', async () => {
    // 2918 películas son 2,5 MB. Pedir por categoría baja a unos cientos.
    const fetchFalso = panelFalso({
      get_vod_streams: json([
        {
          stream_id: 1, name: 'A', category_id: '20', category_ids: [20],
          container_extension: 'mp4',
        },
      ]),
    });
    vi.stubGlobal('fetch', fetchFalso);
    await peliculas({ category: '20' });
    const url = new URL(String(fetchFalso.mock.calls[0][0]));
    expect(url.searchParams.get('category_id')).toBe('20');
  });

  it('sin categoría no manda category_id y veta las de adultos', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_vod_categories: json([
        { category_id: '20', category_name: 'ACCION' },
        { category_id: '99', category_name: 'XXX' },
      ]),
      get_vod_streams: json([
        {
          stream_id: 1, name: 'NORMAL', category_id: '20', category_ids: [20],
          container_extension: 'mp4',
        },
        {
          stream_id: 2, name: 'DISFRAZADA', category_id: '20', category_ids: [20, 99],
          container_extension: 'mp4',
        },
      ]),
    }));
    const { items } = await peliculas();
    expect(items.map((p) => p.id)).toEqual([1]);
  });

  it('con adultos:true enseña también las vetadas', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_vod_categories: json([
        { category_id: '20', category_name: 'ACCION' },
        { category_id: '99', category_name: 'XXX' },
      ]),
      get_vod_streams: json([
        {
          stream_id: 1, name: 'NORMAL', category_id: '20', category_ids: [20],
          container_extension: 'mp4',
        },
        {
          stream_id: 2, name: 'DISFRAZADA', category_id: '20', category_ids: [20, 99],
          container_extension: 'mp4',
        },
      ]),
    }));
    // Primero con el candado puesto: es lo que POBLA el conjunto de vetadas.
    // Sin esta llamada la prueba pasaría igual aunque el filtro no mirase
    // `adultos`, porque no habría nada vetado que saltarse.
    expect((await peliculas()).items.map((p) => p.id)).toEqual([1]);
    const { items } = await peliculas({ adultos: true });
    expect(items.map((p) => p.id)).toEqual([1, 2]);
  });

  it('filtra por texto sin distinguir mayúsculas', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_vod_categories: json([{ category_id: '20', category_name: 'ACCION' }]),
      get_vod_streams: json([
        {
          stream_id: 1, name: 'Land of Bad (2024)', category_id: '20',
          category_ids: [20], container_extension: 'mkv',
        },
        {
          stream_id: 2, name: 'Michael (2026)', category_id: '20',
          category_ids: [20], container_extension: 'mp4',
        },
      ]),
    }));
    const { items } = await peliculas({ q: 'MICHAEL' });
    expect(items.map((p) => p.id)).toEqual([2]);
  });

  it('normaliza los campos que la interfaz necesita', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_vod_categories: json([{ category_id: '20', category_name: 'ACCION' }]),
      get_vod_streams: json([{
        stream_id: 3290,
        name: 'Land of Bad (2024)',
        year: '2024',
        stream_icon: 'http://38.224.231.176:80/images/x.jpg',
        rating: 6.8,
        genre: 'Acción',
        container_extension: 'mkv',
        category_id: '20',
        category_ids: [20],
        direct_source: '',
      }]),
    }));
    const { items, total } = await peliculas();
    expect(total).toBe(1);
    expect(items[0]).toEqual({
      id: 3290,
      name: 'Land of Bad (2024)',
      icon: 'http://38.224.231.176:80/images/x.jpg',
      year: '2024',
      rating: 6.8,
      genre: 'Acción',
      extension: 'mkv',
      fuenteDirecta: null,
    });
  });

  it('avisa si el panel no reconoce la acción', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({
      user_info: { auth: 1 }, server_info: {},
    })));
    await expect(peliculas({ category: '20' })).rejects.toThrow(/no reconoce la acción/);
  });

  it('deja fuera las categorías de adultos salvo que se pidan', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_vod_categories: json([
        { category_id: '20', category_name: 'ACCION' },
        { category_id: '99', category_name: 'XXX' },
      ]),
    }));
    expect((await categoriasDePeliculas()).map((c) => c.name)).toEqual(['ACCION']);
    expect((await categoriasDePeliculas({ adultos: true })).map((c) => c.name))
      .toEqual(['ACCION', 'XXX']);
  });
});

describe('ficha de película', () => {
  it('funde info y movie_data en un solo objeto', async () => {
    // `get_vod_info` parte los datos en dos: la ficha en `info` y los de
    // reproducción en `movie_data`. La interfaz no debería saber eso.
    vi.stubGlobal('fetch', panelFalso({
      get_vod_info: json({
        info: {
          movie_image: 'http://x/img.jpg',
          duration_secs: 6396,
          rating: 6.4,
          genre: 'Comedia',
          plot: 'Sinopsis.',
          director: 'Abdulaziz Safar',
          cast: 'Tariq Al-Ali',
          release_date: '2013-08-08',
        },
        movie_data: {
          stream_id: 3193,
          name: 'Below Zero (2013)',
          year: '2013',
          container_extension: 'mkv',
          direct_source: '',
        },
      }),
    }));
    const p = await pelicula(3193);
    expect(p).toEqual({
      id: 3193,
      name: 'Below Zero (2013)',
      icon: 'http://x/img.jpg',
      extension: 'mkv',
      year: '2013',
      duracionSegundos: 6396,
      rating: 6.4,
      genre: 'Comedia',
      plot: 'Sinopsis.',
      director: 'Abdulaziz Safar',
      cast: 'Tariq Al-Ali',
      fuenteDirecta: null,
    });
  });

  it('sobrevive a una ficha a medias', async () => {
    // El panel devuelve fichas incompletas a menudo: sin sinopsis, sin reparto y
    // sin duración. La pantalla no debe reventar por eso.
    vi.stubGlobal('fetch', panelFalso({
      get_vod_info: json({ info: {}, movie_data: { stream_id: 7, name: 'X' } }),
    }));
    const p = await pelicula(7);
    expect(p.id).toBe(7);
    expect(p.extension).toBe('mp4');
    expect(p.duracionSegundos).toBe(null);
    expect(p.plot).toBe('');
  });
});
