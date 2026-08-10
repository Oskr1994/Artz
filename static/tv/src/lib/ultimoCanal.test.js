import { describe, it, expect, beforeEach } from 'vitest';
import { guardarUltimoCanal, leerUltimoCanal, olvidarUltimoCanal } from './ultimoCanal.js';

beforeEach(() => localStorage.clear());

describe('último canal visto', () => {
  it('guarda solo lo necesario para reanudar', () => {
    // El objeto del catálogo trae icono y guía; nada de eso hace falta para
    // arrancar el vídeo, y guardarlo entero envejece mal.
    guardarUltimoCanal({ id: 7492, name: 'HOY PERU TV', icon: 'http://x/y.png', has_epg: true });
    expect(leerUltimoCanal()).toEqual({ id: 7492, name: 'HOY PERU TV' });
  });

  it('sin nada guardado devuelve null', () => {
    expect(leerUltimoCanal()).toBe(null);
  });

  it('un contenido corrupto no revienta la app entera', () => {
    // Pasa al cambiar de versión o si otro proceso escribe ahí. Arrancar es más
    // importante que reanudar.
    localStorage.setItem('fp_ultimo_canal', 'esto no es json');
    expect(leerUltimoCanal()).toBe(null);
  });

  it('un guardado sin id se descarta', () => {
    localStorage.setItem('fp_ultimo_canal', JSON.stringify({ name: 'SIN ID' }));
    expect(leerUltimoCanal()).toBe(null);
  });

  it('guardar null olvida el anterior', () => {
    guardarUltimoCanal({ id: 1, name: 'A' });
    guardarUltimoCanal(null);
    expect(leerUltimoCanal()).toBe(null);
  });

  it('cerrar sesión lo borra', () => {
    // Si no, el siguiente usuario abre con el canal del anterior.
    guardarUltimoCanal({ id: 1, name: 'A' });
    olvidarUltimoCanal();
    expect(leerUltimoCanal()).toBe(null);
  });

  it('un canal sin nombre se admite: el nombre real llega con el catálogo', () => {
    guardarUltimoCanal({ id: 55 });
    expect(leerUltimoCanal()).toEqual({ id: 55, name: '' });
  });
});
