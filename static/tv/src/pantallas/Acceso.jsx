import { useState } from 'react';
import { mensajeDeError } from '../lib/errores.js';
import { entrar, leerCodigoGuardado } from '../lib/acceso.js';
import { formatearCodigo } from '../lib/codigo.js';
import { iniciarSesionGuardada } from '../lib/sesion.js';
import Enfocable from '../componentes/Enfocable.jsx';
import Teclado from '../componentes/Teclado.jsx';

// El orden importa: el código primero, porque es lo que decide contra qué
// panel se validan los otros dos.
const CAMPOS = ['codigo', 'usuario', 'clave'];

export default function Acceso({ alEntrar }) {
  const [campo, setCampo] = useState('codigo');
  // El código se recuerda de la última vez: salir es cambiar de cuenta del
  // proveedor, no de proveedor, y teclear ocho caracteres con un mando es caro.
  const [codigo, setCodigo] = useState(leerCodigoGuardado());
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const ponedores = { codigo: setCodigo, usuario: setUsuario, clave: setClave };

  // El código se formatea mientras se escribe -mayúsculas, sin basura y con el
  // guion-; los otros dos van tal cual, que una contraseña puede llevar
  // cualquier cosa.
  const cambiar = (transformar) => {
    const poner = ponedores[campo];
    poner((v) => (campo === 'codigo' ? formatearCodigo(transformar(v)) : transformar(v)));
  };
  const escribir = (t) => cambiar((v) => v + t);
  const borrar = () => cambiar((v) => v.slice(0, -1));

  const aceptar = async () => {
    // Aceptar salta al siguiente campo en vez de enviar: con un mando, tener
    // que buscar el siguiente a mano sería un paso de más en cada uno.
    const siguiente = CAMPOS[CAMPOS.indexOf(campo) + 1];
    if (siguiente) {
      setCampo(siguiente);
      return;
    }
    if (!codigo || !usuario || !clave) {
      setError('Escribe tu código, tu usuario y tu contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      // `entrar` va contra NUESTRO backend, que resuelve el código a un panel,
      // valida allí usuario y clave, y devuelve la URL. A partir de ahí la app
      // habla sola con ese panel. Lo que se apunta en la sesión es solo una
      // marca de "hay alguien dentro", porque `haySesion()` es lo que decide
      // si App muestra el acceso o la app.
      await entrar(codigo, usuario, clave);
      iniciarSesionGuardada('xui');
      alEntrar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="acceso">
      <img src="./wordmark.png" alt="FastPlay" className="acceso__logo" />
      <p className="acceso__intro">Entra con la cuenta de tu proveedor</p>

      <div className="acceso__campos">
        <Enfocable inicial
          className={`acceso__campo${campo === 'codigo' ? ' es-activo' : ''}`}
          alPulsar={() => setCampo('codigo')}>
          <span className="acceso__etiqueta">Código de acceso</span>
          <span className={`acceso__valor${codigo ? '' : ' es-marcador'}`}>
            {codigo || 'Escribe tu código'}
          </span>
        </Enfocable>

        <Enfocable
          className={`acceso__campo${campo === 'usuario' ? ' es-activo' : ''}`}
          alPulsar={() => setCampo('usuario')}>
          <span className="acceso__etiqueta">Usuario</span>
          <span className={`acceso__valor${usuario ? '' : ' es-marcador'}`}>
            {usuario || 'Escribe tu usuario'}
          </span>
        </Enfocable>

        <Enfocable
          className={`acceso__campo${campo === 'clave' ? ' es-activo' : ''}`}
          alPulsar={() => setCampo('clave')}>
          <span className="acceso__etiqueta">Contraseña</span>
          <span className={`acceso__valor${clave ? '' : ' es-marcador'}`}>
            {clave ? '•'.repeat(clave.length) : 'Escribe tu contraseña'}
          </span>
        </Enfocable>
      </div>

      <Teclado alEscribir={escribir} alBorrar={borrar} alAceptar={aceptar}
        textoAceptar={campo === 'clave' ? 'Entrar' : 'Siguiente'} />

      {enviando && <p className="acceso__aviso">Entrando…</p>}
      {error && <p className="acceso__error" role="alert">{error}</p>}
    </div>
  );
}
