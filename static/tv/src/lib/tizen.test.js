import { describe, it, expect, afterEach } from 'vitest';
import { hayAvplay, TECLAS, registrarTeclas, salirDeLaApp } from './tizen.js';

afterEach(() => {
  delete window.webapis;
  delete window.tizen;
});

describe('detección del televisor', () => {
  it('no hay avplay en un navegador normal', () => {
    expect(hayAvplay()).toBe(false);
  });

  it('hay avplay cuando el televisor lo inyecta', () => {
    window.webapis = { avplay: { open() {} } };
    expect(hayAvplay()).toBe(true);
  });

  it('ATRAS es 10009, el código del mando de Samsung', () => {
    expect(TECLAS.ATRAS).toBe(10009);
  });
});

describe('registro de teclas', () => {
  it('no revienta fuera de un televisor', () => {
    expect(() => registrarTeclas()).not.toThrow();
  });

  it('registra las teclas de reproducción cuando hay tizen', () => {
    const registradas = [];
    window.tizen = { tvinputdevice: { registerKey: (k) => registradas.push(k) } };
    registrarTeclas();
    expect(registradas).toContain('MediaPlayPause');
    expect(registradas).toContain('MediaStop');
  });

  it('si una tecla no existe en el modelo, registra las demás', () => {
    const registradas = [];
    window.tizen = {
      tvinputdevice: {
        registerKey: (k) => {
          if (k === 'MediaPlay') throw new Error('no existe en este modelo');
          registradas.push(k);
        },
      },
    };
    expect(() => registrarTeclas()).not.toThrow();
    expect(registradas).toContain('MediaPlayPause');
    expect(registradas).toContain('MediaStop');
  });
});

describe('salir de la app', () => {
  it('no revienta en un navegador', () => {
    expect(() => salirDeLaApp()).not.toThrow();
  });

  it('llama a exit() en el televisor', () => {
    let salido = false;
    window.tizen = {
      application: {
        getCurrentApplication: () => ({ exit: () => { salido = true; } }),
      },
    };
    salirDeLaApp();
    expect(salido).toBe(true);
  });
});
