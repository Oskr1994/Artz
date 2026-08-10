import {
  useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle,
} from 'react';
import mpegts from 'mpegts.js';
import Enfocable from './Enfocable.jsx';
import { hayAvplay } from '../lib/tizen.js';
import { urlDeCanal } from '../lib/ticket.js';
import { MENSAJES } from '../lib/errores.js';
import { reloj } from '../lib/duracion.js';
import { normalizarPistas } from '../lib/pistas.js';
import {
  leerPreferencia, guardarPreferencia, pistaAAplicar,
} from '../lib/preferenciaDePistas.js';

// AVPlay NO pinta dentro del DOM: pinta en un plano de vídeo por debajo de la
// página. Se le da posición con `setDisplayRect` y el HTML tiene que dejar ese
// rectángulo transparente para que se vea. Por eso aquí no hay un <video>
// cuando estamos en el televisor: no habría nada dentro.
//
// El rectángulo NO está escrito a mano: se lee del propio contenedor. Así la
// hoja de estilos es la única fuente de verdad sobre dónde va el vídeo —en la
// columna central, entre la barra lateral y la lista— y al ocultar la interfaz
// el vídeo pasa a pantalla completa sin que haya que sincronizar dos sitios.

// Proporción real del contenido, leída de la pista de vídeo. Un canal SD puede
// ser 4:3, así que no se da por hecho 16:9.
function proporcionDelCanal() {
  try {
    for (const pista of window.webapis.avplay.getCurrentStreamInfo() || []) {
      if (pista.type !== 'VIDEO') continue;
      const extra = JSON.parse(pista.extra_info || '{}');
      const ancho = Number(extra.Width);
      const alto = Number(extra.Height);
      if (ancho > 0 && alto > 0) return ancho / alto;
    }
  } catch {
    // Aún sin preparar: se usa el valor por defecto hasta que haya pista.
  }
  return 16 / 9;
}

/**
 * Coloca el plano de vídeo dentro del contenedor, con su proporción.
 *
 * El rectángulo se calcula AQUÍ en vez de delegar en
 * `PLAYER_DISPLAY_MODE_LETTER_BOX`: en este televisor ese modo no encaja el
 * fotograma dentro del rectángulo que se le da, lo coloca desplazado y más
 * pequeño, y el resultado se salía por debajo de la lista de canales. Dándole un
 * rectángulo que YA tiene la proporción correcta, cualquier modo de escalado
 * produce lo mismo y no hay nada que se pueda torcer.
 */
function colocarVideo(elemento) {
  if (!elemento || !window.webapis?.avplay) return;
  const caja = elemento.getBoundingClientRect();
  if (caja.width < 1 || caja.height < 1) return;

  const proporcion = proporcionDelCanal();
  let ancho = caja.width;
  let alto = caja.height;
  if (ancho / alto > proporcion) ancho = alto * proporcion;
  else alto = ancho / proporcion;

  try {
    window.webapis.avplay.setDisplayRect(
      Math.round(caja.left + (caja.width - ancho) / 2),
      Math.round(caja.top + (caja.height - alto) / 2),
      Math.round(ancho),
      Math.round(alto),
    );
  } catch {
    // Sin nada abierto todavía, `setDisplayRect` puede quejarse. La posición se
    // vuelve a aplicar al preparar el canal.
  }
}

// Constante de módulo, NO `() => {}` en la firma. Un valor por defecto escrito
// en los parámetros crea una función nueva en cada render, y como los avisos se
// leen desde el efecto que abre el vídeo, eso lo reejecutaba sin parar: abrir,
// `stop()` + `close()` en la limpieza, abrir otra vez. El síntoma era un
// "Sintonizando…" eterno con la imagen apareciendo y desapareciendo detrás.
const NADA = () => {};

// El mismo texto para las tres formas en que hoy falla una película: error de
// AVPlay, fallo al preparar y flujo de relleno que se corta solo.
const NO_DISPONIBLE = 'Este contenido no está disponible ahora mismo.';

