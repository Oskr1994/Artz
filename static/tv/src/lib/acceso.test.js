import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DIAS_DE_GRACIA, entrar, leerCodigoGuardado, revalidar } from './acceso.js';
import {
  credenciales, guardarCredenciales, olvidarCredenciales, panel,
} from './xui/nucleo.js';
import { formatearCodigo, normalizarCodigo } from './codigo.js';

beforeEach(() => { localStorage.clear(); olvidarCredenciales(); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); olvidarCredenciales(); });

function respuesta(cuerpo, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => cuerpo };
}

const CONCEDIDO = {
  base_url: 'https://otro.example',
  caduca_el: '2026-12-01T00:00:00+00:00',
  user_info: { status: 'Active', allowed_output_formats: ['ts'] },
};

describe('formateo del código', () => {
  it('filtra lo que no es del alfabeto en vez de rechazarlo', () => {
    // Guion largo y minúsculas: lo que sale de un teclado en pantalla.
    expect(formatearCodigo('7ern—b5xk')).toBe('7ERN-B5XK');
  });

  it('quita el guion antes de mandarlo', () => {
    expect(normalizarCodigo('7ERN-B5XK')).toBe('7ERNB5XK');
  });

  it('no deja pasar de ocho caracteres', () => {
    expect(normalizarCodigo('7ERNB5XKDEMAS')).toBe('7ERNB5XK');
  });
});

// Medido en el televisor: al entrar se llamaba DOS VECES a `/tv/acceso`, una
// desde `entrar` y otra desde la revalidación que `App` dispara al montar. Eran
// 732 ms de los 3 446 que tardaba el inicio de sesión, y obligaban al backend a
// validar contra el panel del proveedor otra vez para nada.
describe('no preguntar dos veces lo mismo', () => {
  it('recién validado, revalidar no vuelve a llamar al servidor', async () => {
    const red = vi.fn(async () => respuesta(CONCEDIDO));
    vi.stubGlobal('fetch', red);

    await entrar('7ERN-B5XK', 'manueldemo', 'manueldemo');
    expect(red).toHaveBeenCalledTimes(1);

    expect(await revalidar()).toBe(true);
    expect(red).toHaveBeenCalledTimes(1);
  });

  it('pasado el margen, sí vuelve a preguntar', async () => {
    const red = vi.fn(async () => respuesta(CONCEDIDO));
    vi.stubGlobal('fetch', red);
    await entrar('7ERN-B5XK', 'manueldemo', 'manueldemo');

    // Como si la app llevara horas abierta.
    const guardadas = credenciales();
    guardarCredenciales(guardadas.usuario, guardadas.clave, guardadas.info, {
      revalidado_en: Date.now() - 7 * 60 * 60 * 1000,
    });

    expect(await revalidar()).toBe(true);
    expect(red).toHaveBeenCalledTimes(2);
  });

  it('el margen NO tapa una cuenta caducada', () => {
    // La caducidad se mira en local y antes que nada: si no, bastaría con
    // reabrir la app cada poco para estirar una suscripción vencida.
    const red = vi.fn(async () => respuesta(CONCEDIDO));
    vi.stubGlobal('fetch', red);
    guardarCredenciales('u', 'p', null, {
      codigo: 'ABCD2345',
      caduca_el: '2020-01-01T00:00:00+00:00',
      revalidado_en: Date.now(),
    });

    return revalidar().then((sigue) => {
      expect(sigue).toBe(false);
      expect(credenciales()).toBe(null);
      expect(red).not.toHaveBeenCalled();
    });
  });
});

describe('entrar', () => {
  it('guarda la URL del panel que devuelve el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(CONCEDIDO)));

    await entrar('7ERN-B5XK', 'manueldemo', 'manueldemo');

    expect(panel()).toBe('https://otro.example');
    expect(credenciales().codigo).toBe('7ERNB5XK');
    expect(credenciales().caduca_el).toBe('2026-12-01T00:00:00+00:00');
    expect(credenciales().revalidado_en).toBeGreaterThan(0);
  });

  it('manda el código sin guion y la contraseña sin tocar', async () => {
    const espia = vi.fn(async () => respuesta(CONCEDIDO));
    vi.stubGlobal('fetch', espia);

    await entrar('7ern—b5xk', 'manueldemo', 'a/b=c');

    const enviado = JSON.parse(espia.mock.calls[0][1].body);
    expect(enviado).toEqual({
      codigo: '7ERNB5XK', username: 'manueldemo', password: 'a/b=c',
    });
  });

  it('recuerda el código para la próxima vez, con guion', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(CONCEDIDO)));

    await entrar('7ernb5xk', 'u', 'p');

    // Sobrevive a cerrar sesión: salir es cambiar de cuenta del proveedor, no
    // de proveedor, y teclear ocho caracteres con un mando es caro.
    olvidarCredenciales();
    expect(leerCodigoGuardado()).toBe('7ERN-B5XK');
  });

  it('no guarda nada si el servidor rechaza', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(
      { detail: 'Cuenta inválida o caducada.' }, { ok: false, status: 401 },
    )));

    await expect(entrar('7ERN-B5XK', 'u', 'p')).rejects.toMatchObject({ codigo: 401 });
    expect(credenciales()).toBe(null);
  });

  it('sin red da un error de conexión, no uno de credenciales', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('failed to fetch'); }));

    // Código nulo, que `mensajeDeError` traduce a "no hay conexión". De esa
    // diferencia depende que una caída nuestra no eche a nadie de la tele.
    await expect(entrar('7ERN-B5XK', 'u', 'p')).rejects.toMatchObject({ codigo: null });
  });
});

