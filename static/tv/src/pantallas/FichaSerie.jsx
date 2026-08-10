import { useState } from 'react';
import Enfocable from '../componentes/Enfocable.jsx';
import { useSerie } from '../api/catalogo.js';
import { urlDeEpisodio } from '../lib/xui.js';
import { formatearDuracion } from '../lib/duracion.js';

export default function FichaSerie({ id, alReproducir }) {
  const consulta = useSerie(id);
  const [temporada, setTemporada] = useState(null);

  if (consulta.isPending) {
    return (
      <div className="ficha-serie"><p className="rejilla__aviso">Cargando la serie…</p></div>
    );
  }
  if (consulta.isError) {
    return (
      <div className="ficha-serie">
        <p className="rejilla__aviso">
          No se pudo cargar la serie. Pulsa ATRÁS para volver.
        </p>
      </div>
    );
  }

  const s = consulta.data;
  if (s.temporadas.length === 0) {
    return (
      <div className="ficha-serie">
        <h1 className="ficha__titulo">{s.name}</h1>
        <p className="rejilla__aviso">
          El proveedor no ha devuelto episodios para esta serie.
        </p>
      </div>
    );
  }

  // La temporada elegida, o la primera que EXISTA de verdad: el panel no siempre
  // empieza en la 1 ni va sin huecos.
  const actual = temporada ?? s.temporadas[0].numero;
  const episodios = s.episodiosPorTemporada[String(actual)] ?? [];

  return (
    <div className="ficha-serie">
      <h1 className="ficha__titulo">{s.name}</h1>
      {s.plot && <p className="ficha__sinopsis ficha__sinopsis--corta">{s.plot}</p>}

      <div className="ficha-serie__temporadas">
        {s.temporadas.map((t, i) => (
          <Enfocable key={t.numero} inicial={i === 0}
            className={`ficha-temporada${t.numero === actual ? ' es-activa' : ''}`}
            alPulsar={() => setTemporada(t.numero)}>
            {t.nombre}
          </Enfocable>
        ))}
      </div>

      <div className="ficha-serie__episodios">
        {episodios.map((e) => {
          const duracion = formatearDuracion(e.duracionSegundos);
          return (
            <Enfocable key={e.id} className="episodio"
              alPulsar={() => alReproducir({
                url: urlDeEpisodio(e.id, e.extension, e.fuenteDirecta),
                titulo: e.title,
                duracionSegundos: e.duracionSegundos,
              })}>
              <span className="episodio__numero">{e.numero ?? '·'}</span>
              <span className="episodio__titulo">{e.title}</span>
              {duracion && <span className="episodio__duracion">{duracion}</span>}
            </Enfocable>
          );
        })}
      </div>
    </div>
  );
}
