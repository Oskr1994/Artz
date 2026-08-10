import { useCanales } from '../api/directo.js';
import { useFavoritos, useAlternarFavorito } from '../api/favoritos.js';
import Enfocable from './Enfocable.jsx';
import Buscador from './Buscador.jsx';
import { IconoEstrella, IconoPistas } from './Iconos.jsx';
import { urlDeImagen } from '../lib/imagen.js';

// Cuántos marcadores de posición se pintan mientras llega la lista. Doce llenan
// la altura visible del panel a 1080p: menos dejaría un hueco vacío que parece
// un error, y más obligaría a desplazar sobre contenido que aún no existe.
const MARCADORES = 12;

function MarcadorCanal() {
  // Un marcador de posición, no un texto de "cargando": conserva la altura de
  // fila para que la lista no dé un salto al llegar los datos y el foco no se
  // mueva bajo el dedo del usuario.
  return (
    <div className="canal canal--marcador" aria-hidden="true">
      <div className="canal__logo canal__logo--marcador" />
      <div className="canal__nombre canal__nombre--marcador" />
    </div>
  );
}

// Las categorías ya NO están aquí: viven en la barra lateral, como en la web. El
// buscador sí, porque es el buscador DE ESTA sección.
export default function PanelCanales({
  categoria, canalActivo, alElegir,
  busqueda = '', alBuscar, alLimpiarBusqueda,
  tecleando = false, alCambiarTecleando,
  // En directo la interfaz está a la vista, así que el selector de pistas se
  // abre con un botón normal. En pantalla completa se abre con ARRIBA, porque
  // allí no hay nada visible que enfocar.
  alAbrirPistas = null,
}) {
  const canales = useCanales({ category: categoria, q: busqueda });
  const favoritos = useFavoritos();
  const alternar = useAlternarFavorito();
  const elementos = canales.data?.items ?? [];

  const guardados = new Set((favoritos.data ?? []).map((f) => String(f.item_id)));

  return (
    <aside className="panel">
      <Buscador consulta={busqueda} alBuscar={alBuscar} alLimpiar={alLimpiarBusqueda}
        abierto={tecleando} alCambiarAbierto={alCambiarTecleando}
        marcador="Buscar un canal" />

      {/* Con el teclado abierto no se pinta: sería un objetivo enfocable
          escondido detrás de las teclas. */}
      {alAbrirPistas && !tecleando && (
        <Enfocable className="panel__pistas" alPulsar={alAbrirPistas}>
          <IconoPistas tam={28} />
          <span>Audio y subtítulos</span>
        </Enfocable>
      )}

      <div className="panel__canales">
        {canales.isPending &&
          Array.from({ length: MARCADORES }, (_, i) => <MarcadorCanal key={i} />)}

        {canales.isError && (
          <p className="panel__aviso">
            No se pudieron cargar los canales. Comprueba la conexión del televisor.
          </p>
        )}

        {canales.isSuccess && elementos.length === 0 && (
          <p className="panel__aviso">
            {busqueda
              ? `Ningún canal coincide con «${busqueda}».`
              : 'No hay canales en esta categoría.'}
          </p>
        )}

        {elementos.map((canal, i) => {
          const esFavorito = guardados.has(String(canal.id));
          return (
            // Fila = canal + estrella, como en la web: dos objetivos separados.
            // Con un mando eso significa que la estrella es un elemento
            // navegable más, al que se llega con DERECHA desde el canal.
            <div className="fila-canal" key={canal.id}>
              <Enfocable inicial={i === 0}
                className={`canal${canalActivo === canal.id ? ' es-activo' : ''}`}
                alPulsar={() => alElegir(canal)}>
                {canal.icon ? (
                  <img className="canal__logo" src={urlDeImagen(canal.icon)} alt=""
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                ) : (
                  // Marcador de posición para el canal sin logotipo: sin él, el
                  // nombre se desplazaría a la izquierda y la lista quedaría
                  // desalineada. Muchos canales del panel no traen icono.
                  <span className="canal__logo canal__logo--inicial" aria-hidden="true">
                    {canal.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="canal__nombre">{canal.name}</span>
                {canal.has_epg && <span className="canal__guia">Guía</span>}
              </Enfocable>

              <Enfocable
                className={`canal__favorito${esFavorito ? ' es-guardado' : ''}`}
                alPulsar={() => alternar.mutate({ itemId: canal.id, activo: esFavorito })}
                aria-label={esFavorito
                  ? `Quitar ${canal.name} de Mi lista`
                  : `Añadir ${canal.name} a Mi lista`}>
                <IconoEstrella relleno={esFavorito} />
              </Enfocable>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
