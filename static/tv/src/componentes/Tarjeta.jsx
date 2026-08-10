import { useState } from 'react';
import Enfocable from './Enfocable.jsx';
import { urlDeImagen } from '../lib/imagen.js';

/**
 * Una carátula de la rejilla.
 *
 * El marcador de posición no es decorativo: las 2 918 carátulas de película
 * apuntan a un servidor que lleva días caído, así que HOY es lo que se ve en
 * toda la sección. Tiene que quedar presentable, no como un error.
 */
export default function Tarjeta({ titulo, imagen, meta = '', inicial = false, alPulsar }) {
  const [rota, setRota] = useState(false);
  const conImagen = imagen && !rota;

  return (
    <Enfocable className="tarjeta-cartel" inicial={inicial} alPulsar={alPulsar}>
      <div className="tarjeta-cartel__marco">
        {conImagen ? (
          <img className="tarjeta-cartel__imagen" src={urlDeImagen(imagen)} alt=""
            onError={() => setRota(true)} />
        ) : (
          <span className="tarjeta-cartel__vacia">{titulo}</span>
        )}
      </div>
      <p className="tarjeta-cartel__titulo">{titulo}</p>
      {meta && <p className="tarjeta-cartel__meta">{meta}</p>}
    </Enfocable>
  );
}
