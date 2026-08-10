import { describe, it, expect } from 'vitest';
import { formatearDuracion, reloj } from './duracion.js';

describe('formateo de duración', () => {
  it('parte en horas y minutos', () => {
    expect(formatearDuracion(6396)).toBe('1 h 46 min');
  });

  it('menos de una hora va solo en minutos', () => {
    expect(formatearDuracion(2167)).toBe('36 min');
  });

  it('sin dato devuelve null para poder omitirlo', () => {
    // Muchas fichas del panel vienen sin `duration_secs`. Devolver "0 min"
    // pintaría un dato falso en la ficha.
    expect(formatearDuracion(null)).toBe(null);
    expect(formatearDuracion(0)).toBe(null);
  });

  it('no redondea 119 minutos a "1 h 60 min"', () => {
    expect(formatearDuracion(7140)).toBe('1 h 59 min');
  });
});

describe('reloj de la barra de progreso', () => {
  it('pasa de la hora con dos dígitos en minutos y segundos', () => {
    expect(reloj(6396)).toBe('1:46:36');
  });

  it('por debajo de la hora no pinta un cero delante', () => {
    expect(reloj(2167)).toBe('36:07');
  });

  it('el arranque es 0:00, no vacío', () => {
    // La barra aparece antes de que AVPlay informe de la posición.
    expect(reloj(0)).toBe('0:00');
    expect(reloj(null)).toBe('0:00');
  });
});
