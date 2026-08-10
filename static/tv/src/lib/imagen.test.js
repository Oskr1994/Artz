import { describe, it, expect } from 'vitest';
import { urlDeImagen } from './imagen.js';
import { panel } from './xui.js';

describe('URL de carátula', () => {
  it('vuelve absoluta una ruta relativa, contra el panel', () => {
    // Antes el prefijo era el backend propio. Yendo directo, cualquier ruta
    // relativa solo puede referirse al panel.
    expect(urlDeImagen('/img/abc')).toBe(`${panel()}/img/abc`);
  });

  it('respeta la que ya es absoluta, que es lo normal con XUI', () => {
    // `stream_icon` llega siempre absoluta y apuntando al propio panel.
    expect(urlDeImagen('http://digitalsmarther.com:80/images/x.png'))
      .toBe('http://digitalsmarther.com:80/images/x.png');
    expect(urlDeImagen('https://otro/x.png')).toBe('https://otro/x.png');
  });

  it('devuelve null si no hay ruta', () => {
    expect(urlDeImagen(null)).toBe(null);
    expect(urlDeImagen('')).toBe(null);
  });
});
