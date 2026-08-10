import { describe, it, expect, beforeEach } from 'vitest';
import { registrar, mover, enfocar, enfocado, limpiar } from './foco.js';

/** Un div con posición fija: jsdom no calcula layout, así que se le dicta. */
function caja(x, y, ancho = 100, alto = 50) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({
    left: x, top: y, right: x + ancho, bottom: y + alto,
    width: ancho, height: alto, x, y,
  });
  el.scrollIntoView = () => {};
  document.body.appendChild(el);
  registrar(el);
  return el;
}

/** Igual, pero dentro de un contenedor concreto en vez de en `body`. */
function cajaEn(padre, x, y, ancho = 100, alto = 50) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({
    left: x, top: y, right: x + ancho, bottom: y + alto,
    width: ancho, height: alto, x, y,
  });
  el.scrollIntoView = () => {};
  padre.appendChild(el);
  registrar(el);
  return el;
}

/** Una capa modal, como el menú de pistas o el teclado del buscador. */
function capa() {
  const el = document.createElement('div');
  el.setAttribute('data-capa', '');
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  limpiar();
  document.body.innerHTML = '';
});

describe('foco por geometría', () => {
  it('se mueve al vecino de la derecha', () => {
    const a = caja(0, 0);
    const b = caja(200, 0);
    enfocar(a);
    expect(mover('derecha')).toBe(true);
    expect(enfocado()).toBe(b);
  });

  it('elige el más cercano, no el primero del DOM', () => {
    const a = caja(0, 0);
    caja(900, 0); // se registra antes, pero está más lejos
    const cerca = caja(200, 0);
    enfocar(a);
    mover('derecha');
    expect(enfocado()).toBe(cerca);
  });

  it('no se mueve si no hay nada en esa dirección', () => {
    const a = caja(0, 0);
    enfocar(a);
    expect(mover('izquierda')).toBe(false);
    expect(enfocado()).toBe(a);
  });
});

// Medido en el televisor con el menú de pistas abierto sobre AXN HD: las
// opciones se pintan ENCIMA de la lista de canales, y un canal quedaba más
// cerca que la opción de abajo. Bajar de «Pista 1» enfocaba FAMILIA TV, y OK
// cambiaba de canal en vez de elegir la pista.
//
//   Pista 1     y 153-234
//   Pista 2     y 240-317
//   FAMILIA TV  y 221-309   <- detras, y mas cerca
describe('capas: lo de detrás no se navega', () => {
  it('con una capa abierta, solo se mueve por lo que hay dentro', () => {
    const detras = caja(1325, 221, 473, 88); // el canal de debajo
    const modal = capa();
    const arriba = cajaEn(modal, 1323, 153, 574, 81);
    const abajo = cajaEn(modal, 1337, 240, 547, 77);

    enfocar(arriba);
    expect(mover('abajo')).toBe(true);
    expect(enfocado()).toBe(abajo);
    expect(enfocado()).not.toBe(detras);
  });

  it('sin capa abierta se navega todo, como siempre', () => {
    const a = caja(0, 0);
    const b = caja(0, 200);
    enfocar(a);
    mover('abajo');
    expect(enfocado()).toBe(b);
  });

  it('al cerrarse la capa se vuelve a poder navegar por detrás', () => {
    const detras = caja(0, 200);
    const modal = capa();
    const dentro = cajaEn(modal, 0, 0);
    enfocar(dentro);
    expect(mover('abajo')).toBe(false);

    modal.remove();
    expect(mover('abajo')).toBe(true);
    expect(enfocado()).toBe(detras);
  });

  it('recuperar el foco también respeta la capa', () => {
    caja(0, 0); // arriba del todo, pero por detrás
    const modal = capa();
    const dentro = cajaEn(modal, 900, 500);
    expect(mover('abajo')).toBe(true);
    expect(enfocado()).toBe(dentro);
  });
});

