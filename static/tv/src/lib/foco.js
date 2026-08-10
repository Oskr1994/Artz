// Gestor de foco por GEOMETRÍA, no por orden en el DOM.
//
// En una rejilla, pulsar "abajo" tiene que llevar al elemento que está
// visualmente debajo. El orden del DOM da saltos que el usuario no entiende y
// que además cambian al reordenar el JSX sin tocar nada visible.
//
// Se escribe a mano en vez de traer una librería de spatial navigation: son
// unas pocas decenas de líneas, el layout es de filas y rejillas, y el
// comportamiento del foco es justo lo que hay que poder afinar a mano contra
// un televisor real.

const elementos = new Set();
let actual = null;

export function limpiar() {
  elementos.clear();
  actual = null;
}

export function registrar(elemento) {
  elementos.add(elemento);
  return () => {
    elementos.delete(elemento);
    if (actual === elemento) actual = null;
  };
}

export function enfocado() {
  return actual;
}

// Un ATRIBUTO, no una clase. Marcar el foco tocando `classList` desde fuera de
// React funciona hasta que React vuelve a pintar ese mismo elemento: entonces
// reescribe `className` a partir de sus props y se lleva la marca por delante.
// Pasaba al elegir un canal —la fila pasa a `es-activo` en el mismo render— y
// el resultado era un foco invisible: el mando seguía funcionando pero no se
// veía dónde estaba. React no gestiona los atributos que nunca ha renderizado,
// así que este sobrevive a cualquier repintado.
const MARCA = 'data-enfocado';

