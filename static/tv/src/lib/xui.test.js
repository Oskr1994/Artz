import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  panel, categorias, canales,
  olvidarCredenciales, guardarCredenciales, urlDeDirecto,
} from './xui.js';

function json(cuerpo) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => cuerpo,
  };
}

function html404() {
  return {
    ok: false,
    status: 404,
    headers: { get: () => 'text/html; charset=UTF-8' },
    json: async () => { throw new Error('no es JSON'); },
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

beforeEach(() => { localStorage.clear(); olvidarCredenciales(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); olvidarCredenciales(); });

// Aquí había un bloque «autenticación» que probaba `iniciarSesion`: que el
// 404 del panel se traducía a credenciales incorrectas, que una línea no
// activa se rechazaba... Ese camino ya no existe: entrar pasa por nuestro
// backend, que es quien pide el código de acceso, y lo prueba `acceso.test.js`.
//
// El 404 con HTML de nginx sigue probado más abajo, en el catálogo: es un
// comportamiento del panel, no del login, y `llamar` lo sigue traduciendo.

describe('transporte contra el panel', () => {
  it('traduce el 404 del panel a credenciales incorrectas', async () => {
    // XUI 1.5.13 no devuelve `auth: 0`: responde 404 con HTML de nginx. Sin
    // traducirlo, el mapa de errores lo leería como "contenido no disponible".
    guardarCredenciales('u', 'mala', null);
    vi.stubGlobal('fetch', vi.fn(async () => html404()));
    await expect(canales()).rejects.toMatchObject({
      codigo: 401,
      mensaje: 'Usuario o contraseña incorrectos.',
    });
  });

  it('rechaza una respuesta 200 que no sea JSON', async () => {
    guardarCredenciales('u', 'p', null);
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      headers: { get: () => 'text/html' },
      json: async () => ({}),
    })));
    await expect(canales()).rejects.toMatchObject({ codigo: 401 });
  });

  it('sin credenciales guardadas no llega a llamar', async () => {
    const espia = vi.fn();
    vi.stubGlobal('fetch', espia);
    await expect(canales()).rejects.toMatchObject({ codigo: 401 });
    expect(espia).not.toHaveBeenCalled();
  });
});

