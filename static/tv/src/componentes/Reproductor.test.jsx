import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Reproductor from './Reproductor.jsx';
import { guardarCredenciales, olvidarCredenciales } from '../lib/xui.js';

// Regresión de un fallo real: al añadir el modo bajo demanda, `alTerminar`
// entró en las dependencias del efecto que abre el vídeo. En vivo NO pasa ese
// aviso, así que tomaba el valor por defecto, que era `() => {}` escrito en la
// firma: una función NUEVA en cada render. El efecto se reejecutaba sin parar
// —abrir, `stop()` + `close()`, abrir— y en el televisor se veía la imagen
// aparecer y desaparecer detrás de un "Sintonizando…" que no se iba nunca.
//
// No da ningún error en consola, así que solo se detecta contando llamadas.

let raiz;
let contenedor;

function prepararAvplay({ prepara = false } = {}) {
  const av = {
    open: vi.fn(),
    close: vi.fn(),
    stop: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    setDisplayRect: vi.fn(),
    setDisplayMethod: vi.fn(),
    getDuration: vi.fn(() => 0),
    getCurrentStreamInfo: vi.fn(() => []),
    getTotalTrackInfo: vi.fn(() => []),
    getState: vi.fn(() => 'PLAYING'),
    setSelectTrack: vi.fn(),
    setSilentSubtitle: vi.fn(),
    // Se guarda para poder disparar `onstreamcompleted` desde el test.
    setListener: vi.fn((oyentes) => { av.oyentes = oyentes; }),
    // Por defecto se queda a medias: para contar aperturas no hace falta
    // preparar de verdad.
    prepareAsync: vi.fn((exito) => { if (prepara) exito(); }),
    oyentes: null,
  };
  window.webapis = { avplay: av };
  return av;
}

beforeEach(() => {
  localStorage.clear();
  olvidarCredenciales();
  guardarCredenciales('u', 'p', null);
  // jsdom no lo trae y el componente lo usa para recolocar el plano de vídeo.
  window.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
});

afterEach(() => {
  if (raiz) act(() => raiz.unmount());
  raiz = null;
  contenedor.remove();
  delete window.webapis;
  vi.restoreAllMocks();
  localStorage.clear();
  olvidarCredenciales();
});

describe('estabilidad del efecto que abre el vídeo', () => {
  it('no reabre el canal porque el padre recree sus avisos', async () => {
    const av = prepararAvplay();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, {
        streamId: 7492,
        nombre: 'CANAL',
        // Funciones EN LÍNEA, que es justo lo que rompía: identidad nueva en
        // cada render.
        alExpirarSesion: () => {},
        alTerminar: () => {},
      }));
    });

    const tras_montar = av.open.mock.calls.length;
    expect(tras_montar).toBe(1);

    // Tres renders más con avisos recreados cada vez. Ninguno debe reabrir.
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        raiz.render(createElement(Reproductor, {
          streamId: 7492,
          nombre: 'CANAL',
          alExpirarSesion: () => {},
          alTerminar: () => {},
        }));
      });
    }

    expect(av.open.mock.calls.length).toBe(1);
    expect(av.close.mock.calls.length).toBe(0);
  });

  it('sí reabre cuando cambia de canal, que es lo que debe hacer', async () => {
    const av = prepararAvplay();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, { streamId: 7492, nombre: 'UNO' }));
    });
    await act(async () => {
      raiz.render(createElement(Reproductor, { streamId: 7493, nombre: 'DOS' }));
    });

    expect(av.open.mock.calls.length).toBe(2);
    // Sin `stop` + `close` el decodificador queda ocupado y el canal siguiente
    // se queda en negro sin dar ningún error.
    expect(av.stop.mock.calls.length).toBe(1);
    expect(av.close.mock.calls.length).toBe(1);
  });

  it('abre la URL de la fuente cuando es vídeo bajo demanda', async () => {
    const av = prepararAvplay();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, {
        fuente: {
          url: 'https://panel/movie/u/p/3193.mkv',
          titulo: 'Below Zero',
          duracionSegundos: 6396,
        },
        nombre: 'Below Zero',
        alTerminar: () => {},
      }));
    });

    expect(av.open).toHaveBeenCalledWith('https://panel/movie/u/p/3193.mkv');
  });
});

