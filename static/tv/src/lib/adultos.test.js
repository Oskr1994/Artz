import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { webcrypto } from 'node:crypto';
import { olvidarCredenciales } from './xui/nucleo.js';
import {
  CODIGO_POR_DEFECTO, comprobarCodigo, guardarCodigo, hayCodigoPropio,
  adultosVisibles, mostrarAdultos,
} from './adultos.js';

// `crypto.subtle` se pone a mano en cada prueba en vez de fiarse de jsdom: los
// dos caminos —con contexto seguro y sin él— tienen que probarse a propósito,
// porque en el televisor está SIN COMPROBAR cuál de los dos corre.

beforeEach(() => { localStorage.clear(); mostrarAdultos(false); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); mostrarAdultos(false); });

describe('el código de adultos', () => {
  it('vale 1234 sin haber configurado nada', async () => {
    expect(CODIGO_POR_DEFECTO).toBe('1234');
    expect(await comprobarCodigo('1234')).toBe(true);
    expect(await comprobarCodigo('0000')).toBe(false);
    expect(hayCodigoPropio()).toBe(false);
    // No se escribe nada al arrancar: la app funciona desde el primer encendido
    // sin configurar nada.
    expect(localStorage.getItem('fp_adultos')).toBe(null);
  });

  it('al cambiarlo, el viejo deja de valer', async () => {
    vi.stubGlobal('crypto', webcrypto);
    await guardarCodigo('9876');
    expect(await comprobarCodigo('9876')).toBe(true);
    expect(await comprobarCodigo('1234')).toBe(false);
    expect(hayCodigoPropio()).toBe(true);
  });

  it('con crypto.subtle no guarda el código en claro', async () => {
    vi.stubGlobal('crypto', webcrypto);
    await guardarCodigo('9876');
    const guardado = localStorage.getItem('fp_adultos');
    expect(guardado).not.toContain('9876');
    expect(guardado).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sin crypto.subtle sigue funcionando, y el respaldo se ve marcado', async () => {
    vi.stubGlobal('crypto', undefined);
    await guardarCodigo('4321');
    expect(localStorage.getItem('fp_adultos')).toBe('claro:4321');
    expect(await comprobarCodigo('4321')).toBe(true);
    expect(await comprobarCodigo('1234')).toBe(false);
  });

  it('lo guardado en claro sigue valiendo si luego aparece crypto.subtle', async () => {
    // Guardado donde no hay contexto seguro, comprobado donde sí. Sin la regla
    // del prefijo el usuario se quedaría fuera sin haber tocado nada.
    vi.stubGlobal('crypto', undefined);
    await guardarCodigo('5555');
    vi.stubGlobal('crypto', webcrypto);
    expect(await comprobarCodigo('5555')).toBe(true);
  });
});

describe('si la categoría está a la vista', () => {
  it('arranca oculta', () => {
    expect(adultosVisibles()).toBe(false);
  });

  it('se abre y se cierra', () => {
    mostrarAdultos(true);
    expect(adultosVisibles()).toBe(true);
    mostrarAdultos(false);
    expect(adultosVisibles()).toBe(false);
  });

  it('cerrar sesión vuelve a esconderla', () => {
    // `olvidarCredenciales` ya limpiaba el conjunto de categorías vetadas: es
    // el sitio donde se deshace todo lo que pertenece a la sesión anterior.
    mostrarAdultos(true);
    olvidarCredenciales();
    expect(adultosVisibles()).toBe(false);
  });

  // Esta prueba va LA ÚLTIMA del fichero: `vi.resetModules()` hace que las
  // importaciones dinámicas posteriores devuelvan módulos nuevos, y eso
  // desconectaría a `olvidarCredenciales` del `mostrarAdultos` importado arriba.
  it('no deja rastro en el almacenamiento: al abrir la app vuelve a estar oculta', async () => {
    mostrarAdultos(true);
    expect(localStorage.length).toBe(0);
    // Volver a cargar el módulo es lo más parecido que hay a reabrir la app.
    vi.resetModules();
    const recienCargado = await import('./adultos.js');
    expect(recienCargado.adultosVisibles()).toBe(false);
  });
});