describe('catálogo', () => {
  beforeEach(() => guardarCredenciales('u', 'p', null));

  it('avisa con claridad si el panel no reconoce la acción', async () => {
    // Ante una `action` desconocida el panel la IGNORA y devuelve la respuesta
    // de autenticación con 200. Sin control, ese objeto llegaría a un `.filter`
    // y reventaría con un TypeError que no diría nada del problema real.
    vi.stubGlobal('fetch', vi.fn(async () => json({
      user_info: { auth: 1 }, server_info: {},
    })));
    await expect(canales()).rejects.toThrow(/no reconoce la acción/);
  });

  it('un canal aparece en una categoría secundaria de category_ids', async () => {
    // `category_id` es la principal; `category_ids` las lleva todas. Filtrar
    // solo por la principal dejaba estos canales fuera de su categoría.
    vi.stubGlobal('fetch', panelFalso({
      get_live_categories: json([
        { category_id: '2', category_name: 'REGIONALES' },
        { category_id: '4', category_name: 'DEPORTES' },
      ]),
      get_live_streams: json([
        { stream_id: 1, name: 'MIXTO', category_id: '2', category_ids: [2, 4] },
        { stream_id: 2, name: 'SOLO REGIONAL', category_id: '2', category_ids: [2] },
      ]),
    }));
    const { items } = await canales({ category: '4' });
    expect(items.map((c) => c.id)).toEqual([1]);
  });

  it('veta el canal si CUALQUIERA de sus categorías es de adultos', async () => {
    vi.stubGlobal('fetch', panelFalso({
      get_live_categories: json([
        { category_id: '2', category_name: 'REGIONALES' },
        { category_id: '9', category_name: 'ADULTOS' },
      ]),
      get_live_streams: json([
        { stream_id: 1, name: 'NORMAL', category_id: '2', category_ids: [2] },
        // Categoría principal inocente, pero también está en la vetada.
        { stream_id: 2, name: 'DISFRAZADO', category_id: '2', category_ids: [2, 9] },
      ]),
    }));
    const { items } = await canales();
    expect(items.map((c) => c.id)).toEqual([1]);
  });

  it('con adultos:true enseña también los canales vetados', async () => {
    // Aquí estaba el fallo: activar la categoría la hacía aparecer en la barra
    // lateral, pero sus canales seguían sin salir en «Todas», porque el veto
    // vivía en un conjunto compartido que no sabía quién estaba mirando.
    vi.stubGlobal('fetch', panelFalso({
      get_live_categories: json([
        { category_id: '2', category_name: 'REGIONALES' },
        { category_id: '9', category_name: 'ADULTOS' },
      ]),
      get_live_streams: json([
        { stream_id: 1, name: 'NORMAL', category_id: '2', category_ids: [2] },
        { stream_id: 2, name: 'DISFRAZADO', category_id: '2', category_ids: [2, 9] },
      ]),
    }));
    // Primero con el candado puesto: es lo que POBLA el conjunto de vetadas, y
    // es el estado real cuando alguien activa la categoría después de haber
    // estado navegando. Sin esta llamada el conjunto queda vacío, `estaVetada`
    // diría que no a todo y la prueba pasaría igual aunque el filtro no mirase
    // `adultos` — es decir, no probaría nada.
    expect((await canales()).items.map((c) => c.id)).toEqual([1]);
    const { items } = await canales({ adultos: true });
    expect(items.map((c) => c.id)).toEqual([1, 2]);
  });

  it('con adultos:true no pide las categorías para saber qué vetar', async () => {
    // No hay nada que vetar, así que la petición sobra. El panel admite UNA
    // conexión simultánea: cada llamada de menos cuenta.
    const fetchFalso = panelFalso({
      get_live_streams: json([
        { stream_id: 1, name: 'NORMAL', category_id: '2', category_ids: [2] },
      ]),
    });
    vi.stubGlobal('fetch', fetchFalso);
    await canales({ adultos: true });
    const acciones = fetchFalso.mock.calls
      .map((c) => new URL(String(c[0])).searchParams.get('action'));
    expect(acciones).toEqual(['get_live_streams']);
  });

  it('deja fuera las categorías de adultos salvo que se pidan', async () => {
    const respuestas = {
      get_live_categories: json([
        { category_id: '2', category_name: 'REGIONALES' },
        { category_id: '9', category_name: 'ADULTOS' },
      ]),
    };
    vi.stubGlobal('fetch', panelFalso(respuestas));
    expect((await categorias()).map((c) => c.name)).toEqual(['REGIONALES']);
    expect((await categorias({ adultos: true })).map((c) => c.name))
      .toEqual(['REGIONALES', 'ADULTOS']);
  });
});

describe('formato de salida del vídeo', () => {
  it('usa ts cuando la línea lo permite', () => {
    guardarCredenciales('u', 'p', { allowed_output_formats: ['m3u8', 'ts', 'rtmp'] });
    expect(urlDeDirecto(7481)).toBe(`${panel()}/live/u/p/7481.ts`);
  });

  it('cae a m3u8 en una línea que no permita ts', () => {
    // Dar `.ts` por hecho funciona con la línea de prueba y falla con otra.
    guardarCredenciales('u', 'p', { allowed_output_formats: ['m3u8'] });
    expect(urlDeDirecto(7481)).toBe(`${panel()}/live/u/p/7481.m3u8`);
  });

  it('sin user_info guardado sigue funcionando con ts', () => {
    guardarCredenciales('u', 'p', null);
    expect(urlDeDirecto(7481)).toBe(`${panel()}/live/u/p/7481.ts`);
  });
});

describe('el host sale de la sesión, no de la compilación', () => {
  it('usa la URL guardada, comparada contra la URL escrita a mano', () => {
    guardarCredenciales('u', 'p', { allowed_output_formats: ['ts'] }, {
      base_url: 'https://otro.example',
    });
    // Literal a propósito. Los demás tests de este fichero comparan contra
    // `${panel()}`, y eso pasaría en verde aunque `panel()` ignorara la sesión
    // por completo: los dos lados llamarían a la misma función rota. Este es el
    // único que lo clava.
    expect(urlDeDirecto(7481)).toBe('https://otro.example/live/u/p/7481.ts');
    expect(urlDeDirecto(7481)).not.toContain('digitalsmarther');
  });

  it('sin sesión guardada cae al valor de compilación, que es el camino de npm run dev', () => {
    olvidarCredenciales();
    expect(panel()).toBe('https://digitalsmarther.com');
  });
});
