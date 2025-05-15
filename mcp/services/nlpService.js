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
      Estas son las columnas reales de la colección principal:
      - nombre (String)
      - edad (Number)
      - ciudad (String)
      - fechaCreacion (Date)
      - createdAt (Date)
      - updatedAt (Date)
      Utiliza siempre estos nombres de campo exactamente como aparecen cuando generes la consulta MongoDB.
      Analiza la consulta del usuario y devuelve un JSON con el siguiente formato:
      {
        "type": "query|update|insert|delete|aggregate",
        "operation": "find|findOne|updateOne|updateMany|insertOne|insertMany|deleteOne|deleteMany|aggregate",
        "collection": "nombre de la colección (por defecto: cursors)",
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
        let parsedResponse = {};
        try {
          parsedResponse = JSON.parse(cleanedContent);
        } catch (parseError) {
          console.error('Error al parsear JSON. Contenido recibido:', content);
          console.error('Error:', parseError);
          
          // Intentar recuperar un JSON válido del texto
          const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsedResponse = JSON.parse(jsonMatch[0]);
              console.log('Recuperado JSON válido de la respuesta:', jsonMatch[0]);
            } catch (e) {
              throw new Error(`No se pudo parsear la respuesta como JSON: ${content}`);
            }
          } else {
            throw new Error(`No se pudo parsear la respuesta como JSON: ${content}`);
          }
        }
        
        // Asegurarse de que todos los campos necesarios estén presentes
        if (!parsedResponse.operation) {
          parsedResponse.operation = 'find'; // Por defecto, operación find
        }
        
        if (!parsedResponse.type) {
          // Inferir el tipo basado en la operación
          if (parsedResponse.operation.startsWith('find')) {
            parsedResponse.type = 'query';
          } else if (parsedResponse.operation.startsWith('update')) {
            parsedResponse.type = 'update';
          } else if (parsedResponse.operation.startsWith('insert')) {
            parsedResponse.type = 'insert';
          } else if (parsedResponse.operation.startsWith('delete')) {
            parsedResponse.type = 'delete';
          } else if (parsedResponse.operation === 'aggregate') {
            parsedResponse.type = 'aggregate';
          } else {
            parsedResponse.type = 'query';
          }
        }
        
        // Asegurarse de que la colección sea 'cursors' si no se especifica
        if (!parsedResponse.collection) {
          parsedResponse.collection = 'cursors';
        }
        
        // Asegurarse de que mongoQuery sea un objeto
        if (!parsedResponse.mongoQuery) {
          parsedResponse.mongoQuery = {};
        }
        
        // Asegurarse de que params sea un objeto
        if (!parsedResponse.params) {
          parsedResponse.params = {};
        }
        
        // Fallback: Si la consulta del usuario menciona una ciudad y mongoQuery no la incluye, añadirla
        if (typeof instruction === 'string' && parsedResponse && parsedResponse.mongoQuery && Object.keys(parsedResponse.mongoQuery).length === 0) {
          const ciudadMatch = instruction.match(/(?:de|en) ([A-ZÁÉÍÓÚÑa-záéíóúñ]+)/);
          if (ciudadMatch && ciudadMatch[1]) {
            parsedResponse.mongoQuery.ciudad = ciudadMatch[1];
            console.log('Fallback: Añadido filtro de ciudad a mongoQuery:', ciudadMatch[1]);
          }
        }
        
        // Mapeo de campos del inglés al español según la base de datos
        const fieldMap = {
          city: 'ciudad',
          name: 'nombre',
          age: 'edad',
          creationDate: 'fechaCreacion',
          createdAt: 'createdAt',
          updatedAt: 'updatedAt'
        };
        
        // Función para mapear las claves de un objeto
        function mapFields(obj) {
          if (!obj || typeof obj !== 'object') return obj;
          const mapped = {};
          for (const key in obj) {
            const newKey = fieldMap[key] || key;
            mapped[newKey] = obj[key];
          }
          return mapped;
        }
        
        // Mapear mongoQuery y params si es necesario
        if (parsedResponse.mongoQuery) {
          parsedResponse.mongoQuery = mapFields(parsedResponse.mongoQuery);
        }
        if (parsedResponse.params) {
          parsedResponse.params = mapFields(parsedResponse.params);
        }
        
        console.log('Consulta final procesada:', JSON.stringify(parsedResponse, null, 2));
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