// Medido en el televisor cortándole la emisión de verdad (se le robó la
// conexión aprovechando que la línea admite una sola simultánea):
//
//    0s-18s  el reloj avanza      60342 -> 78531
//    21s     el reloj SE CONGELA  78531
//    42s     sigue congelado, estado = PLAYING, sin error
//    eventos: onstreamcompleted()   <- el unico aviso
//
// `onerror` no salta y `getState()` sigue diciendo PLAYING. El único aviso es
// `onstreamcompleted`, que el código daba por imposible en directo. Resultado:
// fotograma congelado para siempre, aunque el proveedor vuelva.
describe('cuando el proveedor corta la emisión', () => {
  it('vuelve a abrir el canal en vez de quedarse congelado', async () => {
    vi.useFakeTimers();
    const av = prepararAvplay({ prepara: true });
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, { streamId: 7492, nombre: 'AXN' }));
    });
    expect(av.open).toHaveBeenCalledTimes(1);

    // El corte, tal como lo cuenta AVPlay en directo.
    await act(async () => { av.oyentes.onstreamcompleted(); });

    // No se reabre al instante: el proveedor necesita unos segundos para volver
    // y machacarle a peticiones no ayuda.
    expect(av.open).toHaveBeenCalledTimes(1);

    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    expect(av.open).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('mientras reconecta lo dice, en vez de dejar la pantalla muerta', async () => {
    vi.useFakeTimers();
    const av = prepararAvplay({ prepara: true });
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, { streamId: 7492, nombre: 'AXN' }));
    });
    await act(async () => { av.oyentes.onstreamcompleted(); });

    expect(contenedor.textContent).toContain('Reconectando');
    vi.useRealTimers();
  });

  it('se rinde tras varios intentos, con un mensaje y no en silencio', async () => {
    vi.useFakeTimers();
    const av = prepararAvplay({ prepara: true });
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, { streamId: 7492, nombre: 'AXN' }));
    });

    // Un corte que no se arregla: cada reapertura vuelve a cortarse.
    for (let i = 0; i < 12; i += 1) {
      await act(async () => { av.oyentes.onstreamcompleted(); });
      await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    }

    expect(contenedor.textContent).toContain('no se pudo recuperar');
    vi.useRealTimers();
  });

  it('bajo demanda NO reconecta: ahí el final es el final', async () => {
    vi.useFakeTimers();
    const av = prepararAvplay({ prepara: true });
    const alTerminar = vi.fn();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, {
        fuente: { url: 'https://panel/movie/u/p/1.mp4', titulo: 'X', duracionSegundos: null },
        nombre: 'X',
        alTerminar,
      }));
    });
    await act(async () => { av.oyentes.onstreamcompleted(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });

    expect(alTerminar).toHaveBeenCalled();
    expect(av.open).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

// Con el nodo de contenido caído el panel NO da error: acepta la petición y
// sirve un flujo de relleno que se acaba en segundos. Medido contra el servidor
// real: cinco películas distintas devolvían el MISMO MPEG-TS.
describe('pelicula que termina antes de tiempo', () => {
  const PELICULA = {
    url: 'https://panel/movie/u/p/3193.mkv',
    titulo: 'Below Zero',
    duracionSegundos: 6396, // 1 h 46 min según la ficha
  };

  it('avisa en vez de volver en silencio a la ficha', async () => {
    const av = prepararAvplay({ prepara: true });
    const alTerminar = vi.fn();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, {
        fuente: PELICULA, nombre: PELICULA.titulo, alTerminar,
      }));
    });

    // Se acaba con el reloj casi a cero: eso no era una película de 1 h 46 min.
    await act(async () => { av.oyentes.onstreamcompleted(); });

    expect(contenedor.textContent).toContain('no está disponible');
    expect(alTerminar).not.toHaveBeenCalled();
  });

  it('una pelicula vista entera sí vuelve a la ficha', async () => {
    const av = prepararAvplay({ prepara: true });
    const alTerminar = vi.fn();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, {
        fuente: PELICULA, nombre: PELICULA.titulo, alTerminar,
      }));
    });

    // AVPlay informa de la posición en MILISEGUNDOS.
    await act(async () => { av.oyentes.oncurrentplaytime(6300 * 1000); });
    await act(async () => { av.oyentes.onstreamcompleted(); });

    expect(alTerminar).toHaveBeenCalled();
    expect(contenedor.textContent).not.toContain('no está disponible');
  });

  it('sin duración en la ficha no se inventa un fallo', async () => {
    // Muchas fichas del panel vienen sin `duration_secs`. Sin ese dato no hay
    // con qué comparar, y acusar de fallo a lo que quizá funcionó sería peor.
    const av = prepararAvplay({ prepara: true });
    const alTerminar = vi.fn();
    raiz = createRoot(contenedor);

    await act(async () => {
      raiz.render(createElement(Reproductor, {
        fuente: { url: 'https://panel/movie/u/p/7.mp4', titulo: 'X', duracionSegundos: null },
        nombre: 'X',
        alTerminar,
      }));
    });

    await act(async () => { av.oyentes.onstreamcompleted(); });

    expect(alTerminar).toHaveBeenCalled();
  });
});