export function enfocar(elemento) {
  if (!elemento) return;
  if (actual) actual.removeAttribute(MARCA);
  actual = elemento;
  elemento.setAttribute(MARCA, '');
  // `preventScroll`: el desplazamiento lo decide `scrollIntoView` de abajo,
  // con su propio criterio. Dejar que lo haga `focus()` provoca dos saltos.
  elemento.focus?.({ preventScroll: true });
  // Siempre visible: en un televisor no hay barra de scroll que arrastrar ni
  // rueda de ratón. Si el elemento enfocado queda fuera de pantalla, el
  // usuario se queda sin saber dónde está.
  elemento.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/**
 * Los elementos por los que se puede navegar AHORA.
 *
 * Dos filtros, y los dos vienen de fallos medidos en el televisor:
 *
 * 1. **Solo la capa de arriba.** El menú de pistas se pinta encima de la lista
 *    de canales, y sus opciones caían sobre las filas de canal. Bajando de
 *    «Pista 1» el canal de detrás quedaba MÁS CERCA que «Pista 2», así que el
 *    foco se iba a él y OK cambiaba de canal en vez de elegir la pista. Con una
 *    capa abierta, lo de detrás deja de existir para el mando.
 *
 * 2. **Nada sin tamaño.** Lo que no se ve no puede ser destino: enfocar algo
 *    invisible deja al usuario sin saber dónde está.
 */
function navegables() {
  const dentro = [];
  for (const elemento of elementos) {
    const r = elemento.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    dentro.push(elemento);
  }
  // `[data-capa]` lo pone quien se pinta por encima de todo: el menú de pistas
  // y el teclado del buscador.
  const capa = typeof document !== 'undefined'
    ? document.querySelector('[data-capa]')
    : null;
  if (!capa) return dentro;
  return dentro.filter((e) => capa.contains(e));
}

function centro(elemento) {
  const r = elemento.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

// Cuánto penaliza desviarse en el eje perpendicular al movimiento. Solo se usa
// como RESPALDO, cuando ningún candidato solapa (ver `mover`): sirve para
// saltar entre zonas separadas de la pantalla, como de la lista de canales a la
// barra superior, donde no hay ninguna alineación que aprovechar.
const PESO_DESVIACION = 3;

const EJES = {
  izquierda: { eje: 'x', signo: -1 },
  derecha: { eje: 'x', signo: 1 },
  arriba: { eje: 'y', signo: -1 },
  abajo: { eje: 'y', signo: 1 },
};

/** Extremos del elemento en un eje, para medir solape. */
function tramo(elemento, eje) {
  const r = elemento.getBoundingClientRect();
  return eje === 'x' ? [r.left, r.right] : [r.top, r.bottom];
}

/**
 * Mueve el foco al vecino en esa dirección, en dos niveles.
 *
 * Primero manda el SOLAPE en el eje perpendicular: entre los candidatos cuyo
 * rectángulo se cruza con el del actual, gana el de menor avance, es decir la
 * fila o columna contigua de verdad.
 *
 * Puntuar solo con `avance + desvío * PESO` no basta, y el teclado en pantalla
 * lo demuestra: la fila `asdfghjkl` tiene 9 teclas y va centrada, así que queda
 * desplazada media tecla respecto a las de 10. Bajando desde `q`, ir a `a`
 * costaba 68 + 37*3 = 179 y saltarse la fila entera hasta `z` costaba
 * 136 + 0 = 136. Ganaba `z`: la fila del medio era INALCANZABLE en ambos
 * sentidos. Y bajar el peso no arregla nada, rompe lo horizontal: desde `a`,
 * DERECHA se iría a `w` (71) antes que a `s` (74).
 *
 * El coste ponderado se queda como respaldo para cuando nada solapa.
 */
/**
 * Devuelve el foco al elemento visualmente más arriba y a la izquierda.
 *
 * Red de seguridad, no navegación. El registro se queda sin `actual` cada vez
 * que se desmonta lo enfocado, y basta con que en ese hueco no monte nada
 * marcado como `inicial` —una lista vacía, un catálogo que aún carga, una ficha
 * sin botón— para que el mando deje de responder DEL TODO y el usuario no tenga
 * ninguna forma de recuperarlo: no hay ratón ni tabulador en un televisor.
 * Comprobado en el aparato: `document.activeElement` seguía apuntando a la
 * barra lateral mientras el registro ya tenía `actual` a nulo.
 */
function recuperarFoco() {
  let mejor = null;
  let mejorCoste = Infinity;
  for (const candidato of navegables()) {
    const r = candidato.getBoundingClientRect();
    const coste = r.top * 2 + r.left;
    if (coste < mejorCoste) {
      mejorCoste = coste;
      mejor = candidato;
    }
  }
  if (!mejor) return false;
  enfocar(mejor);
  return true;
}

export function mover(direccion) {
  const config = EJES[direccion];
  if (!config) return false;
  // Sin foco, la primera pulsación lo devuelve en vez de no hacer nada.
  if (!actual) return recuperarFoco();

  const origen = centro(actual);
  const perpendicular = config.eje === 'x' ? 'y' : 'x';
  const [desde, hasta] = tramo(actual, perpendicular);

  let solapado = null;
  let avanceSolapado = Infinity;
  let desvioSolapado = Infinity;
  let suelto = null;
  let costeSuelto = Infinity;

  for (const candidato of navegables()) {
    if (candidato === actual) continue;
    const punto = centro(candidato);
    const avance = (punto[config.eje] - origen[config.eje]) * config.signo;
    // Tiene que estar REALMENTE en esa dirección. El margen de 1 px evita que
    // dos elementos alineados al píxel se consideren vecinos el uno del otro
    // y el foco quede rebotando entre ambos.
    if (avance <= 1) continue;

    const desvio = Math.abs(punto[perpendicular] - origen[perpendicular]);
    const [otroDesde, otroHasta] = tramo(candidato, perpendicular);
    const solapa = Math.min(hasta, otroHasta) - Math.max(desde, otroDesde) > 0;

    if (solapa) {
      // Entre los que solapan gana el más próximo; a igualdad de fila (±1 px),
      // el mejor alineado.
      const masCerca = avance < avanceSolapado - 1;
      const mismaFilaYMejorAlineado =
        Math.abs(avance - avanceSolapado) <= 1 && desvio < desvioSolapado;
      if (solapado === null || masCerca || mismaFilaYMejorAlineado) {
        solapado = candidato;
        avanceSolapado = avance;
        desvioSolapado = desvio;
      }
    } else {
      const coste = avance + desvio * PESO_DESVIACION;
      if (coste < costeSuelto) {
        costeSuelto = coste;
        suelto = candidato;
      }
    }
  }

  const mejor = solapado ?? suelto;
  if (!mejor) return false;
  enfocar(mejor);
  return true;
}
