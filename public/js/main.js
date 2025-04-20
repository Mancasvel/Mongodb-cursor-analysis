// Script para validar formularios y funcionalidades adicionales
document.addEventListener('DOMContentLoaded', function() {
  // Inicializar tooltips
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  if (tooltipTriggerList.length > 0) {
    tooltipTriggerList.map(function(tooltipTriggerEl) {
      return new bootstrap.Tooltip(tooltipTriggerEl);
    });
  }
  
  // Inicializar popovers
  const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
  if (popoverTriggerList.length > 0) {
    popoverTriggerList.map(function(popoverTriggerEl) {
      return new bootstrap.Popover(popoverTriggerEl);
    });
  }
  
  // Obtener todos los formularios que necesitan validación de Bootstrap
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
    if (elemento.textContent && elemento.textContent.trim() !== '') {
      const fecha = new Date(elemento.textContent);
      elemento.textContent = fecha.toLocaleDateString();
    }
  });
  
  // Animación para las tarjetas al cargar la página
  const animateCards = document.querySelectorAll('.animate-card');
  animateCards.forEach((card, index) => {
    setTimeout(() => {
      card.classList.add('animate-in');
    }, 100 * index);
  });
  
  // Añadir mensaje de carga para operaciones largas
  const loadingButtons = document.querySelectorAll('.btn-loading');
  loadingButtons.forEach(button => {
    button.addEventListener('click', function() {
      const originalText = this.innerHTML;
      const loadingText = this.getAttribute('data-loading-text') || 'Cargando...';
      
      this.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>${loadingText}`;
      this.disabled = true;
      
      // Restaurar el botón después de un tiempo (para demonstración)
      setTimeout(() => {
        this.innerHTML = originalText;
        this.disabled = false;
      }, 2000);
    });
  });
  
  // Monitorear tiempo de carga de la página
  const pageLoadTime = window.performance.timing.domContentLoadedEventEnd - window.performance.timing.navigationStart;
  console.log(`Tiempo de carga de la página: ${pageLoadTime}ms`);
  
  // Mostrar un banner si el tiempo de carga es mayor a cierto umbral (para demostración)
  if (pageLoadTime > 1000 && document.querySelector('#performance-banner')) {
    const banner = document.querySelector('#performance-banner');
    banner.textContent = `Esta página tardó ${pageLoadTime}ms en cargar. Considera optimizar recursos.`;
    banner.classList.remove('d-none');
  }
  
  // Función para manejar el modo oscuro (si se implementa)
  const darkModeToggle = document.querySelector('#dark-mode-toggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', function() {
      document.body.classList.toggle('dark-mode');
      
      // Guardar preferencia en localStorage
      if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('darkMode', 'enabled');
      } else {
        localStorage.setItem('darkMode', 'disabled');
      }
    });
    
    // Verificar preferencia guardada
    if (localStorage.getItem('darkMode') === 'enabled') {
      document.body.classList.add('dark-mode');
    }
  }
}); 