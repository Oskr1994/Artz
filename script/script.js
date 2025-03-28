function cargarPagina(pagina) {
    fetch(pagina)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar la página: ${response.status}`);
            }
            return response.text();
        })
        .then(data => {
            let contenedor = document.getElementById('contenido');
            let seccionInicio = document.getElementById('inicio'); // Selecciona la sección inicio

            if (contenedor) {
                contenedor.innerHTML = data; // Carga el contenido en #contenido
            } else {
                console.error("No se encontró el div con ID 'contenido'.");
            }

            if (seccionInicio) {
                seccionInicio.style.display = "none"; // Oculta la sección #inicio
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('No se pudo cargar la página.');
        });
}
function mostrarInicio() {
    location.reload(); // Recarga la página completa
}
