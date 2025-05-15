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

  // MCP Chat functionality
  const mcpChatButton = document.getElementById('mcp-chat-button');
  const mcpChatPanel = document.getElementById('mcp-chat-panel');
  const mcpChatClose = document.getElementById('mcp-chat-close');
  const mcpSendButton = document.getElementById('mcp-send');
  const mcpInput = document.getElementById('mcp-input');
  const mcpMessages = document.getElementById('mcp-chat-messages');
  
  let ws = null;
  const sessionId = generateUUID();
  
  // Configuración del chat MCP
  const mcpConfig = {
    wsUrl: 'ws://localhost:3001',
    restUrl: '/api/mcp/query',
    model: 'google/gemma-3-27b-it:free',  // Asegurarnos que usamos el mismo modelo que el servidor MCP
    preferredLanguage: 'en'  // Recordatorio para usar inglés en las consultas
  };
  
  initMcpChat();
  
  function initMcpChat() {
    mcpChatButton.addEventListener('click', toggleChatPanel);
    mcpChatClose.addEventListener('click', toggleChatPanel);
    mcpSendButton.addEventListener('click', sendMessage);
    mcpInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
    
    // Agregar mensaje inicial sobre el idioma preferido
    addMessageToChat('system', 'Para mejores resultados, por favor formula tus consultas en inglés. Ejemplo: "give me all the cursors from Madrid"');
    
    connectWebSocket();
  }
  
  function toggleChatPanel() {
    mcpChatPanel.classList.toggle('active');
    if (mcpChatPanel.classList.contains('active')) {
      mcpInput.focus();
      if (ws === null || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
      }
    }
  }
  
  function connectWebSocket() {
    try {
      ws = new WebSocket(mcpConfig.wsUrl);
      
      ws.onopen = function() {
        console.log('Connected to MCP WebSocket');
      };
      
      ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleMcpResponse(data);
      };
      
      ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        ws = null;
      };
      
      ws.onclose = function() {
        console.log('WebSocket connection closed');
        ws = null;
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      ws = null;
    }
  }
  
  function sendMessage() {
    const message = mcpInput.value.trim();
    if (message === '') return;
    
    addMessageToChat('user', message);
    mcpInput.value = '';
    
    showTypingIndicator();
    
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'query',
        query: message,
        sessionId: sessionId,
        modelOverride: mcpConfig.model  // Asegurarnos de usar el modelo correcto en WebSocket
      }));
    } else {
      fetch(mcpConfig.restUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: message,
          sessionId: sessionId,
          modelOverride: mcpConfig.model  // Asegurarnos de usar el modelo correcto
        })
      })
      .then(response => response.json())
      .then(data => {
        hideTypingIndicator();
        handleMcpResponse(data);
      })
      .catch(error => {
        hideTypingIndicator();
        console.error('Error:', error);
        addMessageToChat('system', 'Error al conectar con MCP. Asegúrate de que el servidor MCP esté en ejecución.');
      });
    }
  }
  
  function handleMcpResponse(data) {
    hideTypingIndicator();
    
    if (data.type === 'processing') {
      return;
    }
    
    if (data.type === 'error') {
      addMessageToChat('system', `Error: ${data.message}`);
      return;
    }
    
    if (data.type === 'result' || data.success) {
      let responseText = '';
      
      // Mostrar información sobre el modelo utilizado si está disponible
      if (data.metadata && data.metadata.usedModel && data.metadata.usedModel !== 'default') {
        responseText += `Modelo: ${data.metadata.usedModel}\n`;
      }
      
      if (data.operation) {
        responseText += `Operación: ${data.operation} en colección: ${data.collection}\n`;
      }
      
      const resultData = data.result;
      
      // Formato especial para operaciones de explain
      if (data.operation === 'explain') {
        responseText += `Análisis de plan de ejecución:\n\n`;
        
        // Extraer y mostrar información útil del plan de ejecución
        if (resultData) {
          // Mostrar información sobre el planificador de consultas si está disponible
          if (resultData.queryPlanner) {
            responseText += `Plan de consulta:\n`;
            
            // Namespace (colección)
            if (resultData.queryPlanner.namespace) {
              responseText += `- Colección: ${resultData.queryPlanner.namespace}\n`;
            }
            
            // Plan ganador
            if (resultData.queryPlanner.winningPlan) {
              const winningPlan = resultData.queryPlanner.winningPlan;
              responseText += `- Plan ganador: ${winningPlan.stage || 'N/A'}\n`;
              
              // Si hay un índice utilizado
              if (winningPlan.inputStage && winningPlan.inputStage.indexName) {
                responseText += `- Índice utilizado: ${winningPlan.inputStage.indexName}\n`;
              }
              
              // Dirección del escaneo (adelante/atrás)
              if (winningPlan.direction) {
                responseText += `- Dirección: ${winningPlan.direction}\n`;
              }
            }
            
            // Planes rechazados
            if (resultData.queryPlanner.rejectedPlans && resultData.queryPlanner.rejectedPlans.length > 0) {
              responseText += `- Planes rechazados: ${resultData.queryPlanner.rejectedPlans.length}\n`;
            }
          }
          
          // Información de ejecución si está disponible
          if (resultData.executionStats) {
            const stats = resultData.executionStats;
            responseText += `\nEstadísticas de ejecución:\n`;
            responseText += `- Documentos examinados: ${stats.totalDocsExamined || 0}\n`;
            responseText += `- Llaves examinadas: ${stats.totalKeysExamined || 0}\n`;
            responseText += `- Documentos devueltos: ${stats.nReturned || 0}\n`;
            responseText += `- Tiempo de ejecución: ${stats.executionTimeMillis || 0} ms\n`;
          }
          
          // Plan completo en formato JSON
          responseText += `\nPlan completo:\n`;
          responseText += JSON.stringify(resultData, null, 2);
        }
      } else if (Array.isArray(resultData)) {
        responseText += `Encontrados: ${resultData.length} documento(s)\n\n`;
        if (resultData.length > 0) {
          const itemsToShow = Math.min(resultData.length, 5);
          responseText += 'Datos:\n';
          responseText += JSON.stringify(resultData.slice(0, itemsToShow), null, 2);
          
          if (resultData.length > itemsToShow) {
            responseText += `\n\n... y ${resultData.length - itemsToShow} más`;
          }
        }
      } else if (resultData && typeof resultData === 'object') {
        responseText += 'Resultado:\n';
        responseText += JSON.stringify(resultData, null, 2);
      } else {
        responseText += `Resultado: ${resultData}`;
      }
      
      addMessageToChat('response', responseText);
    }
  }
  
  function addMessageToChat(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `mcp-message ${type}`;
    
    if (type === 'response' && (text.includes('{') || text.includes('['))) {
      const formattedText = formatMessageWithCodeBlocks(text);
      messageDiv.innerHTML = formattedText;
    } else {
      messageDiv.textContent = text;
    }
    
    mcpMessages.appendChild(messageDiv);
    mcpMessages.scrollTop = mcpMessages.scrollHeight;
  }
  
  function formatMessageWithCodeBlocks(text) {
    const lines = text.split('\n');
    let formatted = '';
    let inCodeBlock = false;
    let codeContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if ((line.includes('{') || line.includes('[')) && !inCodeBlock && i < lines.length - 1) {
        inCodeBlock = true;
        formatted += line + '\n';
        continue;
      }
      
      if (inCodeBlock) {
        codeContent += line + '\n';
        
        if (i === lines.length - 1 || (line.trim() === '}' || line.trim() === ']' || line.includes('... y'))) {
          inCodeBlock = false;
          formatted += `<pre>${escapeHtml(codeContent)}</pre>`;
          codeContent = '';
        }
      } else {
        formatted += line + '<br>';
      }
    }
    
    return formatted;
  }
  
  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
  
  function showTypingIndicator() {
    hideTypingIndicator();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'mcp-typing';
    typingDiv.id = 'mcp-typing';
    
    const dotsDiv = document.createElement('div');
    dotsDiv.className = 'dots';
    
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div');
      dot.className = 'dot';
      dotsDiv.appendChild(dot);
    }
    
    typingDiv.appendChild(dotsDiv);
    mcpMessages.appendChild(typingDiv);
    mcpMessages.scrollTop = mcpMessages.scrollHeight;
  }
  
  function hideTypingIndicator() {
    const typingIndicator = document.getElementById('mcp-typing');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
  
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}); 