import { useState, useCallback } from 'react';
import { useEpg } from '../api/directo.js';
import { guardarUltimoCanal, leerUltimoCanal } from '../lib/ultimoCanal.js';
import Reproductor from '../componentes/Reproductor.jsx';
import PanelCanales from '../componentes/PanelCanales.jsx';

// `categoria` y `busqueda` llegan desde App: la categoría la pinta la barra
// lateral, que es hermana de esta pantalla, y la búsqueda tiene que poder
// borrarse desde el manejador global de teclas cuando se pulsa ATRÁS.
export default function EnVivo({
  alExpirarSesion, categoria = null,
  busqueda = '', alBuscar, alLimpiarBusqueda,
  tecleando = false, alCambiarTecleando,
  // `reproductorRef` llega de App: es por donde el menú de pistas habla con
  // AVPlay, y App es quien lo pinta.
  alAbrirPistas, reproductorRef,
}) {
  // Se reanuda el último canal visto. Un televisor no es un navegador: quien lo
  // enciende quiere ver algo, no elegir de una lista. Se lee del almacenamiento
  // y no del catálogo, así que el vídeo arranca sin esperar a que llegue.
  const [canal, setCanal] = useState(leerUltimoCanal);

  const elegir = useCallback((elegido) => {
    setCanal(elegido);
    guardarUltimoCanal(elegido);
  }, []);

  const epg = useEpg(canal?.id ?? null);
  const ahora = epg.data?.[0] ?? null;

  return (
    <div className="envivo">
      <Reproductor ref={reproductorRef} streamId={canal?.id ?? null}
        nombre={canal?.name ?? ''} alExpirarSesion={alExpirarSesion} />

      <PanelCanales
        categoria={categoria}
        busqueda={busqueda}
        alBuscar={alBuscar}
        alLimpiarBusqueda={alLimpiarBusqueda}
        tecleando={tecleando}
        alCambiarTecleando={alCambiarTecleando}
        alAbrirPistas={canal ? alAbrirPistas : null}
        canalActivo={canal?.id ?? null}
        alElegir={elegir}
      />

      {canal && (
        <div className="ahora">
          <span className="ahora__epigrafe">Ahora</span>
          <span className="ahora__titulo">
            {/* La mayoría de canales del panel no tiene guía: el marcador de
                posición evita que la franja aparezca y desaparezca al cambiar
                de canal, que a pantalla completa se nota mucho. */}
            {ahora?.title ?? (epg.isPending ? '…' : 'Sin información de programación')}
          </span>
        </div>
      )}
    </div>
  );
}
