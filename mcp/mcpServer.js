require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const config = require('./config/config');
const mcpRoutes = require('./routes/mcpRoutes');
const WebSocketService = require('./services/wsService');
const nlpService = require('./services/nlpService');

// Crear la aplicación Express
const app = express();
const server = http.createServer(app);

// Configurar middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar rutas
app.use('/api/mcp', mcpRoutes);

// Ruta de estado
app.get('/api/mcp/status', (req, res) => {
  res.json({
    status: 'online',
    version: '1.0.0',
    serverTime: new Date().toISOString(),
    activeSessions: nlpService.sessionContexts.size
  });
});

// Inicializar el servicio WebSocket
const wsService = new WebSocketService(server);

// Configurar un intervalo para limpiar contextos antiguos
setInterval(() => {
  nlpService.cleanupOldContexts();
}, 5 * 60 * 1000); // Cada 5 minutos

// Iniciar el servidor
const PORT = config.server.port;
server.listen(PORT, () => {
  console.log(`Servidor MCP escuchando en el puerto ${PORT}`);
  console.log(`API REST disponible en: http://localhost:${PORT}/api/mcp`);
  console.log(`WebSocket disponible en: ws://localhost:${PORT}`);
});

// Manejar señales de terminación
process.on('SIGINT', () => {
  console.log('Cerrando servidor MCP...');
  server.close(() => {
    console.log('Servidor MCP cerrado');
    process.exit(0);
  });
});

module.exports = { app, server }; 