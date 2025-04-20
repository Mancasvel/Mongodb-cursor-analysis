// Script para validar formularios
document.addEventListener('DOMContentLoaded', function() {
  // Obtener todos los formularios a los que queremos aplicar estilos de validación personalizados
  const forms = document.querySelectorAll('.needs-validation');

  // Recorrer los formularios y prevenir el envío si no son válidos
  Array.from(forms).forEach(form => {
    form.addEventListener('submit', event => {
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopPropagation();
      }
      form.classList.add('was-validated');
    }, false);
  });

  // Formatear fechas a formato local en la tabla
  const fechas = document.querySelectorAll('.fecha-local');
  fechas.forEach(elemento => {
    const fecha = new Date(elemento.textContent);
    elemento.textContent = fecha.toLocaleDateString();
  });
}); 