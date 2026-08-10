import Tarjeta from './Tarjeta.jsx';
import Enfocable from './Enfocable.jsx';

/**
 * Rejilla de carátulas con paginación en memoria.
 *
 * La comparten Películas y Series porque las dos muestran lo mismo con distintos
 * datos; tenerlo dos veces garantiza que se desincronicen a la primera
 * corrección.
 *
 * La paginación es EN MEMORIA porque el panel no pagina: `get_vod_streams`
 * devuelve la categoría entera de una vez, sin `limit` ni `offset`.
 */

// Diez filas de seis. La categoría más grande —PRIME VIDEO, 561 películas— cabe
// en diez páginas; con 40 por página serían quince. La rejilla se desplaza sola
// al mover el foco (`enfocar()` hace `scrollIntoView`), así que una página más
// alta que la pantalla no es un problema.
export const POR_PAGINA = 60;

export function paginasDe(total, porPagina = POR_PAGINA) {
  // Mínimo 1: con 0 elementos, "página 1 de 0" no significa nada.
  return Math.max(1, Math.ceil(total / Math.max(1, porPagina)));
}

export function recorte(elementos, pagina, porPagina = POR_PAGINA) {
  const desde = (pagina - 1) * porPagina;
  return elementos.slice(desde, desde + porPagina);
}

export default function Rejilla({
  consulta, pagina = 1, alCambiarPagina, alPulsar, mapear,
  vacio = 'No hay nada aquí.', cabecera = null,
}) {
  const todos = consulta.data?.items ?? [];
  const total = consulta.data?.total ?? todos.length;
  const paginas = paginasDe(total);
  const visibles = recorte(todos, pagina);

  return (
    <div className="rejilla">
      {cabecera}

      {consulta.isPending && <p className="rejilla__aviso">Cargando el catálogo…</p>}

      {consulta.isError && (
        <p className="rejilla__aviso">
          No se pudo cargar el catálogo. Comprueba la conexión del televisor.
        </p>
      )}

      {consulta.isSuccess && todos.length === 0 && <p className="rejilla__aviso">{vacio}</p>}

      {visibles.length > 0 && (
        <>
          <p className="rejilla__cuenta">
            {total.toLocaleString('es-ES')} títulos
            {paginas > 1 && ` · página ${pagina} de ${paginas}`}
          </p>

          <div className="rejilla__lienzo">
            {visibles.map((e, i) => {
              const t = mapear(e);
              return (
                <Tarjeta key={t.clave} titulo={t.titulo} imagen={t.imagen} meta={t.meta}
                  inicial={i === 0} alPulsar={() => alPulsar(e)} />
              );
            })}
          </div>

          {paginas > 1 && (
            <div className="rejilla__paginas">
              {/* Se OCULTAN cuando no aplican, en vez de deshabilitarse: un
                  `Enfocable` deshabilitado seguiría registrado en el gestor de
                  foco y el mando se quedaría atascado en él sin que pasara
                  nada. */}
              {pagina > 1 && (
                <Enfocable className="boton-secundario"
                  alPulsar={() => alCambiarPagina(pagina - 1)}>
                  Anterior
                </Enfocable>
              )}
              {pagina < paginas && (
                <Enfocable className="boton-secundario"
                  alPulsar={() => alCambiarPagina(pagina + 1)}>
                  Siguiente
                </Enfocable>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
