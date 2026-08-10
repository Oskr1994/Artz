import { describe, it, expect } from 'vitest';
import { accionDeAtras } from './navegacion.js';

// El orden de ATRÁS estaba escrito a mano dentro del manejador de teclas, y el
// teclado del buscador no aparecía en él: se guardaba su estado para sí mismo.
// Resultado medido en el televisor: con el teclado abierto, ATRÁS no lo cerraba,
// caía hasta ocultar la interfaz y dejaba el teclado debajo. Cualquier tecla la
// devolvía con el teclado otra vez, y ATRÁS dos veces seguidas CERRABA LA APP.
// Se siente como que la aplicación se ha colgado.

describe('qué hace ATRÁS', () => {
  it('cierra primero el menú de pistas, que está por encima de todo', () => {
    expect(accionDeAtras({ menuPistas: true, reproduciendo: true, seccion: 'peliculas' }))
      .toBe('cerrarMenuPistas');
  });

  it('el menú de pistas gana también al teclado', () => {
    // No pueden estar abiertos a la vez, pero el orden tiene que ser explícito.
    expect(accionDeAtras({ menuPistas: true, tecleando: true, seccion: 'envivo' }))
      .toBe('cerrarMenuPistas');
  });

  it('cierra el teclado numérico antes que nada, salvo el menú de pistas', () => {
    expect(accionDeAtras({ pidiendoCodigo: true, seccion: 'ajustes' }))
      .toBe('cerrarTecladoNumerico');
    expect(accionDeAtras({ pidiendoCodigo: true, tecleando: true, seccion: 'ajustes' }))
      .toBe('cerrarTecladoNumerico');
    expect(accionDeAtras({ menuPistas: true, pidiendoCodigo: true, seccion: 'ajustes' }))
      .toBe('cerrarMenuPistas');
  });

  it('en Ajustes sin nada abierto, vuelve a En vivo', () => {
    expect(accionDeAtras({ seccion: 'ajustes' })).toBe('irAEnVivo');
  });

  it('cierra el teclado antes que lo demás', () => {
    expect(accionDeAtras({ tecleando: true, seccion: 'envivo' })).toBe('cerrarTeclado');
  });

  it('el teclado gana a todo lo demás', () => {
    // Con una búsqueda puesta y dentro de una ficha, sigue mandando el teclado.
    expect(accionDeAtras({
      tecleando: true, detalle: { tipo: 'pelicula', id: 1 },
      busqueda: 'algo', seccion: 'peliculas',
    })).toBe('cerrarTeclado');
  });

  it('reproduciendo, vuelve a la ficha', () => {
    expect(accionDeAtras({ reproduciendo: true, detalle: { tipo: 'pelicula', id: 1 } }))
      .toBe('cerrarReproductor');
  });

  it('en una ficha, vuelve a la rejilla', () => {
    expect(accionDeAtras({ detalle: { tipo: 'serie', id: 9 }, seccion: 'series' }))
      .toBe('cerrarDetalle');
  });

  it('con una búsqueda activa, la borra antes de cambiar de sección', () => {
    expect(accionDeAtras({ busqueda: 'netflix', seccion: 'peliculas' }))
      .toBe('limpiarBusqueda');
  });

  it('en una rejilla sin nada abierto, vuelve a En vivo', () => {
    expect(accionDeAtras({ seccion: 'peliculas' })).toBe('irAEnVivo');
  });

  it('en En vivo, oculta la interfaz', () => {
    expect(accionDeAtras({ seccion: 'envivo' })).toBe('ocultar');
  });

  it('sin estado ninguno no revienta', () => {
    expect(accionDeAtras({})).toBe('ocultar');
    expect(accionDeAtras()).toBe('ocultar');
  });

  it('una búsqueda vacía no cuenta como búsqueda', () => {
    // `busquedas[seccion]` es '' cuando no hay ninguna, no `undefined`.
    expect(accionDeAtras({ busqueda: '', seccion: 'envivo' })).toBe('ocultar');
  });
});