// En el televisor se llegó a este estado de verdad: el registro con `actual` a
// nulo mientras `document.activeElement` seguía apuntando a la barra lateral.
// Con `mover()` devolviendo `false` sin más, el mando se quedaba MUERTO y no
// había forma de recuperarlo: en un televisor no hay ratón ni tabulador.
describe('recuperación cuando se pierde el foco', () => {
  it('la primera pulsación devuelve el foco en vez de no hacer nada', () => {
    caja(600, 400);
    const arribaIzquierda = caja(100, 80);
    caja(900, 700);
    // Nadie ha llamado a `enfocar`: es el hueco entre desmontar y montar.
    expect(enfocado()).toBe(null);
    expect(mover('abajo')).toBe(true);
    expect(enfocado()).toBe(arribaIzquierda);
  });

  it('sirve cualquier dirección, no solo una', () => {
    const unico = caja(50, 50);
    expect(mover('izquierda')).toBe(true);
    expect(enfocado()).toBe(unico);
  });

  it('no elige un elemento oculto, que no se puede ver ni pulsar', () => {
    // Una tarjeta de una página que ya no se pinta conserva su registro un
    // instante; enfocarla dejaría el foco en un sitio invisible.
    const oculto = caja(0, 0, 0, 0);
    const visible = caja(400, 200);
    expect(mover('abajo')).toBe(true);
    expect(enfocado()).toBe(visible);
    expect(enfocado()).not.toBe(oculto);
  });

  it('sin nada registrado no revienta', () => {
    expect(mover('abajo')).toBe(false);
    expect(enfocado()).toBe(null);
  });

  it('baja a la fila de abajo aunque esté desplazada', () => {
    const arriba = caja(0, 0);
    const abajo = caja(30, 200);
    enfocar(arriba);
    expect(mover('abajo')).toBe(true);
    expect(enfocado()).toBe(abajo);
  });

  it('prefiere el de justo debajo antes que uno cercano pero desviado', () => {
    const origen = caja(0, 0);
    caja(300, 60); // más cerca en línea recta, pero tres columnas a la derecha
    const debajo = caja(0, 200);
    enfocar(origen);
    mover('abajo');
    expect(enfocado()).toBe(debajo);
  });

  it('al quitar el registro deja de ser alcanzable', () => {
    const a = caja(0, 0);
    const b = document.createElement('div');
    b.getBoundingClientRect = () => ({
      left: 200, top: 0, right: 300, bottom: 50, width: 100, height: 50, x: 200, y: 0,
    });
    const quitar = registrar(b);
    quitar();
    enfocar(a);
    expect(mover('derecha')).toBe(false);
  });

  // Con una CLASE no valía: React reescribe `className` a partir de sus props
  // cada vez que repinta el elemento, y se llevaba la marca por delante. Pasaba
  // al elegir un canal, que en el mismo render pasa a `es-activo`: el foco
  // seguía ahí y el mando funcionaba, pero no se veía dónde estaba.
  it('marca con un atributo, no con una clase, y lo quita del anterior', () => {
    const a = caja(0, 0);
    const b = caja(200, 0);
    enfocar(a);
    expect(a.hasAttribute('data-enfocado')).toBe(true);

    // Un repintado de React: reescribe className entero, como hace de verdad.
    a.className = 'enfocable canal es-activo';
    expect(a.hasAttribute('data-enfocado')).toBe(true);

    enfocar(b);
    expect(a.hasAttribute('data-enfocado')).toBe(false);
    expect(b.hasAttribute('data-enfocado')).toBe(true);
  });

  it('una dirección inventada no hace nada', () => {
    const a = caja(0, 0);
    caja(200, 0);
    enfocar(a);
    expect(mover('diagonal')).toBe(false);
    expect(enfocado()).toBe(a);
  });
});

// Geometría real medida en el televisor: teclas de 74x68, paso horizontal 84,
// filas cada 78. La fila `asdfghjkl` tiene 9 teclas y va centrada, así que
// arranca 42 px a la derecha de las de 10.
function teclado() {
  const fila = (n, y, x0) =>
    Array.from({ length: n }, (_, i) => caja(x0 + i * 84, y, 74, 68));
  return {
    numeros: fila(10, 0, 0),
    qwerty: fila(10, 78, 0),
    asdf: fila(9, 156, 42),
    zxcv: fila(10, 234, 0),
  };
}

describe('teclado en pantalla: la fila corta no se salta', () => {
  it('bajando desde qwerty se cae en asdfghjkl, no en zxcvbnm', () => {
    const t = teclado();
    enfocar(t.qwerty[0]); // la tecla `q`
    expect(mover('abajo')).toBe(true);
    // Antes ganaba `z`: 136 + 0 salía más barato que 68 + 37*3 = 179.
    expect(t.asdf).toContain(enfocado());
    expect(t.zxcv).not.toContain(enfocado());
  });

  it('subiendo desde zxcvbnm se cae en asdfghjkl', () => {
    const t = teclado();
    enfocar(t.zxcv[2]);
    expect(mover('arriba')).toBe(true);
    expect(t.asdf).toContain(enfocado());
    expect(t.qwerty).not.toContain(enfocado());
  });

  it('moverse en horizontal sigue quedándose en su fila', () => {
    // Es lo que se rompería al bajar PESO_DESVIACION para arreglar lo de
    // arriba: desde `a`, DERECHA se iría a `w` (coste 71) antes que a `s` (74).
    const t = teclado();
    enfocar(t.asdf[0]);
    expect(mover('derecha')).toBe(true);
    expect(enfocado()).toBe(t.asdf[1]);
  });

  it('se recorre la fila corta entera sin escaparse', () => {
    const t = teclado();
    enfocar(t.asdf[0]);
    for (let i = 1; i < t.asdf.length; i++) {
      mover('derecha');
      expect(enfocado()).toBe(t.asdf[i]);
    }
  });
});
