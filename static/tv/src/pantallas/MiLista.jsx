import { useMemo, useState } from 'react';
import { useFavoritos } from '../api/favoritos.js';
import { useCanales } from '../api/directo.js';
import Enfocable from '../componentes/Enfocable.jsx';
import Reproductor from '../componentes/Reproductor.jsx';

export default function MiLista({ alExpirarSesion }) {
  const [canal, setCanal] = useState(null);
  const favoritos = useFavoritos(false);
  // Los favoritos solo guardan el id; el nombre y el logotipo salen de la lista
  // de canales, que TanStack Query ya tiene cacheada de la pantalla anterior.
  // Así esta pantalla no añade ninguna petición al panel.
  const canales = useCanales({});

  const marcados = useMemo(() => {
    const ids = new Set(
      (favoritos.data ?? [])
        .filter((f) => f.kind === 'live')
        .map((f) => String(f.item_id)),
    );
    return (canales.data?.items ?? []).filter((c) => ids.has(String(c.id)));
  }, [favoritos.data, canales.data]);

  const cargando = favoritos.isPending || canales.isPending;

  return (
    <div className="milista">
      <Reproductor streamId={canal?.id ?? null} nombre={canal?.name ?? ''}
        alExpirarSesion={alExpirarSesion} />

      <aside className="panel">
        <p className="panel__epigrafe">Mi lista</p>
        <div className="panel__canales">
          {cargando && <p className="panel__aviso">Cargando…</p>}
          {!cargando && marcados.length === 0 && (
            <p className="panel__aviso">
              Todavía no has guardado ningún canal. Puedes hacerlo desde la web.
            </p>
          )}
          {marcados.map((c, i) => (
            <Enfocable key={c.id} inicial={i === 0} className="canal"
              alPulsar={() => setCanal(c)}>
              <span className="canal__nombre">{c.name}</span>
            </Enfocable>
          ))}
        </div>
      </aside>
    </div>
  );
}
