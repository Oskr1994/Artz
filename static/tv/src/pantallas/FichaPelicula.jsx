import Enfocable from '../componentes/Enfocable.jsx';
import { usePelicula } from '../api/catalogo.js';
import { urlDePelicula } from '../lib/xui.js';
import { urlDeImagen } from '../lib/imagen.js';
import { formatearDuracion } from '../lib/duracion.js';

export default function FichaPelicula({ id, alReproducir }) {
  const consulta = usePelicula(id);

  if (consulta.isPending) {
    return <div className="ficha"><p className="rejilla__aviso">Cargando la ficha…</p></div>;
  }
  if (consulta.isError) {
    return (
      <div className="ficha">
        <p className="rejilla__aviso">
          No se pudo cargar la ficha. Pulsa ATRÁS para volver.
        </p>
      </div>
    );
  }

  const p = consulta.data;
  const datos = [
    p.year,
    formatearDuracion(p.duracionSegundos),
    p.rating && `★ ${p.rating}`,
    p.genre,
  ].filter(Boolean);

  return (
    <div className="ficha">
      <div className="ficha__cartel">
        {p.icon ? (
          <img className="ficha__imagen" src={urlDeImagen(p.icon)} alt=""
            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
        ) : (
          <span className="ficha__imagen ficha__imagen--vacia">{p.name}</span>
        )}
      </div>

      <div className="ficha__texto">
        <h1 className="ficha__titulo">{p.name}</h1>
        {datos.length > 0 && <p className="ficha__datos">{datos.join('  ·  ')}</p>}
        {p.plot && <p className="ficha__sinopsis">{p.plot}</p>}
        {p.director && <p className="ficha__credito"><strong>Dirección:</strong> {p.director}</p>}
        {p.cast && <p className="ficha__credito"><strong>Reparto:</strong> {p.cast}</p>}

        <Enfocable className="boton-principal" inicial
          alPulsar={() => alReproducir({
            url: urlDePelicula(p.id, p.extension, p.fuenteDirecta),
            titulo: p.name,
            duracionSegundos: p.duracionSegundos,
          })}>
          Reproducir
        </Enfocable>
      </div>
    </div>
  );
}