// Reconexión tras un corte del proveedor. Medido en el televisor: cuando la
// emisión se corta, AVPlay NO da error y `getState()` sigue diciendo PLAYING;
// el único aviso es `onstreamcompleted`, y el reloj se congela.
//
// Tres segundos entre intentos, y hasta diez: cubre medio minuto de corte, que
// es de sobra para los bajones cortos, sin machacar a peticiones un panel que
// admite UNA conexión simultánea.
const ESPERA_ENTRE_RECONEXIONES = 3000;
const MAXIMO_DE_RECONEXIONES = 10;
// Cuánto tiene que aguantar sonando para dar el corte por superado y devolver
// los intentos. Sin esto, un canal que corta cada pocos segundos reiniciaría la
// cuenta en cada reconexión y se quedaría dando vueltas para siempre.
const MS_PARA_DARLO_POR_BUENO = 60_000;
const RECONECTANDO = 'Se ha cortado la emisión. Reconectando…';
const NO_SE_RECUPERA = 'La emisión no se pudo recuperar. Inténtalo de nuevo.';

function Reproductor({
  streamId, nombre, fuente = null,
  alExpirarSesion = NADA, alTerminar = NADA,
}, referencia) {
  const videoRef = useRef(null);
  const cajaRef = useRef(null);
  const jugadorRef = useRef(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  // Incrementarlo reejecuta el efecto entero y vuelve a abrir la fuente.
  const [intento, setIntento] = useState(0);
  const nativo = hayAvplay();

  // Con `fuente` estamos en vídeo bajo demanda: hay duración, se puede pausar y
  // se puede saltar. En directo nada de eso tiene sentido.
  const bajoDemanda = Boolean(fuente);
  const [pausado, setPausado] = useState(false);
  const [posicion, setPosicion] = useState(0);
  const [duracion, setDuracion] = useState(fuente?.duracionSegundos ?? 0);

  // Pistas seleccionadas AHORA, por índice, que es lo que devuelve y espera
  // AVPlay. `null` en subtítulos significa apagados.
  const [audioActivo, setAudioActivo] = useState(null);
  const [subtituloActivo, setSubtituloActivo] = useState(null);

  const url = bajoDemanda ? fuente.url : null;

  // Los avisos se leen desde aquí y NO entran en las dependencias del efecto:
  // reabrir el vídeo porque el padre haya recreado una función es un fallo que
  // no da error, solo deja la imagen parpadeando y el aviso de carga fijo.
  const avisos = useRef({ alExpirarSesion, alTerminar });
  avisos.current = { alExpirarSesion, alTerminar };

  // Los oyentes de AVPlay se registran una sola vez y capturarían un valor de
  // estado congelado. Lo que necesitan leer va por referencia.
  // Queda a la espera de que la reproducción arranque para aplicar la pista
  // guardada: antes de eso AVPlay acepta `setSelectTrack` y lo ignora.
  const preferenciaPendiente = useRef(false);

  // Reconexión tras un corte del proveedor. `reconexion` es solo un contador
  // para reejecutar el efecto; `intentosDeReconexion` lleva la cuenta para
  // rendirse a tiempo, y va en una referencia porque lo lee el oyente de
  // AVPlay, que se registra una sola vez.
  const [reconexion, setReconexion] = useState(0);
  const [reconectando, setReconectando] = useState(false);
  const intentosDeReconexion = useRef(0);
  const ultimoCorte = useRef(0);

  const vistoRef = useRef(0);
  const esperadaRef = useRef(0);
  vistoRef.current = posicion;
  esperadaRef.current = fuente?.duracionSegundos ?? 0;

  // Cambiar de canal o de título empieza de cero: el reintento gastado en el
  // anterior no debe descontarse del siguiente.
  useEffect(() => {
    setIntento(0);
    setPausado(false);
    setPosicion(0);
    setDuracion(fuente?.duracionSegundos ?? 0);
    // Los cortes se cuentan POR CANAL: cambiar de uno a otro empieza de cero,
    // o un canal con mala señal dejaría al siguiente sin intentos.
    intentosDeReconexion.current = 0;
    ultimoCorte.current = 0;
    setReconectando(false);
    // Las pistas son del contenido: al cambiar de canal o de película, lo que
    // hubiera seleccionado ya no significa nada.
    setAudioActivo(null);
    setSubtituloActivo(null);
    // `fuente?.duracionSegundos` y no `fuente`: el objeto se recrea en cada
    // render de App y reiniciaría el reloj sin que hubiera cambiado nada.
  }, [streamId, url, fuente?.duracionSegundos]);

  // Al ocultar la interfaz, el contenedor pasa a ocupar la pantalla entera. El
  // plano de vídeo no se entera solo, así que se vigila el contenedor y se
  // recoloca. Sin esto el vídeo seguiría metido en la columna central con la
  // interfaz ya escondida.
  useEffect(() => {
    if (!nativo || !cajaRef.current) return undefined;
    const observador = new ResizeObserver(() => colocarVideo(cajaRef.current));
    observador.observe(cajaRef.current);
    return () => observador.disconnect();
  }, [nativo]);

  useEffect(() => {
    if (streamId == null && !bajoDemanda) return undefined;
    setError(null);
    setCargando(true);
    let cancelado = false;

    // Un solo reintento silencioso. Reintentar en bucle ante algo que de verdad
    // no existe dejaría al usuario mirando un "Reintentando…" eterno sin
    // ninguna pista de lo que pasa.
    const reintentarUnaVez = () => {
      if (cancelado || intento >= 1) return false;
      setIntento((n) => n + 1);
      return true;
    };

    const fallar = (mensaje) => {
      if (cancelado) return;
      setCargando(false);
      if (!reintentarUnaVez()) setError(mensaje);
    };

    // El nodo que aloja las películas está caído: hoy esto es lo que verá el
    // usuario al pulsar Reproducir, y es el mensaje correcto. La documentación
    // avisa de que estar en el catálogo no implica ser reproducible.
    const mensajeDeFallo = bajoDemanda
      ? NO_DISPONIBLE
      : 'No se pudo reproducir este canal.';

    /**
     * Pone la pista que el usuario eligió la última vez.
     *
     * Se llama cuando la reproducción YA ha arrancado, no al preparar: ahí
     * AVPlay acepta la orden y no hace nada. Solo actúa una vez por contenido.
     */
    const aplicarPreferencia = () => {
      if (cancelado || !preferenciaPendiente.current) return;
      preferenciaPendiente.current = false;
      const av = window.webapis.avplay;
      try {
        const { audio, subtitulos } = normalizarPistas(av.getTotalTrackInfo());
        const guardada = leerPreferencia();

        const quieroAudio = pistaAAplicar(audio, guardada.audio);
        if (quieroAudio) {
          av.setSelectTrack('AUDIO', quieroAudio.indice);
          setAudioActivo(quieroAudio.indice);
        }

        const quieroSub = pistaAAplicar(subtitulos, guardada.subtitulo);
        if (quieroSub) {
          av.setSelectTrack('TEXT', quieroSub.indice);
          av.setSilentSubtitle(false);
          setSubtituloActivo(quieroSub.indice);
        }
      } catch (e) {
        // Que no se pueda elegir pista no puede impedir ver el vídeo.
        console.error('AVPlay pistas:', e);
      }
    };

    (async () => {
      let destino;
      if (bajoDemanda) {
        destino = url;
      } else {
        try {
          destino = await urlDeCanal(streamId);
        } catch (e) {
          if (cancelado) return;
          // Un 401 al construir la URL significa que la sesión murió (caducó, o
          // se cerró desde otro sitio). Reintentar no la resucita: hay que
          // volver a la pantalla de Acceso.
          if (e?.codigo === 401) {
            avisos.current.alExpirarSesion();
            return;
          }
          fallar('No se pudo preparar el canal.');
          return;
        }
      }
      if (cancelado) return;

      if (nativo) {
        const av = window.webapis.avplay;
        try {
          av.open(destino);
          // El vídeo llena el rectángulo que se le dé. Como `colocarVideo` ya se
          // lo pasa con la proporción del contenido, llenarlo es justo lo que se
          // quiere y no deforma nada.
          try {
            av.setDisplayMethod('PLAYER_DISPLAY_MODE_FULL_SCREEN');
          } catch (e) {
            console.error('AVPlay setDisplayMethod:', e);
          }
          colocarVideo(cajaRef.current);
          av.setListener({
            onerror: (tipo) => {
              // El código crudo solo al log: a tres metros nadie lee
              // "PLAYER_ERROR_INVALID_OPERATION".
              console.error('AVPlay:', tipo);
              fallar(mensajeDeFallo);
            },
            oncurrentplaytime: (ms) => {
              if (cancelado) return;
              // Que el reloj avance es la prueba de que la reproducción ha
              // arrancado de verdad, que es lo que `setSelectTrack` necesita.
              aplicarPreferencia();
              // Los intentos se devuelven cuando el canal lleva un rato yendo
              // bien, no en cuanto da señales de vida. Reiniciar en el primer
              // tic dejaría dando vueltas para siempre a un canal que corta
              // cada pocos segundos; exigir un minuto limpio distingue
              // «se recuperó» de «va a trompicones».
              if (ultimoCorte.current
                  && Date.now() - ultimoCorte.current > MS_PARA_DARLO_POR_BUENO) {
                intentosDeReconexion.current = 0;
                ultimoCorte.current = 0;
              }
              if (bajoDemanda) setPosicion(Math.round(Number(ms) / 1000));
            },
            onstreamcompleted: () => {
              if (cancelado) return;

              // En DIRECTO esto no significa que se haya acabado nada: es como
              // AVPlay cuenta que el proveedor ha dejado de mandar. Medido en
              // el televisor cortándole la emisión: `onerror` no salta,
              // `getState()` sigue diciendo PLAYING y el reloj se congela.
              // Antes se caía en el `alTerminar` de abajo, que en directo no
              // está puesto, y el canal se quedaba congelado para siempre.
              if (!bajoDemanda) {
                if (intentosDeReconexion.current >= MAXIMO_DE_RECONEXIONES) {
                  setReconectando(false);
                  setError(NO_SE_RECUPERA);
                  return;
                }
                intentosDeReconexion.current += 1;
                ultimoCorte.current = Date.now();
                setReconectando(true);
                // Con espera: el proveedor tarda unos segundos en volver, y
                // reabrir al instante solo gasta la única conexión que da la
                // línea.
                setTimeout(() => {
                  if (!cancelado) setReconexion((n) => n + 1);
                }, ESPERA_ENTRE_RECONEXIONES);
                return;
              }

              // Con el nodo de contenido caído, el panel NO da error: acepta la
              // petición y sirve un flujo de relleno que se acaba en segundos.
              // Sin esto, el usuario pulsa Reproducir, ve unos segundos de algo
              // que no es su película y vuelve a la ficha sin explicación.
              //
              // La señal es la propia ficha: si anuncia 1 h 46 min y termina
              // antes de la mitad, no era la película. Cuando el nodo vuelva,
              // una película completa nunca cumplirá la condición, y saltarse
              // el final a mano tampoco, porque entonces la posición sí llega.
              const esperada = esperadaRef.current;
              if (esperada > 60 && vistoRef.current < esperada / 2) {
                setError(NO_DISPONIBLE);
                return;
              }
              avisos.current.alTerminar();
            },
          });
          av.prepareAsync(
            () => {
              if (cancelado) return;
              setCargando(false);
              // Ahora SÍ hay pista de vídeo: se recoloca con la proporción real.
              // La primera colocación, justo tras `open`, aún no podía conocerla
              // y usó 16:9 por defecto.
              colocarVideo(cajaRef.current);
              if (bajoDemanda) {
                try {
                  // `getDuration()` viene en MILISEGUNDOS. Tomarlo por segundos
                  // deja la barra de progreso clavada en el primer píxel.
                  const ms = Number(av.getDuration());
                  if (ms > 0) setDuracion(Math.round(ms / 1000));
                } catch {
                  // Se queda la duración de la ficha, que ya viene puesta.
                }
              }
              // La preferencia NO se aplica aquí. Medido en el televisor:
              // `setSelectTrack` justo después de preparar y antes de `play()`
              // se acepta sin error pero NO surte efecto —sigue sonando la
              // pista 1—, mientras que con el vídeo ya en marcha funciona en
              // 82 ms. Se aplica en cuanto la reproducción arranca de verdad.
              preferenciaPendiente.current = true;

              av.play();
              setPausado(false);
              // Volvió la emisión: se quita el aviso. La cuenta de intentos NO
              // se reinicia aquí sino cuando vuelve a sonar de verdad, porque
              // preparar con éxito no garantiza que el flujo aguante.
              setReconectando(false);

              // Respaldo por si `oncurrentplaytime` no llegara en este modelo:
              // sin él la pista guardada no se aplicaría nunca. `aplicarPreferencia`
              // solo actúa una vez, así que llegue quien llegue primero da igual.
              setTimeout(aplicarPreferencia, 2000);
            },
            // Fallo al preparar. En directo suele ser pasajero; bajo demanda,
            // hoy, es el nodo de contenido caído.
            () => fallar(bajoDemanda ? mensajeDeFallo : 'El canal no responde.'),
          );
        } catch (e) {
          console.error('AVPlay:', e);
          fallar(mensajeDeFallo);
        }
        return;
      }

      // Chromium de desarrollo: mismo motor que la web.
      const jugador = mpegts.createPlayer({
        type: 'mpegts', isLive: !bajoDemanda, url: destino,
      });
      jugadorRef.current = jugador;
      jugador.attachMediaElement(videoRef.current);
      jugador.on(mpegts.Events.ERROR, (t, d, info) => {
        if (cancelado) return;
        setCargando(false);
        setError(MENSAJES[info?.code ?? null] ?? MENSAJES.generico);
      });
      jugador.on(mpegts.Events.MEDIA_INFO, () => !cancelado && setCargando(false));
      jugador.load();
      jugador.play().catch(() => {});
    })();

    return () => {
      cancelado = true;
      if (nativo) {
        try {
          // Sin `stop` + `close` el decodificador por hardware queda ocupado y
          // lo siguiente no arranca. Es el fallo clásico de AVPlay, y no da
          // ningún error: simplemente se queda en negro.
          window.webapis.avplay.stop();
          window.webapis.avplay.close();
        } catch {
          // Ya estaba cerrado; cerrar dos veces no debe romper el cambio.
        }
        return;
      }
      const jugador = jugadorRef.current;
      if (!jugador) return;
      try {
        jugador.pause();
        jugador.unload();
        jugador.detachMediaElement();
        jugador.destroy();
      } catch {
        // Ídem: destruir un reproductor ya destruido no debe romper nada.
      }
      jugadorRef.current = null;
    };
    // Solo lo que de verdad obliga a reabrir el vídeo. Los avisos van por
    // referencia justo por esto. `reconexion` sube tras un corte del proveedor.
  }, [streamId, url, bajoDemanda, nativo, intento, reconexion]);

  // Pausa y salto. Solo tienen sentido bajo demanda: en directo, AVPlay
  // reanudaría desde el punto pausado y el canal se quedaría retrasado sin que
  // el usuario entienda por qué.
  const alternarPausa = useCallback(() => {
    if (!bajoDemanda || !nativo) return;
    const av = window.webapis.avplay;
    try {
      if (pausado) {
        av.play();
        setPausado(false);
      } else {
        av.pause();
        setPausado(true);
      }
    } catch (e) {
      console.error('AVPlay pausa:', e);
    }
  }, [bajoDemanda, nativo, pausado]);

  const saltar = useCallback((segundos) => {
    if (!bajoDemanda || !nativo) return;
    try {
      // `jumpForward`/`jumpBackward` van en milisegundos y llevan su propio
      // control de límites; `seekTo` obliga a calcularlos a mano.
      if (segundos > 0) window.webapis.avplay.jumpForward(segundos * 1000);
      else window.webapis.avplay.jumpBackward(-segundos * 1000);
    } catch (e) {
      console.error('AVPlay salto:', e);
    }
  }, [bajoDemanda, nativo]);

  /**
   * Las pistas que hay AHORA MISMO, para pintar el menú.
   *
   * Se leen al abrirlo y no al preparar: así reflejan lo que se está viendo
   * aunque se haya cambiado de canal por debajo.
   */
  const leerPistas = useCallback(() => {
    const vacio = { audio: [], subtitulos: [], audioActivo: null, subtituloActivo: null };
    if (!nativo) {
      return { ...vacio, error: 'La selección de pistas solo funciona en el televisor.' };
    }
    const av = window.webapis.avplay;
    try {
      const { audio, subtitulos } = normalizarPistas(av.getTotalTrackInfo());

      // Cuál suena AHORA se le pregunta a AVPlay: `getCurrentStreamInfo()`
      // devuelve las pistas activas. Fiarse solo de lo que llevemos apuntado
      // dejaba el menú sin marcar nada mientras no se hubiera elegido, y el
      // usuario no podía saber qué estaba oyendo.
      let sonandoAudio = audioActivo;
      let sonandoSub = subtituloActivo;
      try {
        for (const p of av.getCurrentStreamInfo() || []) {
          const tipo = String(p.type || '').toUpperCase();
          if (tipo === 'AUDIO') sonandoAudio = p.index;
          else if (tipo === 'TEXT') sonandoSub = p.index;
        }
      } catch {
        // Se queda lo apuntado, que es mejor que nada.
      }

      return {
        audio, subtitulos, audioActivo: sonandoAudio, subtituloActivo: sonandoSub,
        error: null,
      };
    } catch (e) {
      console.error('AVPlay getTotalTrackInfo:', e);
      return { ...vacio, error: 'No se pudieron leer las pistas de este contenido.' };
    }
  }, [nativo, audioActivo, subtituloActivo]);

  const elegirAudio = useCallback((pista) => {
    if (!nativo || !pista) return;
    try {
      window.webapis.avplay.setSelectTrack('AUDIO', pista.indice);
      setAudioActivo(pista.indice);
      guardarPreferencia('audio', pista);
    } catch (e) {
      console.error('AVPlay setSelectTrack audio:', e);
    }
  }, [nativo]);

  const elegirSubtitulo = useCallback((pista) => {
    if (!nativo) return;
    const av = window.webapis.avplay;
    try {
      if (!pista) {
        // Así es como AVPlay los apaga: no existe una "pista ninguna".
        av.setSilentSubtitle(true);
        setSubtituloActivo(null);
        guardarPreferencia('subtitulo', null);
        return;
      }
      av.setSelectTrack('TEXT', pista.indice);
      av.setSilentSubtitle(false);
      setSubtituloActivo(pista.indice);
      guardarPreferencia('subtitulo', pista);
    } catch (e) {
      console.error('AVPlay setSelectTrack subtitulo:', e);
    }
  }, [nativo]);

  // Reintento a mano. Sube `intento`, que reejecuta el efecto entero y vuelve a
  // abrir la fuente. Pasado de 1 ya no habrá más reintentos silenciosos, que es
  // lo que se quiere: a partir de aquí manda el usuario.
  const reintentar = useCallback(() => {
    setError(null);
    setIntento((n) => n + 1);
  }, []);

  // App maneja el teclado en un único sitio, así que necesita llegar a los
  // mandos sin subir aquí todo el estado del reproductor.
  useImperativeHandle(referencia, () => ({
    alternarPausa, saltar, leerPistas, elegirAudio, elegirSubtitulo,
  }), [alternarPausa, saltar, leerPistas, elegirAudio, elegirSubtitulo]);

  const porcentaje = duracion ? Math.min(100, (posicion / duracion) * 100) : 0;

  return (
    <div className="reproductor" ref={cajaRef}>
      {/* En el televisor el hueco queda transparente y AVPlay pinta detrás. */}
      {!nativo && <video ref={videoRef} className="reproductor__video" autoPlay />}

      {streamId == null && !bajoDemanda && (
        <div className="reproductor__vacio">
          <div className="reproductor__marcador" aria-hidden="true" />
          <p className="reproductor__aviso">Elige un canal de la lista para empezar a ver.</p>
        </div>
      )}

      {cargando && (streamId != null || bajoDemanda) && (
        <div className="reproductor__cargando">
          <div className="reproductor__pulso" aria-hidden="true" />
          <p>{bajoDemanda ? `Preparando ${nombre}…` : `Sintonizando ${nombre}…`}</p>
        </div>
      )}

      {/* El corte del proveedor deja el último fotograma congelado en el plano
          de vídeo, así que sin este aviso la pantalla parece normal y el
          usuario no entiende por qué no avanza nada. */}
      {reconectando && !error && (
        <div className="reproductor__cargando">
          <div className="reproductor__pulso" aria-hidden="true" />
          <p>{RECONECTANDO}</p>
        </div>
      )}

      {nombre && !cargando && !reconectando && !bajoDemanda && (
        <p className="reproductor__nombre">{nombre}</p>
      )}

      {error && (
        <div className="reproductor__fallo">
          <p className="reproductor__error" role="alert">{error}</p>
          {/* Con la interfaz oculta este botón es lo único enfocable, así que se
              lleva el foco solo y el mando no se queda sin nada que hacer. */}
          <Enfocable className="boton-secundario" inicial alPulsar={reintentar}>
            Reintentar
          </Enfocable>
        </div>
      )}

      {bajoDemanda && !cargando && !error && (
        <div className="progreso">
          <p className="progreso__titulo">{fuente.titulo}</p>
          <div className="progreso__barra">
            <div className="progreso__relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <p className="progreso__tiempo">
            {reloj(posicion)} / {duracion ? reloj(duracion) : '--:--'}
            {pausado && ' · en pausa'}
          </p>
        </div>
      )}
    </div>
  );
}

export default forwardRef(Reproductor);
