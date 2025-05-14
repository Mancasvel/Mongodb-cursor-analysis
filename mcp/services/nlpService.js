const { OpenAI } = require('openai');
const config = require('../config/config');

class NLPService {
  constructor() {
    // Inicializar cliente de OpenAI con la configuración de OpenRouter
    this.openai = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: config.openRouter.apiKey,
      defaultHeaders: {
        "HTTP-Referer": config.openRouter.siteUrl,
        "X-Title": config.openRouter.siteName,
      },
    });
    console.log('NLPService: Usando OpenRouter como proveedor de LLM');
    
    // Contexto mantenido por conversación/sesión
    this.sessionContexts = new Map();
  }

  /**
   * Procesa una instrucción en lenguaje natural
   * @param {string} instruction - Instrucción en lenguaje natural
   * @param {string} sessionId - ID de sesión para mantener contexto
   * @param {Object} options - Opciones adicionales (como archivos adjuntos)
   * @returns {Promise<{type: string, operation: string, params: Object, mongoQuery: Object}>}
   */
  async processInstruction(instruction, sessionId, options = {}) {
    // Obtener el contexto existente o crear uno nuevo
    const context = this._getSessionContext(sessionId);
    
    // Preparar el contenido del mensaje según si hay imagen o no
    let userContent;
    
    if (options.imageUrl) {
      // Si hay una imagen, crear un mensaje multimodal
      userContent = [
        {
          type: "text",
          text: instruction
        },
        {
          type: "image_url",
          image_url: {
            url: options.imageUrl
          }
        }
      ];
    } else {
      // Mensaje simple de texto
      userContent = instruction;
    }
    
    // Agregar la nueva instrucción al historial de contexto
    context.history.push({ 
      role: 'user', 
      content: userContent 
    });
    
    // Definir el prompt para el modelo
    const systemPrompt = {
      role: 'system',
      content: `Eres un asistente especializado en convertir consultas en lenguaje natural a operaciones de MongoDB.
      Analiza la consulta del usuario y devuelve un JSON con el siguiente formato:
      {
        "type": "query|update|insert|delete|aggregate",
        "operation": "find|findOne|updateOne|updateMany|insertOne|insertMany|deleteOne|deleteMany|aggregate",
        "collection": "nombre de la colección (por defecto: cursores)",
        "params": { parámetros específicos según el tipo de operación },
        "mongoQuery": { la consulta MongoDB correspondiente }
      }
      
      Devuelve solamente el JSON sin ningún formato adicional, prefijos o sufijos. No utilices bloques de código markdown como \`\`\`json o \`\`\`. Solo devuelve el JSON plano.
      
      Si la consulta incluye una imagen, extrae información relevante de ella para incorporarla a los parámetros de búsqueda o actualización.`
    };
    
    try {
      // Hacer la llamada a la API de OpenRouter
      const response = await this.openai.chat.completions.create({
        model: config.openRouter.model,
        messages: [systemPrompt, ...context.history],
        temperature: 0.2,
        max_tokens: 500
      });
      
      // Obtener la respuesta generada
      const content = response.choices[0].message.content.trim();
      
      // Guardar en el contexto
      context.history.push({ role: 'assistant', content });
      
      // Mantener el historial de contexto limitado a 10 mensajes
      if (context.history.length > 10) {
        context.history = context.history.slice(-10);
      }
      
      // Actualizar el tiempo de última actividad
      context.lastActivity = Date.now();
      
      try {
        // Limpiar el contenido para quitar posibles bloques de código markdown
        const cleanedContent = this._cleanJsonContent(content);
        console.log('Respuesta del modelo procesada:', cleanedContent);
        
        // Parsear la respuesta JSON
        const parsedResponse = JSON.parse(cleanedContent);
        return parsedResponse;
      } catch (e) {
        console.error('Error al parsear JSON. Contenido recibido:', content);
        throw new Error(`No se pudo parsear la respuesta como JSON: ${content}`);
      }
    } catch (error) {
      console.error('Error al procesar la instrucción:', error);
      throw error;
    }
  }
  
  /**
   * Limpia el contenido JSON de bloques de código markdown u otros formatos
   * @param {string} content - Contenido que puede contener JSON
   * @returns {string} - JSON limpio
   */
  _cleanJsonContent(content) {
    // Eliminar bloques de código markdown
    let cleaned = content;
    
    // Eliminar bloques de código markdown como ```json ... ```
    const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/;
    const match = codeBlockRegex.exec(cleaned);
    if (match && match[1]) {
      cleaned = match[1].trim();
    }
    
    // Eliminar comillas invertidas simples
    cleaned = cleaned.replace(/`/g, '');
    
    return cleaned;
  }
  
  /**
   * Obtiene o crea un contexto de sesión
   * @param {string} sessionId - ID de sesión
   * @returns {Object} Contexto de la sesión
   */
  _getSessionContext(sessionId) {
    // Si no existe un contexto para esta sesión, crear uno nuevo
    if (!this.sessionContexts.has(sessionId)) {
      this.sessionContexts.set(sessionId, {
        history: [],
        lastActivity: Date.now()
      });
    }
    
    return this.sessionContexts.get(sessionId);
  }
  
  /**
   * Limpia contextos de sesión antiguos
   */
  cleanupOldContexts() {
    const now = Date.now();
    const ttlMs = config.session.contextTTL * 60 * 1000; // Convertir minutos a milisegundos
    
    for (const [sessionId, context] of this.sessionContexts.entries()) {
      if (now - context.lastActivity > ttlMs) {
        this.sessionContexts.delete(sessionId);
      }
    }
  }
}

module.exports = new NLPService(); 