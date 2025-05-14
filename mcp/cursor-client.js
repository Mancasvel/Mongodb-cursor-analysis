const WebSocket = require('ws');
const readline = require('readline');
const config = require('./config/config');

// Crear la interfaz de línea de comandos
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// URL del WebSocket
const wsUrl = `ws://${config.server.host}:${config.server.port}`;
let ws;
let sessionId = null;
let currentMode = 'text'; // text o image
let pendingImageUrl = null;

// Función para conectar al WebSocket
function connectWebSocket() {
  console.log(`Conectando a ${wsUrl}...`);
  ws = new WebSocket(wsUrl);
  
  // Evento de conexión establecida
  ws.on('open', () => {
    console.log('Conexión establecida con el servidor MCP');
    console.log('Escribe tus consultas en lenguaje natural o comandos:');
    console.log('- !reset: Resetear el contexto de la conversación');
    console.log('- !image: Iniciar consulta con imagen (te pedirá una URL)');
    console.log('- !exit: Salir del cliente');
    console.log('-------------------------------------------');
    promptUser();
  });
  
  // Evento de recepción de mensajes
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'connection':
          sessionId = message.sessionId;
          console.log(`Sesión iniciada: ${sessionId}`);
          break;
          
        case 'processing':
          console.log(message.message);
          break;
          
        case 'result':
          console.log('\nResultado:');
          console.log(`Operación: ${message.operation} en colección: ${message.collection}`);
          console.log(`Encontrados: ${message.metadata.resultCount} documento(s)`);
          if (message.metadata.usedImage) {
            console.log(`Se procesó imagen en la consulta`);
          }
          console.log('\nDatos:');
          console.log(JSON.stringify(message.result, null, 2));
          break;
          
        case 'error':
          console.error(`\nError: ${message.message}`);
          break;
          
        case 'context_reset':
          sessionId = message.sessionId;
          console.log(`\nContexto reseteado. Nueva sesión: ${sessionId}`);
          break;
          
        default:
          console.log('\nMensaje recibido:', message);
      }
      
      promptUser();
    } catch (error) {
      console.error('Error al procesar mensaje:', error);
      promptUser();
    }
  });
  
  // Evento de error
  ws.on('error', (error) => {
    console.error('Error de conexión:', error.message);
  });
  
  // Evento de cierre
  ws.on('close', () => {
    console.log('Conexión cerrada');
    // Intentar reconectar después de 5 segundos
    setTimeout(() => {
      console.log('Intentando reconectar...');
      connectWebSocket();
    }, 5000);
  });
}

// Función para solicitar entrada al usuario
function promptUser() {
  if (currentMode === 'image' && !pendingImageUrl) {
    // Primero pedir la URL de la imagen
    rl.question('\nURL de la imagen > ', (imageUrl) => {
      if (imageUrl.trim() === '!cancel') {
        console.log('Consulta con imagen cancelada');
        currentMode = 'text';
        promptUser();
        return;
      }
      
      pendingImageUrl = imageUrl.trim();
      console.log('URL de imagen capturada. Ahora escribe tu consulta:');
      promptUser();
    });
    return;
  }
  
  const prompt = currentMode === 'image' ? '\nConsulta con imagen > ' : '\n> ';
  
  rl.question(prompt, (input) => {
    // Procesar comandos especiales
    if (input.trim() === '!exit') {
      console.log('Cerrando cliente...');
      ws.close();
      rl.close();
      process.exit(0);
    } else if (input.trim() === '!reset') {
      ws.send(JSON.stringify({
        type: 'reset_context'
      }));
      currentMode = 'text';
      pendingImageUrl = null;
    } else if (input.trim() === '!image') {
      console.log('Iniciando consulta con imagen. Escribe !cancel en cualquier momento para cancelar.');
      currentMode = 'image';
      pendingImageUrl = null;
      promptUser();
    } else {
      // Enviar consulta al servidor
      const payload = {
        type: 'query',
        query: input,
        sessionId
      };
      
      // Si estamos en modo imagen y hay una URL pendiente, incluirla
      if (currentMode === 'image' && pendingImageUrl) {
        payload.imageUrl = pendingImageUrl;
        console.log(`Enviando consulta con imagen: ${pendingImageUrl}`);
        
        // Resetear modo y URL pendiente
        currentMode = 'text';
        pendingImageUrl = null;
      }
      
      ws.send(JSON.stringify(payload));
    }
  });
}

// Iniciar la conexión
connectWebSocket();

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('\nCerrando cliente...');
  if (ws) ws.close();
  rl.close();
  process.exit(0);
}); 