const WebSocket = require('ws');
const nlpService = require('./nlpService');
const dbService = require('./dbService');
const { v4: uuidv4 } = require('uuid');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Mapa para almacenar clientes y sus sesiones
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws) => {
      // Generar un ID de cliente y de sesión
      const clientId = uuidv4();
      const sessionId = uuidv4();
      
      // Almacenar cliente y su sesión
      this.clients.set(ws, { clientId, sessionId });
      
      console.log(`Cliente WebSocket conectado: ${clientId}`);
      
      // Enviar mensaje de bienvenida
      this.sendMessage(ws, {
        type: 'connection',
        message: 'Conectado al servidor MCP. Puedes enviar consultas en lenguaje natural.',
        clientId,
        sessionId
      });
      
      // Manejar mensajes entrantes
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          
          // Procesar según el tipo de mensaje
          switch (data.type) {
            case 'query':
              await this.handleQuery(ws, data);
              break;
              
            case 'reset_context':
              this.handleResetContext(ws);
              break;
              
            default:
              this.sendMessage(ws, {
                type: 'error',
                message: `Tipo de mensaje no soportado: ${data.type}`
              });
          }
        } catch (error) {
          console.error('Error al procesar mensaje WebSocket:', error);
          this.sendMessage(ws, {
            type: 'error',
            message: `Error: ${error.message}`
          });
        }
      });
      
      // Manejar desconexión
      ws.on('close', () => {
        const client = this.clients.get(ws);
        if (client) {
          console.log(`Cliente WebSocket desconectado: ${client.clientId}`);
          this.clients.delete(ws);
        }
      });
    });
  }
  
  /**
   * Maneja una consulta en lenguaje natural
   * @param {WebSocket} ws - Cliente WebSocket
   * @param {Object} data - Datos del mensaje
   */
  async handleQuery(ws, data) {
    try {
      const client = this.clients.get(ws);
      
      if (!client) {
        throw new Error('Cliente no encontrado');
      }
      
      const { query, imageUrl, modelOverride } = data;
      const { sessionId } = client;
      
      // Notificar que se está procesando la consulta
      this.sendMessage(ws, {
        type: 'processing',
        message: 'Procesando consulta...'
      });
      
      // Opciones para el procesamiento
      const options = {};
      if (imageUrl) {
        options.imageUrl = imageUrl;
        this.sendMessage(ws, {
          type: 'processing',
          message: 'Procesando imagen incluida...'
        });
      }
      
      // Si se especificó un modelo, usarlo
      if (modelOverride) {
        options.modelOverride = modelOverride;
        console.log(`Cliente WebSocket solicitó usar modelo: ${modelOverride}`);
      }
      
      // Procesar la consulta con el servicio NLP
      const parsedQuery = await nlpService.processInstruction(query, sessionId, options);
      
      // Ejecutar la operación en MongoDB
      const result = await dbService.executeOperation(parsedQuery);
      
      // Enviar resultado al cliente
      this.sendMessage(ws, {
        type: 'result',
        operation: parsedQuery.operation,
        collection: parsedQuery.collection || 'cursors',
        result,
        metadata: {
          resultCount: Array.isArray(result) ? result.length : 1,
          query: parsedQuery.mongoQuery,
          usedImage: !!imageUrl,
          usedModel: modelOverride || 'default'
        }
      });
    } catch (error) {
      console.error('Error al procesar consulta WebSocket:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: `Error al procesar consulta: ${error.message}`
      });
    }
  }
  
  /**
   * Maneja una solicitud para resetear el contexto
   * @param {WebSocket} ws - Cliente WebSocket
   */
  handleResetContext(ws) {
    try {
      const client = this.clients.get(ws);
      
      if (!client) {
        throw new Error('Cliente no encontrado');
      }
      
      // Generar un nuevo ID de sesión
      const newSessionId = uuidv4();
      
      // Actualizar el ID de sesión del cliente
      client.sessionId = newSessionId;
      
      // Notificar al cliente
      this.sendMessage(ws, {
        type: 'context_reset',
        message: 'Contexto de conversación reseteado',
        sessionId: newSessionId
      });
    } catch (error) {
      console.error('Error al resetear contexto:', error);
      this.sendMessage(ws, {
        type: 'error',
        message: `Error al resetear contexto: ${error.message}`
      });
    }
  }
  
  /**
   * Envía un mensaje a un cliente WebSocket
   * @param {WebSocket} ws - Cliente WebSocket
   * @param {Object} message - Mensaje a enviar
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Envía un mensaje a todos los clientes conectados
   * @param {Object} message - Mensaje a enviar
   */
  broadcast(message) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

module.exports = WebSocketService; 