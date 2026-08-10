import { describe, it, expect } from 'vitest';
import { normalizarPistas, nombreDeIdioma } from './pistas.js';

const pista = (index, type, extra) => ({ index, type, extra_info: JSON.stringify(extra) });

describe('nombre del idioma', () => {
  it('traduce los códigos que se ven en este catálogo', () => {
    expect(nombreDeIdioma('spa')).toBe('Español');
    expect(nombreDeIdioma('eng')).toBe('Inglés');
  });

  it('un código desconocido se enseña tal cual, no como «Pista 2»', () => {
    expect(nombreDeIdioma('kor')).toBe('KOR');
  });

  it('sin código, algo legible', () => {
    expect(nombreDeIdioma('')).toBe('Desconocido');
    expect(nombreDeIdioma(null)).toBe('Desconocido');
  });
});

describe('normalización de pistas', () => {
  it('usa el título del fichero cuando viene', () => {
    // Zootrópolis 2 las trae así: el proveedor ya decidió cómo llamarlas.
    const { audio } = normalizarPistas([
      pista(0, 'AUDIO', { language: 'spa', title: 'Español Latino' }),
      pista(1, 'AUDIO', { language: 'eng', title: 'Inglés' }),
    ]);
    expect(audio.map((p) => p.etiqueta)).toEqual(['Español Latino', 'Inglés']);
  });

  it('sin título, traduce el idioma', () => {
    const { audio } = normalizarPistas([pista(0, 'AUDIO', { language: 'spa' })]);
    expect(audio[0].etiqueta).toBe('Español');
    expect(audio[0].idioma).toBe('spa');
  });

  it('en subtítulos el idioma se llama track_lang, no language', () => {
    const { subtitulos } = normalizarPistas([
      pista(2, 'TEXT', { track_lang: 'spa', title: 'Español Forzado' }),
    ]);
    expect(subtitulos[0].idioma).toBe('spa');
    expect(subtitulos[0].etiqueta).toBe('Español Forzado');
  });

  it('separa audio de subtítulos y deja fuera el vídeo', () => {
    const { audio, subtitulos } = normalizarPistas([
      pista(0, 'VIDEO', { Width: 1920, Height: 1080 }),
      pista(1, 'AUDIO', { language: 'spa' }),
      pista(2, 'TEXT', { track_lang: 'eng' }),
    ]);
    expect(audio).toHaveLength(1);
    expect(subtitulos).toHaveLength(1);
    // El índice es el de AVPlay, no la posición en la lista: es lo que espera
    // `setSelectTrack`.
    expect(audio[0].indice).toBe(1);
  });

  it('un extra_info roto no tumba la lista entera', () => {
    const { audio } = normalizarPistas([
      { index: 0, type: 'AUDIO', extra_info: 'esto no es json' },
      pista(1, 'AUDIO', { language: 'eng' }),
    ]);
    expect(audio).toHaveLength(2);
    expect(audio[0].etiqueta).toBe('Pista 0');
    expect(audio[1].etiqueta).toBe('Inglés');
  });

  it('sin pistas devuelve listas vacías', () => {
    expect(normalizarPistas([])).toEqual({ audio: [], subtitulos: [] });
    expect(normalizarPistas(null)).toEqual({ audio: [], subtitulos: [] });
  });
});
