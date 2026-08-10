import { useState, useRef, useEffect } from 'react';
import Enfocable from './Enfocable.jsx';
import Teclado from './Teclado.jsx';
import { IconoBuscar } from './Iconos.jsx';

/**
 * Buscador interno de una sección.
 *
 * Cada catálogo lleva el suyo: En vivo, Películas y Series. No hay una sección
 * Buscar aparte, porque buscar «Netflix» tenía sentidos distintos según dónde
 * estuvieras y obligaba a salir y volver para cambiar de catálogo.
 *
 * Se busca al Aceptar, NO en cada tecla: con un mando cada letra son varias
 * pulsaciones, y buscar en todas dispararía peticiones inútiles a un panel que
 * admite una sola conexión simultánea.
 *
 * `abierto` viene de FUERA a propósito. Cuando este componente se lo guardaba
 * para sí, el manejador de ATRÁS de `App` no podía saber que había un teclado
 * abierto: ATRÁS no lo cerraba, caía hasta ocultar la interfaz y dejaba el
 * teclado debajo. Cualquier tecla la devolvía con el teclado otra vez, y dos
 * ATRÁS seguidos cerraban la aplicación. Se sentía como que se había colgado.
 */
export default function Buscador({
  consulta = '', alBuscar, alLimpiar, marcador = 'Buscar',
  abierto = false, alCambiarAbierto = () => {},
}) {
  const [texto, setTexto] = useState('');

  // Abrir y cerrar el teclado SUSTITUYE al elemento enfocado, que al
  // desmontarse se desregistra y deja la pantalla sin foco: el mando se queda
  // muerto y el usuario sin forma de entender por qué. El campo reclama el foco
  // al volver, pero solo si viene del teclado; en el primer montaje no, para no
  // robárselo a la lista de canales.
  const estuvoAbierto = useRef(false);
  const devolverFoco = !abierto && estuvoAbierto.current;
  useEffect(() => { estuvoAbierto.current = abierto; }, [abierto]);

  if (!abierto) {
    return (
      <div className="buscador">
        <Enfocable className="buscador__campo" inicial={devolverFoco}
          alPulsar={() => { setTexto(consulta); alCambiarAbierto(true); }}>
          <IconoBuscar />
          <span className={consulta ? '' : 'buscador__marcador'}>
            {consulta || marcador}
          </span>
        </Enfocable>
        {consulta && (
          <Enfocable className="buscador__limpiar" alPulsar={alLimpiar}>
            Quitar filtro
          </Enfocable>
        )}
      </div>
    );
  }

  // `data-capa`: con el teclado abierto, el mando se queda dentro. Antes se
  // podía salir a la lista o a la rejilla de detrás sin querer, y desde allí no
  // había forma evidente de volver. Ver `lib/foco.js`.
  return (
    <div className="buscador buscador--abierto" data-capa>
      <p className={`buscador__escrito${texto ? '' : ' es-marcador'}`}>
        {texto || marcador}
      </p>
      <Teclado
        inicial
        alEscribir={(t) => setTexto((v) => v + t)}
        alBorrar={() => setTexto((v) => v.slice(0, -1))}
        alAceptar={() => {
          alCambiarAbierto(false);
          alBuscar(texto.trim());
        }}
        textoAceptar="Buscar"
      />
      <p className="buscador__ayuda">Pulsa ATRÁS para cerrar el teclado</p>
    </div>
  );
}
