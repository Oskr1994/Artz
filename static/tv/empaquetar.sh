#!/usr/bin/env bash
#
# Compila la app y deja ./dist listo para firmar.
#
# La FIRMA no se hace aquí a propósito: `tizen package` necesita Tizen Studio y
# el certificado de Samsung, que está atado a la cuenta y al PC de quien
# desarrolla, no a este servidor. Este script prepara todo y recuerda los
# comandos que faltan.
set -euo pipefail
cd "$(dirname "$0")"

npm run build

# El manifiesto y el icono tienen que viajar DENTRO del paquete, junto al
# index.html, no quedarse fuera del directorio que se empaqueta.
cp config.xml icon.png dist/

echo
echo "Listo. ./dist contiene la app, su config.xml y su icono."
echo
echo "Ahora, en el PC con Tizen Studio instalado:"
echo
echo "  tizen package -t wgt -s <tu-perfil> -- dist"
echo "  sdb connect <IP-DEL-TELEVISOR>:26101"
echo "  tizen install -n FastPlay.wgt -t \"\$(sdb devices | awk 'NR==2{print \$3}')\""
echo
echo "Si no tienes aún el perfil de certificado o el Modo Desarrollador"
echo "activado en el televisor, mira README.md: están los dos, paso a paso."
