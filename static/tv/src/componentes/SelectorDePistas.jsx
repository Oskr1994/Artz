import { useEffect, useRef } from 'react';
import Enfocable from './Enfocable.jsx';
import { enfocar } from '../lib/foco.js';

/**
 * Elegir pista de audio y de subtítulos.
 *
 * Se abre encima del vídeo. Usa el foco por geometría de siempre, así que no
 * hay que enseñarle nada nuevo al mando: flechas para moverse, OK para elegir,
 * ATRÁS para cerrar.
 */
export default function SelectorDePistas({
  audio = [], subtitulos = [], audioActivo = null, subtituloActivo = null,
  alElegirAudio, alElegirSubtitulo, alCerrar, error = null,
}) {
  const marca = (activa) => (activa ? '●' : '○');
  const caja = useRef(null);

  // El menú SE LLEVA el foco al abrirse, no lo pide con `inicial`.
  //
  // `inicial` solo actúa si no hay nada enfocado, y en directo se llega aquí
  // pulsando un botón que sigue montado detrás: el foco se quedaba en él y las
  // flechas navegaban el panel escondido bajo el menú.
  useEffect(() => {
    const primera = caja.current?.querySelector('.enfocable');
    if (primera) enfocar(primera);
  }, []);

  // El `data-capa` de abajo no es decorativo: mientras esto esté abierto, el
  // mando no navega por lo que hay detrás. Sin él, las opciones se pintan sobre
  // la lista de canales y un canal queda MÁS CERCA que la opción de abajo, así
  // que bajar de «Pista 1» enfocaba un canal y OK cambiaba de canal. Medido en
  // el televisor; ver `lib/foco.js`.
  return (
    <div className="pistas" data-capa ref={caja}>
      <h2 className="pistas__titulo">Audio y subtítulos</h2>

      {error && <p className="pistas__aviso" role="alert">{error}</p>}

      <p className="pistas__grupo">Audio</p>

      {!error && audio.length === 0 && (
        <p className="pistas__aviso">Este contenido no declara pistas de audio.</p>
      )}

      {/* Con una sola pista se enseña igual y se dice por qué: un menú que
          parece roto es peor que uno que explica que no hay nada que elegir. */}
      {audio.length === 1 && (
        <p className="pistas__aviso">Solo hay una pista de audio.</p>
      )}

      {audio.map((p, i) => (
        <Enfocable key={`a${p.indice}`} inicial={i === 0}
          className={`pistas__opcion${p.indice === audioActivo ? ' es-activa' : ''}`}
          alPulsar={() => alElegirAudio(p)}>
          <span className="pistas__marca" aria-hidden="true">
            {marca(p.indice === audioActivo)}
          </span>
          <span className="pistas__nombre">{p.etiqueta}</span>
        </Enfocable>
      ))}

      {subtitulos.length > 0 && (
        <>
          <p className="pistas__grupo">Subtítulos</p>

          <Enfocable
            className={`pistas__opcion${subtituloActivo == null ? ' es-activa' : ''}`}
            alPulsar={() => alElegirSubtitulo(null)}>
            <span className="pistas__marca" aria-hidden="true">
              {marca(subtituloActivo == null)}
            </span>
            <span className="pistas__nombre">Ninguno</span>
          </Enfocable>

          {subtitulos.map((p) => (
            <Enfocable key={`s${p.indice}`}
              className={`pistas__opcion${p.indice === subtituloActivo ? ' es-activa' : ''}`}
              alPulsar={() => alElegirSubtitulo(p)}>
              <span className="pistas__marca" aria-hidden="true">
                {marca(p.indice === subtituloActivo)}
              </span>
              <span className="pistas__nombre">{p.etiqueta}</span>
            </Enfocable>
          ))}
        </>
      )}

      {/* Siempre hay algo enfocable, incluso cuando el contenido no declara
          ninguna pista —pasa con los canales caídos—. Sin esto el menú se abría
          vacío, el mando no tenía a dónde ir y solo salías si sabías que ATRÁS
          funciona. */}
      <Enfocable className="pistas__cerrar" alPulsar={alCerrar}>
        Cerrar
      </Enfocable>

      <p className="pistas__ayuda">También puedes pulsar ATRÁS</p>
    </div>
  );
}
