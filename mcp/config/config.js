require('dotenv').config();

module.exports = {
  // Configuración de OpenRouter para NLP
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'google/gemma-3-27b-it:free',
    siteUrl: process.env.SITE_URL || 'https://localhost:3001',
    siteName: process.env.SITE_NAME || 'MongoDB-MCP'
  },
  
  // Configuración del servidor
  server: {
    port: process.env.MCP_PORT || 3001,
    host: process.env.MCP_HOST || 'localhost'
  },
  
  // Configuración de MongoDB (usando la misma que ya está configurada)
  mongodb: {
    uri: process.env.MONGODB_URI,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // Configuración de la sesión/contexto
  session: {
    // Tiempo máximo (en minutos) para mantener el contexto de una conversación
    contextTTL: 30
  }
}; 