import { describe, it, expect, beforeEach } from 'vitest';
import {
  leerPreferencia, guardarPreferencia, pistaAAplicar,
} from './preferenciaDePistas.js';

beforeEach(() => localStorage.clear());

const ESPANOL = { indice: 0, tipo: 'AUDIO', idioma: 'spa', etiqueta: 'Español Latino' };
const INGLES = { indice: 1, tipo: 'AUDIO', idioma: 'eng', etiqueta: 'Inglés' };

describe('guardar y leer', () => {
  it('guarda la posición y el idioma', () => {
    guardarPreferencia('audio', ESPANOL);
    expect(leerPreferencia().audio).toEqual({ indice: 0, idioma: 'spa' });
  });

  it('sin nada guardado no revienta', () => {
    expect(leerPreferencia()).toEqual({ audio: null, subtitulo: null });
  });

  it('audio y subtítulo se guardan por separado', () => {
    guardarPreferencia('audio', ESPANOL);
    guardarPreferencia('subtitulo', { indice: 2, idioma: 'spa' });
    const p = leerPreferencia();
    expect(p.audio.indice).toBe(0);
    expect(p.subtitulo.indice).toBe(2);
  });

  it('guardar null olvida esa preferencia', () => {
    // Es lo que pasa al elegir «Ninguno» en subtítulos.
    guardarPreferencia('subtitulo', { indice: 2, idioma: 'spa' });
    guardarPreferencia('subtitulo', null);
    expect(leerPreferencia().subtitulo).toBe(null);
  });

  it('un contenido corrupto se descarta', () => {
    localStorage.setItem('fp_pistas', 'no es json');
    expect(leerPreferencia()).toEqual({ audio: null, subtitulo: null });
  });
});

describe('qué pista aplicar', () => {
  it('aplica la guardada cuando el idioma de esa posición coincide', () => {
    expect(pistaAAplicar([ESPANOL, INGLES], { indice: 0, idioma: 'spa' })).toBe(ESPANOL);
  });

  // El motivo de toda esta comprobación: el número de pista cambia de un
  // fichero a otro, y aplicarlo a ciegas pondría inglés sin avisar de nada.
  it('NO aplica si en esa posición hay otro idioma', () => {
    const alReves = [
      { indice: 0, tipo: 'AUDIO', idioma: 'eng', etiqueta: 'Inglés' },
      { indice: 1, tipo: 'AUDIO', idioma: 'spa', etiqueta: 'Español' },
    ];
    expect(pistaAAplicar(alReves, { indice: 0, idioma: 'spa' })).toBe(null);
  });

  it('sin preferencia guardada no aplica nada', () => {
    expect(pistaAAplicar([ESPANOL, INGLES], null)).toBe(null);
  });

  it('si la posición ya no existe, no aplica nada', () => {
    expect(pistaAAplicar([ESPANOL], { indice: 7, idioma: 'spa' })).toBe(null);
  });

  it('sin pistas no revienta', () => {
    expect(pistaAAplicar([], { indice: 0, idioma: 'spa' })).toBe(null);
    expect(pistaAAplicar(null, { indice: 0, idioma: 'spa' })).toBe(null);
  });
});
