import { useState, useEffect, useRef, useCallback } from 'react';
import { TECLAS, registrarTeclas, salirDeLaApp } from './lib/tizen.js';
import { mover, enfocado, limpiar, enfocar } from './lib/foco.js';
import { accionDeAtras } from './lib/navegacion.js';
import { haySesion, cerrarSesion } from './lib/sesion.js';
import { revalidar, MS_ENTRE_REVALIDACIONES } from './lib/acceso.js';
import BarraLateral from './componentes/BarraLateral.jsx';
import Reproductor from './componentes/Reproductor.jsx';
import SelectorDePistas from './componentes/SelectorDePistas.jsx';
import { credenciales, olvidarCredenciales } from './lib/xui.js';
import { useCategoriasDirecto } from './api/directo.js';
import { useCategoriasPeliculas, useCategoriasSeries } from './api/catalogo.js';
import Acceso from './pantallas/Acceso.jsx';
import EnVivo from './pantallas/EnVivo.jsx';
import Peliculas from './pantallas/Peliculas.jsx';
import Series from './pantallas/Series.jsx';
import FichaPelicula from './pantallas/FichaPelicula.jsx';
import FichaSerie from './pantallas/FichaSerie.jsx';
import MiLista from './pantallas/MiLista.jsx';

const SECCIONES = [
  { id: 'envivo', texto: 'En vivo' },
  { id: 'peliculas', texto: 'Películas' },
  { id: 'series', texto: 'Series' },
  { id: 'milista', texto: 'Mi lista' },
];

// Cuánto dura la ventana para confirmar la salida tras ocultar la interfaz.
const MS_PARA_SALIR = 2000;
// Cuánto salta cada pulsación horizontal durante un vídeo bajo demanda. Diez
// segundos es lo que usan los reproductores de televisor: menos obliga a
// machacar el botón y más se pasa de largo.
const SALTO = 10;

