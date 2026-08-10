import Enfocable from './Enfocable.jsx';

// Un teclado propio, no el nativo del televisor. El nativo se abre en una capa
// del sistema que tapa la aplicación entera y devuelve el foco de forma
// distinta según el modelo. Con teclas enfocables el comportamiento es idéntico
// en todos los televisores y, sobre todo, se puede probar en Chromium.
const FILAS = [
  '1234567890'.split(''),
  'qwertyuiop'.split(''),
  'asdfghjkl'.split(''),
  'zxcvbnm.-_'.split(''),
];

export default function Teclado({
  alEscribir, alBorrar, alAceptar, textoAceptar = 'Aceptar',
  // Reclama el foco para la primera tecla si no lo tiene nadie. Lo necesita el
  // buscador, que aparece SUSTITUYENDO al elemento que estaba enfocado: al
  // desmontarse este se desregistra, y sin esto la pantalla se quedaba sin nada
  // enfocado y el mando dejaba de responder. En el acceso no hace falta, porque
  // allí el foco inicial se lo lleva el campo de usuario.
  inicial = false,
}) {
  return (
    <div className="teclado">
      {FILAS.map((fila, i) => (
        <div className="teclado__fila" key={i}>
          {fila.map((tecla, j) => (
            <Enfocable key={tecla} className="teclado__tecla"
              inicial={inicial && i === 0 && j === 0}
              alPulsar={() => alEscribir(tecla)}>
              {tecla}
            </Enfocable>
          ))}
        </div>
      ))}
      <div className="teclado__fila">
        <Enfocable className="teclado__tecla teclado__tecla--ancha" alPulsar={alBorrar}>
          Borrar
        </Enfocable>
        <Enfocable className="teclado__tecla teclado__tecla--ancha teclado__tecla--principal"
          alPulsar={alAceptar}>
          {textoAceptar}
        </Enfocable>
      </div>
    </div>
  );
}
