import { useState, useEffect } from 'react';
import Rejilla from '../componentes/Rejilla.jsx';
import Buscador from '../componentes/Buscador.jsx';
import { useSeries } from '../api/catalogo.js';

export default function Series({
  categoria = null, busqueda = '', alBuscar, alLimpiarBusqueda, alAbrir,
  tecleando = false, alCambiarTecleando,
}) {
  const [pagina, setPagina] = useState(1);

  useEffect(() => { setPagina(1); }, [categoria, busqueda]);

  // Igual que en Películas: buscando se ignora la categoría y se mira todo el
  // catálogo.
  const series = useSeries({
    category: busqueda ? null : categoria,
    q: busqueda,
  });

  return (
    <Rejilla
      consulta={series}
      pagina={pagina}
      alCambiarPagina={setPagina}
      alPulsar={(s) => alAbrir(s.id)}
      vacio={busqueda
        ? `Ninguna serie coincide con «${busqueda}».`
        : 'No hay series en esta categoría.'}
      cabecera={
        <Buscador consulta={busqueda} alBuscar={alBuscar} alLimpiar={alLimpiarBusqueda}
          abierto={tecleando} alCambiarAbierto={alCambiarTecleando}
          marcador="Buscar una serie" />
      }
      mapear={(s) => ({
        clave: s.id,
        titulo: s.name,
        imagen: s.icon,
        meta: [s.year, s.rating && `★ ${s.rating}`].filter(Boolean).join('  ·  '),
      })}
    />
  );
}
