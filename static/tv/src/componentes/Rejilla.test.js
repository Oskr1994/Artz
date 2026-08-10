import { describe, it, expect } from 'vitest';
import { paginasDe, recorte } from './Rejilla.jsx';

describe('paginación en memoria', () => {
  it('reparte 561 películas en páginas de 60', () => {
    // PRIME VIDEO, la categoría más grande del panel.
    expect(paginasDe(561, 60)).toBe(10);
  });

  it('una categoría con un solo título tiene una página, no cero', () => {
    // ESTRENOS 2026 tiene exactamente 1. Con 0 elementos saldría 0 páginas y la
    // interfaz pintaría "página 1 de 0".
    expect(paginasDe(1, 60)).toBe(1);
    expect(paginasDe(0, 60)).toBe(1);
  });

  it('un múltiplo exacto no añade una página vacía', () => {
    expect(paginasDe(120, 60)).toBe(2);
  });

  it('recorta la página pedida', () => {
    const todos = Array.from({ length: 130 }, (_, i) => i);
    expect(recorte(todos, 1, 60)).toEqual(todos.slice(0, 60));
    expect(recorte(todos, 3, 60)).toEqual(todos.slice(120, 130));
  });

  it('una página fuera de rango devuelve vacío en vez de reventar', () => {
    expect(recorte([1, 2, 3], 9, 60)).toEqual([]);
  });
});
