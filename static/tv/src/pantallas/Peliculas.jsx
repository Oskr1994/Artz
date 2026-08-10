import { useState, useEffect } from 'react';
import Rejilla from '../componentes/Rejilla.jsx';
import Buscador from '../componentes/Buscador.jsx';
import { usePeliculas } from '../api/catalogo.js';

export default function Peliculas({
  categoria = null, busqueda = '', alBuscar, alLimpiarBusqueda, alAbrir,
  tecleando = false, alCambiarTecleando,
}) {
  const [pagina, setPagina] = useState(1);

  // Cambiar de categoría o de búsqueda tiene que devolver a la primera página;
  // si no, saltas a una página que quizá no existe en el conjunto nuevo y ves
  // una rejilla vacía sin entender por qué.
  useEffect(() => { setPagina(1); }, [categoria, busqueda]);

  // Con una búsqueda activa se busca en TODO el catálogo, no solo en la
  // categoría abierta: quien escribe un título quiere encontrarlo esté donde
  // esté. Es uno de los dos casos que piden la respuesta grande de 2,5 MB.
  const peliculas = usePeliculas({
    category: busqueda ? null : categoria,
    q: busqueda,
  });

  return (
    <Rejilla
      consulta={peliculas}
      pagina={pagina}
      alCambiarPagina={setPagina}
      alPulsar={(p) => alAbrir(p.id)}
      vacio={busqueda
        ? `Ninguna película coincide con «${busqueda}».`
        : 'No hay películas en esta categoría.'}
      cabecera={
        <Buscador consulta={busqueda} alBuscar={alBuscar} alLimpiar={alLimpiarBusqueda}
          abierto={tecleando} alCambiarAbierto={alCambiarTecleando}
          marcador="Buscar una película" />
      }
      mapear={(p) => ({
        clave: p.id,
        titulo: p.name,
        imagen: p.icon,
        meta: [p.year, p.rating && `★ ${p.rating}`].filter(Boolean).join('  ·  '),
      })}
    />
  );
}