describe('revalidar', () => {
  /**
   * Una sesión dentro y con la revalidación YA VENCIDA.
   *
   * `revalidado_en` es de hace diez minutos a propósito: con `Date.now()` estos
   * casos no probaban nada desde que existe `MS_MINIMO_ENTRE_PREGUNTAS`, porque
   * `revalidar` cortaba antes de tocar la red. Diez minutos pasa ese margen y
   * está muy lejos de los siete días de gracia.
   */
  const sesion = (extra = {}) =>
    guardarCredenciales('u', 'p', { status: 'Active' }, {
      codigo: '7ERNB5XK',
      base_url: 'https://uno.example',
      caduca_el: null,
      revalidado_en: Date.now() - 10 * 60 * 1000,
      ...extra,
    });

  const sinRed = () =>
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('failed to fetch'); }));

  it('sin sesión no hay nada que revalidar', async () => {
    expect(await revalidar()).toBe(false);
  });

  it('con el código caducado echa SIN preguntar a nadie', async () => {
    const espia = vi.fn();
    vi.stubGlobal('fetch', espia);
    sesion({ caduca_el: new Date(Date.now() - 1000).toISOString() });

    expect(await revalidar()).toBe(false);
    // Lo importante es que ni se intenta: es lo que cierra el agujero de dejar
    // el televisor sin ruta hacia nosotros para estirar una suscripción
    // vencida los siete días de gracia.
    expect(espia).not.toHaveBeenCalled();
    expect(credenciales()).toBe(null);
  });

  it('sin caducidad no echa por esa vía', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(
      { base_url: 'https://uno.example', caduca_el: null, user_info: {} },
    )));
    sesion({ caduca_el: null });

    expect(await revalidar()).toBe(true);
  });

  it('un 401 borra lo guardado', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(
      { detail: 'Cuenta inválida o caducada.' }, { ok: false, status: 401 },
    )));
    sesion();

    expect(await revalidar()).toBe(false);
    expect(credenciales()).toBe(null);
  });

  it('un fallo de red conserva la sesión y NO echa', async () => {
    sinRed();
    sesion();

    // El control de acceso cede ante la disponibilidad: una caída nuestra no
    // puede dejar a nadie sin televisión.
    expect(await revalidar()).toBe(true);
    expect(credenciales()).not.toBe(null);
  });

  it('pero más de siete días sin conseguirlo, echa', async () => {
    sinRed();
    sesion({ revalidado_en: Date.now() - (DIAS_DE_GRACIA + 1) * 86400000 });

    expect(await revalidar()).toBe(false);
    expect(credenciales()).toBe(null);
  });

  it('un 503 nuestro tampoco echa: no es culpa de quien mira', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta({}, { ok: false, status: 503 })));
    sesion();

    expect(await revalidar()).toBe(true);
  });

  it('actualiza la URL del panel con lo que diga el servidor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(
      { base_url: 'https://mudado.example', caduca_el: null, user_info: {} },
    )));
    sesion({ base_url: 'https://uno.example' });

    await revalidar();

    // Es lo que hace que cambiar la URL de un proveedor en /admin llegue a los
    // televisores sin reinstalar nada.
    expect(panel()).toBe('https://mudado.example');
  });

  it('actualiza la caducidad, así que renovar en /admin llega solo', async () => {
    const nueva = '2027-01-01T00:00:00+00:00';
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(
      { base_url: 'https://uno.example', caduca_el: nueva, user_info: {} },
    )));
    sesion({ caduca_el: '2026-09-01T00:00:00+00:00' });

    await revalidar();

    expect(credenciales().caduca_el).toBe(nueva);
  });

  it('conserva el código al revalidar, que no viene en la respuesta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => respuesta(
      { base_url: 'https://uno.example', caduca_el: null, user_info: {} },
    )));
    sesion();

    await revalidar();

    // Si `guardarCredenciales` escribiera el objeto entero en vez de mezclar,
    // aquí quedaría `undefined` y la siguiente revalidación mandaría un código
    // vacío: 401, y fuera.
    expect(credenciales().codigo).toBe('7ERNB5XK');
  });
});
