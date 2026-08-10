import { useState } from 'react';
import Enfocable from './Enfocable.jsx';
import {
  IconoEnVivo, IconoMiLista, IconoPeliculas, IconoSeries, IconoSalir,
} from './Iconos.jsx';

// Misma estructura que la barra lateral de la web (`.lateral` en marca.css):
// marca arriba, navegación, separador, epígrafe de categorías y la lista de
// categorías en vertical. Lo que cambia son las medidas: la web usa 236 px de
// ancho y texto de 15 px, que a tres metros no se lee. Aquí la barra son 420 px
// y nada baja de 26 px.

const ICONOS = {
  envivo: IconoEnVivo,
  peliculas: IconoPeliculas,
  series: IconoSeries,
  milista: IconoMiLista,
};

export default function BarraLateral({
  secciones, seccionActiva, alNavegar,
  // Las categorías las resuelve App, porque dependen de la sección activa: cada
  // catálogo tiene las suyas y los ids se repiten entre ellos. `null` significa
  // que aquí no se pintan, como en Mi lista o dentro de una ficha.
  categorias = null, epigrafe = 'Categorías',
  categoria = null, alCambiarCategoria = () => {},
  usuario = '', alCerrarSesion = null,
}) {
  // Cerrar sesión pide confirmación. Con un mando es fácil pulsar OK de más, y
  // el precio de equivocarse es volver a teclear usuario y contraseña letra a
  // letra con el teclado en pantalla.
  const [confirmando, setConfirmando] = useState(false);

  return (
    <aside className="lateral">
      <div className="lateral__marca">
        <img src="./wordmark.png" alt="FastPlay" className="lateral__logo" />
      </div>

      <nav className="lateral__nav">
        {secciones.map((s) => {
          const Icono = ICONOS[s.id];
          return (
            <Enfocable key={s.id}
              className={`lateral__enlace${s.id === seccionActiva ? ' es-activo' : ''}`}
              alPulsar={() => alNavegar(s.id)}>
              {Icono && <Icono />}
              <span>{s.texto}</span>
            </Enfocable>
          );
        })}
      </nav>

      {categorias && (
        <div className="lateral__categorias">
          <p className="lateral__epigrafe">{epigrafe}</p>
          <Enfocable
            className={`lateral__categoria${categoria == null ? ' es-activa' : ''}`}
            alPulsar={() => alCambiarCategoria(null)}>
            Todas
          </Enfocable>
          {categorias.map((c) => (
            <Enfocable key={c.id}
              className={`lateral__categoria${categoria === c.id ? ' es-activa' : ''}`}
              alPulsar={() => alCambiarCategoria(c.id)}>
              {c.name}
            </Enfocable>
          ))}
        </div>
      )}

      {usuario && (
        <div className="lateral__pie">
          <span className="lateral__avatar" aria-hidden="true">
            {usuario.charAt(0).toUpperCase()}
          </span>
          <span className="lateral__usuario">{usuario}</span>

          {alCerrarSesion && (
            <Enfocable
              className={`lateral__salir${confirmando ? ' es-confirmando' : ''}`}
              alPulsar={() => {
                if (confirmando) alCerrarSesion();
                else setConfirmando(true);
              }}
              // Irse del botón desarma la confirmación. Sin esto quedaría armada
              // para siempre, y el siguiente OK —quizá dentro de un rato y sin
              // querer— cerraría la sesión sin avisar de nada.
              onBlur={() => setConfirmando(false)}
              aria-label={confirmando ? 'Confirmar cerrar sesión' : 'Cerrar sesión'}>
              <IconoSalir tam={28} />
            </Enfocable>
          )}
        </div>
      )}

      {/* El aviso va FUERA del pie: dentro empujaría el avatar y el nombre, y
          la barra daría un salto al enfocar el botón. */}
      {confirmando && (
        <p className="lateral__aviso-salir">Pulsa otra vez para cerrar sesión</p>
      )}
    </aside>
  );
}
