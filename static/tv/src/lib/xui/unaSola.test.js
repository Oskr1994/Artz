import { describe, it, expect, vi } from 'vitest';
import { unaSola } from './nucleo.js';

// Medido en Chrome al entrar: `get_live_categories` salía DOS VECES, una por el
// gancho que pinta la barra lateral y otra desde dentro de `canales()`, que
// necesita saber qué categorías vetar. Dos peticiones idénticas a un panel que
// admite una conexión simultánea, y la segunda en el camino crítico.

describe('una sola petición para los que coinciden', () => {
  it('dos llamadas a la vez comparten una sola petición', async () => {
    const red = vi.fn(async () => 'datos');
    const [a, b] = await Promise.all([
      unaSola('x', red),
      unaSola('x', red),
    ]);
    expect(red).toHaveBeenCalledTimes(1);
    expect(a).toBe('datos');
    expect(b).toBe('datos');
  });

  it('claves distintas no se mezclan', async () => {
    const red = vi.fn(async (n) => n);
    await Promise.all([unaSola('a', () => red('a')), unaSola('b', () => red('b'))]);
    expect(red).toHaveBeenCalledTimes(2);
  });

  it('cuando termina, la siguiente SÍ vuelve a pedir', async () => {
    // No es una caché: solo junta las que van a la vez. Cachear aquí pisaría a
    // TanStack Query, que es quien decide cuánto duran los datos.
    const red = vi.fn(async () => 'datos');
    await unaSola('x', red);
    await unaSola('x', red);
    expect(red).toHaveBeenCalledTimes(2);
  });

  it('un fallo llega a los dos y no deja la clave atascada', async () => {
    const red = vi.fn(async () => { throw new Error('sin red'); });
    await expect(Promise.all([unaSola('x', red), unaSola('x', red)])).rejects.toThrow('sin red');
    expect(red).toHaveBeenCalledTimes(1);

    // Si la clave se quedara ocupada, nadie podría reintentar nunca.
    const buena = vi.fn(async () => 'ya va');
    expect(await unaSola('x', buena)).toBe('ya va');
  });
});
