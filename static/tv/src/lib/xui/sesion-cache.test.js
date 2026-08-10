import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { claveDeSesion, guardarCredenciales, olvidarCredenciales } from './nucleo.js';

// Medido en el televisor: tras cerrar sesión y entrar con otra cuenta, la lista
// seguía mostrando los canales de la cuenta anterior, y no se corregía sola.
// La caché de TanStack Query sobrevive al cierre de sesión y sus claves no
// decían de quién eran los datos, así que `staleTime` los daba por frescos.

beforeEach(() => { localStorage.clear(); olvidarCredenciales(); });
afterEach(() => { localStorage.clear(); olvidarCredenciales(); });

describe('clave de sesión para la caché', () => {
  it('dos proveedores distintos no comparten caché', () => {
    guardarCredenciales('demo', 'demo', null, { base_url: 'https://uno.example' });
    const a = claveDeSesion();
    guardarCredenciales('demo', 'demo', null, { base_url: 'https://dos.example' });
    expect(claveDeSesion()).not.toBe(a);
  });

  it('dos usuarios del MISMO proveedor tampoco', () => {
    // Cambiar de cuenta dentro del mismo panel cambia el catálogo igual.
    guardarCredenciales('uno', 'x', null, { base_url: 'https://p.example' });
    const a = claveDeSesion();
    olvidarCredenciales();
    guardarCredenciales('dos', 'x', null, { base_url: 'https://p.example' });
    expect(claveDeSesion()).not.toBe(a);
  });

  it('la misma sesión da la misma clave, o no se cachearía nada', () => {
    guardarCredenciales('demo', 'demo', null, { base_url: 'https://uno.example' });
    const a = claveDeSesion();
    guardarCredenciales('demo', 'demo', { status: 'Active' }, {
      base_url: 'https://uno.example',
      revalidado_en: Date.now(),
    });
    expect(claveDeSesion()).toBe(a);
  });

  it('sin sesión devuelve algo estable en vez de reventar', () => {
    expect(claveDeSesion()).toBe('sin-sesion');
  });

  it('si el panel se muda al revalidar, la clave cambia', () => {
    // `revalidar` actualiza `base_url` cuando se cambia en /admin. Sin esto, el
    // televisor seguiría sirviendo el catálogo del panel viejo desde la caché.
    guardarCredenciales('demo', 'demo', null, { base_url: 'https://viejo.example' });
    const antes = claveDeSesion();
    const g = JSON.parse(localStorage.getItem('fp_xui'));
    guardarCredenciales(g.usuario, g.clave, g.info, { base_url: 'https://nuevo.example' });
    expect(claveDeSesion()).not.toBe(antes);
  });
});
