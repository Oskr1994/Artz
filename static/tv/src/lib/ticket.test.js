import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { urlDeCanal } from './ticket.js';
import {
  panel, guardarCredenciales, olvidarCredenciales, canales,
} from './xui.js';

/** Respuesta de `player_api.php` con el tipo de contenido que valida el cliente. */
function respuestaJson(cuerpo) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json; charset=utf-8' },
    json: async () => cuerpo,
  };
}

beforeEach(() => {
  localStorage.clear();
  olvidarCredenciales();
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  olvidarCredenciales();
});

describe('URL de canal contra el panel XUI', () => {
  it('lleva usuario y clave en la ruta: es como se autentica AVPlay', async () => {
    // AVPlay descarga con su propia pila HTTP: no comparte cookies con el
    // WebView ni admite cabeceras de forma fiable, así que la URL es su única
    // forma de identificarse. Antes era un ticket; ahora, la ruta del panel.
    guardarCredenciales('manueldemo', 'manueldemo');
    expect(await urlDeCanal(7481))
      .toBe(`${panel()}/live/manueldemo/manueldemo/7481.ts`);
  });

  it('escapa credenciales con caracteres de URL', async () => {
    guardarCredenciales('u ser+1', 'a/b=c');
    const url = await urlDeCanal(1);
    expect(url).toBe(`${panel()}/live/u%20ser%2B1/a%2Fb%3Dc/1.ts`);
  });

  it('ya no pide ningún ticket', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    guardarCredenciales('u', 'p');
    await urlDeCanal(7481);
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('usa direct_source cuando el canal lo trae relleno', async () => {
    guardarCredenciales('u', 'p');
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      if (String(url).includes('get_live_categories')) return respuestaJson([]);
      return respuestaJson([
        { stream_id: 7481, name: 'FAMILIA TV', category_id: '2', direct_source: '' },
        { stream_id: 999, name: 'OTRO', category_id: '2',
          direct_source: 'http://otro.servidor/flujo.ts' },
      ]);
    }));
    await canales(); // llena la caché que consulta `urlDeDirecto`
    expect(await urlDeCanal(999)).toBe('http://otro.servidor/flujo.ts');
    // El que lo trae vacío sigue construyendo la URL normal.
    expect(await urlDeCanal(7481)).toBe(`${panel()}/live/u/p/7481.ts`);
  });

  it('sin credenciales falla con 401 para que la app pida acceso otra vez', async () => {
    await expect(urlDeCanal(1)).rejects.toMatchObject({ codigo: 401 });
  });
});
