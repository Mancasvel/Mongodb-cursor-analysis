const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const nlpService = require('../services/nlpService');
const dbService = require('../services/dbService');

// Endpoint principal para consultas en lenguaje natural
router.post('/query', async (req, res) => {
  try {
    // Validar la solicitud
    const { query, sessionId, imageUrl, modelOverride } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere una consulta en el campo "query"' 
      });
    }
    
    // Usar el sessionId proporcionado o generar uno nuevo
    const session = sessionId || uuidv4();
    
    // Opciones para el procesamiento
    const options = {};
    if (imageUrl) {
      options.imageUrl = imageUrl;
    }
    
    // Si se especificó un modelo, usarlo
    if (modelOverride) {
      options.modelOverride = modelOverride;
    }
    
    // Procesar la consulta con el servicio NLP
    const parsedQuery = await nlpService.processInstruction(query, session, options);
    
    // Ejecutar la operación en MongoDB
    const result = await dbService.executeOperation(parsedQuery);
    
    // Enviar respuesta al cliente
    res.json({
      success: true,
      sessionId: session,
      operation: parsedQuery.operation,
      collection: parsedQuery.collection || 'cursors',
      result,
      // Incluir metadatos útiles
      metadata: {
        resultCount: Array.isArray(result) ? result.length : 1,
        query: parsedQuery.mongoQuery,
        usedImage: !!imageUrl,
        usedModel: options.modelOverride || 'default'
      }
    });
  } catch (error) {
    console.error('Error al procesar consulta MCP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para obtener metadatos de una colección
router.get('/collections/:name/metadata', async (req, res) => {
  try {
    const collectionName = req.params.name;
    const metadata = await dbService.getCollectionMetadata(collectionName);
    
    res.json({
      success: true,
      metadata
    });
  } catch (error) {
    console.error(`Error al obtener metadatos de colección ${req.params.name}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint para gestionar el contexto de una sesión
router.delete('/sessions/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Eliminar el contexto de la sesión
    nlpService.sessionContexts.delete(sessionId);
    
    res.json({
      success: true,
      message: `Sesión ${sessionId} eliminada correctamente`
    });
  } catch (error) {
    console.error(`Error al eliminar sesión ${req.params.sessionId}:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 