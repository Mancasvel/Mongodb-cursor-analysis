const mongoose = require('mongoose');
const config = require('../config/config');

class DbService {
  constructor() {
    // Siempre establecer la conexión a MongoDB para asegurar que estamos conectados a la base correcta
    mongoose.connect(config.mongodb.uri, config.mongodb.options)
      .then(() => {
        console.log('Servicio MCP conectado a MongoDB Atlas');
        console.log('URI de conexión:', config.mongodb.uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')); // Ocultar credenciales en el log
      })
      .catch((err) => {
        console.error('Error al conectar servicio MCP a MongoDB Atlas:', err);
      });
  }

  /**
   * Ejecuta una operación MongoDB basada en la consulta procesada por el NLP
   * @param {Object} parsedQuery - Consulta procesada por el servicio NLP
   * @returns {Promise<Object>} - Resultado de la operación MongoDB
   */
  async executeOperation(parsedQuery) {
    try {
      console.log('Ejecutando operación con parsedQuery:', JSON.stringify(parsedQuery, null, 2));
      
      const { type, operation, collection, params, mongoQuery } = parsedQuery;
      const collectionName = collection || 'cursors';
      
      console.log(`Operación: ${operation} en colección: ${collectionName}`);
      
      // Obtenemos la colección de MongoDB
      const db = mongoose.connection.db;
      const coll = db.collection(collectionName);
      
      // Ejecutamos la operación correspondiente
      switch (operation) {
        case 'find':
          // Para find, asegurarnos de que mongoQuery es un objeto válido
          const query = mongoQuery || {};
          // Procesar los parámetros de find (limit, sort, project)
          const findParams = params || {};
          
          // Si hay un parámetro limit en la raíz de parsedQuery, usarlo
          if (parsedQuery.limit && !findParams.limit) {
            findParams.limit = parsedQuery.limit;
          }
          
          console.log('Find con query:', JSON.stringify(query));
          console.log('Find con params:', JSON.stringify(findParams));
          
          return await this._executeFind(coll, query, findParams);
        
        case 'findOne':
          return await coll.findOne(mongoQuery || {});
        
        case 'updateOne':
          return await coll.updateOne(
            mongoQuery || {},
            params.update || { $set: params }
          );
        
        case 'updateMany':
          return await coll.updateMany(
            mongoQuery || {},
            params.update || { $set: params }
          );
        
        case 'insertOne':
          return await coll.insertOne(params);
        
        case 'insertMany':
          return await coll.insertMany(params);
        
        case 'deleteOne':
          return await coll.deleteOne(mongoQuery || {});
        
        case 'deleteMany':
          return await coll.deleteMany(mongoQuery || {});
        
        case 'aggregate':
          return await coll.aggregate(params.pipeline || []).toArray();
        
        default:
          throw new Error(`Operación no soportada: ${operation}`);
      }
    } catch (error) {
      console.error('Error al ejecutar operación MongoDB:', error);
      throw error;
    }
  }
  
  /**
   * Ejecuta una consulta de tipo find con soporte para límite, ordenación y proyección
   * @param {Collection} collection - Colección de MongoDB
   * @param {Object} query - Filtro de consulta
   * @param {Object} params - Parámetros adicionales (limit, sort, project)
   * @returns {Promise<Array>} - Resultados de la consulta
   */
  async _executeFind(collection, query, params = {}) {
    try {
      console.log('Ejecutando find con query:', JSON.stringify(query));
      console.log('Parámetros:', JSON.stringify(params));
      
      // Asegurar que query es un objeto válido
      const safeQuery = query || {};
      
      // Iniciar la consulta
      let cursor = collection.find(safeQuery);
      
      // Aplicar límite si se especifica
      if (params && params.limit) {
        const limit = parseInt(params.limit);
        if (!isNaN(limit) && limit > 0) {
          console.log('Aplicando límite:', limit);
          cursor = cursor.limit(limit);
        }
      }
      
      // Aplicar ordenación si se especifica
      if (params && params.sort) {
        console.log('Aplicando ordenación:', params.sort);
        cursor = cursor.sort(params.sort);
      }
      
      // Aplicar proyección si se especifica
      if (params && params.project) {
        console.log('Aplicando proyección:', params.project);
        cursor = cursor.project(params.project);
      }
      
      // Ejecutar la consulta y devolver los resultados
      const results = await cursor.toArray();
      console.log(`Encontrados ${results.length} documentos`);
      return results;
    } catch (error) {
      console.error('Error en _executeFind:', error);
      throw error;
    }
  }
  
  /**
   * Obtiene metadatos sobre una colección (esquema, estructura)
   * @param {string} collectionName - Nombre de la colección
   * @returns {Promise<Object>} - Metadatos de la colección
   */
  async getCollectionMetadata(collectionName) {
    try {
      const db = mongoose.connection.db;
      const coll = db.collection(collectionName);
      
      // Obtener información sobre la colección
      const stats = await coll.stats();
      
      // Obtener una muestra de documentos para inferir la estructura
      const sampleDocs = await coll.find().limit(5).toArray();
      
      // Inferir esquema basado en la muestra
      const inferredSchema = this._inferSchema(sampleDocs);
      
      return {
        name: collectionName,
        count: stats.count,
        size: stats.size,
        avgDocSize: stats.avgObjSize,
        schema: inferredSchema
      };
    } catch (error) {
      console.error(`Error al obtener metadatos de colección ${collectionName}:`, error);
      throw error;
    }
  }
  
  /**
   * Infiere el esquema de una colección basado en una muestra de documentos
   * @param {Array} documents - Muestra de documentos
   * @returns {Object} - Esquema inferido
   */
  _inferSchema(documents) {
    if (!documents || documents.length === 0) {
      return {};
    }
    
    const schema = {};
    
    // Combinar todos los documentos para detectar todos los campos posibles
    documents.forEach(doc => {
      Object.keys(doc).forEach(key => {
        // Ignorar _id por defecto
        if (key === '_id') return;
        
        const value = doc[key];
        const type = typeof value;
        
        // Si el campo ya existe, verificar si el tipo coincide
        if (schema[key]) {
          if (schema[key].type !== type) {
            schema[key].type = 'mixed';
          }
          
          // Actualizar valores de ejemplo si es necesario
          if (!schema[key].examples.includes(String(value))) {
            schema[key].examples.push(String(value));
            if (schema[key].examples.length > 3) {
              schema[key].examples.pop(); // Limitar a 3 ejemplos
            }
          }
        } else {
          // Crear nueva entrada en el esquema
          schema[key] = {
            type,
            examples: [String(value)]
          };
          
          // Detectar si es una fecha
          if (value instanceof Date || (type === 'string' && !isNaN(Date.parse(value)))) {
            schema[key].type = 'date';
          }
          
          // Detectar si es un array
          if (Array.isArray(value)) {
            schema[key].type = 'array';
            if (value.length > 0) {
              schema[key].itemType = typeof value[0];
            }
          }
        }
      });
    });
    
    return schema;
  }
}

module.exports = new DbService(); 