export default function App() {
  const [autenticado, setAutenticado] = useState(haySesion());
  const [seccion, setSeccion] = useState('envivo');
  // Ficha abierta encima de la sección: `{ tipo, id }` o nulo.
  const [detalle, setDetalle] = useState(null);
  // Vídeo bajo demanda en marcha: `{ url, titulo, duracionSegundos }` o nulo.
  const [fuente, setFuente] = useState(null);
  // Una categoría y una búsqueda POR SECCIÓN. Compartirlas haría que al pasar de
  // Películas a Series te llevaras una categoría que allí no existe.
  const [categorias, setCategorias] = useState({});
  const [busquedas, setBusquedas] = useState({});
  // Si el teclado en pantalla del buscador está abierto. Vive AQUÍ y no dentro
  // del `Buscador` porque ATRÁS tiene que poder cerrarlo, y el manejador de
  // teclas está en este componente. Basta un booleano: solo hay un buscador
  // montado a la vez.
  const [tecleando, setTecleando] = useState(false);
  // Menú de audio y subtítulos. Vive aquí por lo mismo que el teclado: ATRÁS
  // tiene que poder cerrarlo, y el manejador de teclas está en este componente.
  const [menuPistas, setMenuPistas] = useState(false);
  // Las pistas se FOTOGRAFÍAN al abrir el menú, y la selección se lleva aquí.
  //
  // Antes se leían del reproductor en cada repintado de App, y las marcas iban
  // un paso por detrás: al elegir, el reproductor y App actualizan su estado en
  // la misma tanda, App se repinta ANTES y leía todavía la selección anterior.
  // La lista tampoco cambia mientras el menú está abierto, así que congelarla
  // no pierde nada.
  const [pistas, setPistas] = useState(null);
  const [seleccion, setSeleccion] = useState({ audio: null, subtitulo: null });
  // Interfaz oculta sobre el vídeo, y ventana abierta para confirmar la salida.
  const [oculta, setOculta] = useState(false);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const temporizador = useRef(null);
  const reproductorRef = useRef(null);

  // Solo se piden las categorías de la sección que se está viendo. Pedir las
  // tres al entrar eran dos peticiones de más contra un panel que admite una
  // conexión simultánea, justo cuando la app está cargando todo lo demás.
  const catDirecto = useCategoriasDirecto(false, seccion === 'envivo');
  const catPeliculas = useCategoriasPeliculas(false, seccion === 'peliculas');
  const catSeries = useCategoriasSeries(false, seccion === 'series');

  useEffect(() => registrarTeclas(), []);
  useEffect(() => () => clearTimeout(temporizador.current), []);

  const navegar = useCallback((destino) => {
    // Aquí NO se llama a `limpiar()`. Cada `Enfocable` se desregistra solo al
    // desmontarse (ver `useFoco`), así que vaciar el registro entero es
    // redundante y además se llevaba por delante la barra lateral, que sigue
    // montada al cambiar de pantalla: se quedaba fuera del registro y no había
    // forma de volver a ella con el mando.
    setDetalle(null);
    setFuente(null);
    // Un teclado abierto no debe sobrevivir a un cambio de sección: quedaría
    // abierto en una pantalla que no lo ha pedido.
    setTecleando(false);
    setMenuPistas(false);
    setSeccion(destino);
  }, []);

  const mostrar = useCallback(() => {
    clearTimeout(temporizador.current);
    temporizador.current = null;
    // Mostrar la interfaz por CUALQUIER vía desarma la ventana de salida. Sin
    // esto, devolverla con una flecha dejaría el gatillo puesto y el siguiente
    // ATRÁS cerraría la app con la lista a la vista.
    setConfirmarSalida(false);
    setOculta(false);
  }, []);

  const ocultar = useCallback(() => {
    setOculta(true);
    setConfirmarSalida(true);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setConfirmarSalida(false);
      temporizador.current = null;
    }, MS_PARA_SALIR);
  }, []);

  const alExpirarSesion = useCallback(() => {
    cerrarSesion();
    // También las del panel. `cerrarSesion` solo borra la marca de sesión y el
    // último canal; sin esto quedarían en el televisor el usuario y la
    // contraseña del proveedor de quien acaba de salir. El CÓDIGO no se toca:
    // vive en su propia clave y se recuerda a propósito, porque salir es
    // cambiar de cuenta, no de proveedor (ver `lib/acceso.js`).
    olvidarCredenciales();
    limpiar();
    setSeccion('envivo');
    setDetalle(null);
    setFuente(null);
    setOculta(false);
    setConfirmarSalida(false);
    setAutenticado(false);
  }, []);

  // Al abrir y cada seis horas. Es el único momento en que esta app vuelve a
  // hablar con nuestro servidor: todo lo demás va directo al panel. Sin el
  // intervalo, un televisor que no se apaga nunca revalidaría una vez por
  // semana, y cortar un código no surtiría efecto en todo ese tiempo.
  useEffect(() => {
    if (!autenticado) return undefined;
    let vivo = true;
    const comprobar = async () => {
      const sigue = await revalidar();
      // `vivo` evita echar a alguien que ya salió por su cuenta mientras la
      // petición estaba en vuelo.
      if (!sigue && vivo) alExpirarSesion();
    };
    comprobar();
    const cada = setInterval(comprobar, MS_ENTRE_REVALIDACIONES);
    return () => {
      vivo = false;
      clearInterval(cada);
    };
  }, [autenticado, alExpirarSesion]);

  const ponerBusqueda = useCallback((clave, texto) => {
    setBusquedas((b) => ({ ...b, [clave]: texto }));
  }, []);

  const alTerminarVideo = useCallback(() => setFuente(null), []);

  // Al CERRAR el menú, el foco vuelve al botón por el que se entró. La opción
  // que estaba enfocada se desmonta y el registro se queda sin nada: la primera
  // flecha lo recuperaba, pero enviándote a la barra lateral, que no es de
  // donde venías. En pantalla completa no hay botón y se deja como está.
  //
  // Solo en la TRANSICIÓN de abierto a cerrado. Sin esa condición esto corría
  // también al arrancar la app y le robaba el foco inicial a la lista de
  // canales, que aún no había llegado.
  const menuEstabaAbierto = useRef(false);
  useEffect(() => {
    if (menuEstabaAbierto.current && !menuPistas) {
      const boton = document.querySelector('.panel__pistas');
      if (boton && !enfocado()) enfocar(boton);
    }
    menuEstabaAbierto.current = menuPistas;
  }, [menuPistas]);

  const abrirMenuPistas = useCallback(() => {
    const leidas = reproductorRef.current
      ? reproductorRef.current.leerPistas()
      : { audio: [], subtitulos: [], audioActivo: null, subtituloActivo: null,
        error: 'No hay nada reproduciéndose.' };
    setPistas(leidas);
    setSeleccion({ audio: leidas.audioActivo, subtitulo: leidas.subtituloActivo });
    setMenuPistas(true);
  }, []);

  const elegirAudio = useCallback((p) => {
    if (!p) return;
    reproductorRef.current?.elegirAudio(p);
    setSeleccion((s) => ({ ...s, audio: p.indice }));
  }, []);

  const elegirSubtitulo = useCallback((p) => {
    reproductorRef.current?.elegirSubtitulo(p);
    setSeleccion((s) => ({ ...s, subtitulo: p ? p.indice : null }));
  }, []);

  // El manejador lee el estado por referencia: se registra una sola vez y no hay
  // que reengancharlo en cada cambio.
  const estado = useRef({});
  estado.current = {
    autenticado, oculta, confirmarSalida, seccion, detalle, fuente, busquedas,
    tecleando, menuPistas,
  };

  useEffect(() => {
    const alPulsar = (e) => {
      const s = estado.current;

      // Con la interfaz oculta cualquier tecla la devuelve y se consume ahí: no
      // navega ni activa nada. La excepción es ATRÁS dentro de la ventana, que
      // es la segunda pulsación con la que se sale.
      if (s.autenticado && s.oculta) {
        if (e.keyCode === TECLAS.ATRAS && s.confirmarSalida) salirDeLaApp();
        else mostrar();
        e.preventDefault();
        return;
      }

      // Durante un vídeo bajo demanda el mando controla el reproductor, no la
      // navegación: OK pausa y las flechas horizontales saltan.
      //
      // Con el MENÚ DE PISTAS abierto no: allí el mando vuelve a la navegación
      // normal, porque si no OK significaría dos cosas —pausar y elegir— según
      // dónde estuviera el foco.
      if (s.fuente && !s.menuPistas) {
        const mandos = reproductorRef.current;
        switch (e.keyCode) {
          case TECLAS.OK:
            if (mandos) mandos.alternarPausa();
            e.preventDefault();
            return;
          case TECLAS.IZQUIERDA:
            if (mandos) mandos.saltar(-SALTO);
            e.preventDefault();
            return;
          case TECLAS.DERECHA:
            if (mandos) mandos.saltar(SALTO);
            e.preventDefault();
            return;
          case TECLAS.ARRIBA:
            // La única tecla libre a pantalla completa, y por eso es la que abre
            // el menú: OK pausa, las horizontales saltan y ATRÁS vuelve.
            abrirMenuPistas();
            e.preventDefault();
            return;
          default:
            break;
        }
      }

      switch (e.keyCode) {
        case TECLAS.IZQUIERDA:
          if (mover('izquierda')) e.preventDefault();
          break;
        case TECLAS.DERECHA:
          if (mover('derecha')) e.preventDefault();
          break;
        case TECLAS.ARRIBA:
          if (mover('arriba')) e.preventDefault();
          break;
        case TECLAS.ABAJO:
          if (mover('abajo')) e.preventDefault();
          break;
        case TECLAS.OK:
          // OK se traduce a un clic sobre lo enfocado. Así `Enfocable` responde
          // igual al mando en el televisor y al ratón durante el desarrollo.
          enfocado()?.click();
          e.preventDefault();
          break;
        case TECLAS.ATRAS: {
          // Sin sesión no hay nada que ocultar: cierra la app como siempre.
          if (!s.autenticado) {
            salirDeLaApp();
            break;
          }
          // El orden vive en `lib/navegacion.js`, con tests. Escrito aquí a
          // mano se olvidó el teclado del buscador, y ATRÁS acababa ocultando
          // la interfaz con el teclado abierto debajo.
          switch (accionDeAtras({
            menuPistas: s.menuPistas,
            tecleando: s.tecleando,
            reproduciendo: Boolean(s.fuente),
            detalle: s.detalle,
            busqueda: s.busquedas[s.seccion],
            seccion: s.seccion,
          })) {
            case 'cerrarMenuPistas': setMenuPistas(false); break;
            case 'cerrarTeclado': setTecleando(false); break;
            case 'cerrarReproductor': setFuente(null); break;
            case 'cerrarDetalle': setDetalle(null); break;
            case 'limpiarBusqueda': ponerBusqueda(s.seccion, ''); break;
            case 'irAEnVivo': navegar('envivo'); break;
            default: ocultar(); break;
          }
          e.preventDefault();
          break;
        }
        default:
          break;
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [mostrar, ocultar, navegar, ponerBusqueda, abrirMenuPistas]);

  if (!autenticado) {
    return (
      <Acceso
        alEntrar={() => {
          limpiar();
          setOculta(false);
          setConfirmarSalida(false);
          setAutenticado(true);
        }}
      />
    );
  }

  const categoria = categorias[seccion] ?? null;
  const busqueda = busquedas[seccion] ?? '';
  const alCambiarCategoria = (id) => setCategorias((c) => ({ ...c, [seccion]: id }));
  const alBuscar = (texto) => ponerBusqueda(seccion, texto);
  const alLimpiarBusqueda = () => ponerBusqueda(seccion, '');

  // Qué categorías pinta la barra lateral, según dónde estés. `null` = ninguna,
  // que es lo que corresponde en Mi lista y dentro de una ficha.
  let listaCategorias = null;
  let epigrafe = 'Categorías';
  if (!detalle && !fuente) {
    if (seccion === 'envivo') {
      listaCategorias = catDirecto.data ?? [];
      epigrafe = 'Canales por categoría';
    } else if (seccion === 'peliculas') {
      listaCategorias = catPeliculas.data ?? [];
      epigrafe = 'Películas por categoría';
    } else if (seccion === 'series') {
      listaCategorias = catSeries.data ?? [];
      epigrafe = 'Series por categoría';
    }
  }

  const comunes = {
    busqueda, alBuscar, alLimpiarBusqueda,
    tecleando, alCambiarTecleando: setTecleando,
  };


  let contenido;
  if (fuente) {
    contenido = (
      <Reproductor ref={reproductorRef} fuente={fuente} nombre={fuente.titulo}
        alExpirarSesion={alExpirarSesion} alTerminar={alTerminarVideo} />
    );
  } else if (detalle && detalle.tipo === 'pelicula') {
    contenido = <FichaPelicula id={detalle.id} alReproducir={setFuente} />;
  } else if (detalle && detalle.tipo === 'serie') {
    contenido = <FichaSerie id={detalle.id} alReproducir={setFuente} />;
  } else if (seccion === 'peliculas') {
    contenido = (
      <Peliculas categoria={categoria} {...comunes}
        alAbrir={(id) => setDetalle({ tipo: 'pelicula', id })} />
    );
  } else if (seccion === 'series') {
    contenido = (
      <Series categoria={categoria} {...comunes}
        alAbrir={(id) => setDetalle({ tipo: 'serie', id })} />
    );
  } else if (seccion === 'milista') {
    contenido = <MiLista alExpirarSesion={alExpirarSesion} />;
  } else {
    contenido = (
      <EnVivo alExpirarSesion={alExpirarSesion} categoria={categoria} {...comunes}
        reproductorRef={reproductorRef}
        alAbrirPistas={abrirMenuPistas} />
    );
  }

  // Reproduciendo bajo demanda no hay interfaz alrededor: el vídeo ocupa la
  // pantalla entera, igual que al ocultar la interfaz en directo.
  const limpia = oculta || Boolean(fuente);

  return (
    <div className={`app${limpia ? ' es-limpia' : ''}`}>
      {/* Barra lateral, como en la web. Las categorías se resuelven AQUÍ y no
          dentro de ella porque dependen de la sección activa. */}
      <BarraLateral
        secciones={SECCIONES}
        seccionActiva={seccion}
        alNavegar={navegar}
        categorias={listaCategorias}
        epigrafe={epigrafe}
        categoria={categoria}
        alCambiarCategoria={alCambiarCategoria}
        usuario={credenciales()?.usuario ?? ''}
        alCerrarSesion={alExpirarSesion}
      />
      <main className="principal">{contenido}</main>

      {menuPistas && pistas && (
        <SelectorDePistas
          audio={pistas.audio}
          subtitulos={pistas.subtitulos}
          audioActivo={seleccion.audio}
          subtituloActivo={seleccion.subtitulo}
          error={pistas.error}
          alElegirAudio={elegirAudio}
          alElegirSubtitulo={elegirSubtitulo}
          alCerrar={() => setMenuPistas(false)}
        />
      )}

      {confirmarSalida && (
        <p className="aviso-salir">Pulsa ATRÁS otra vez para salir</p>
      )}
    </div>
  );
}
