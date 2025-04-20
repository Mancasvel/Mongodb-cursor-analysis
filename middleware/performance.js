const mongoose = require('mongoose');
const { performance } = require('perf_hooks');

// Mantener historial de consultas para análisis
const queryStats = {
  queries: [],
  avgTime: 0,
  maxTime: 0,
  minTime: Infinity,
  totalQueries: 0
};

// Monitorear todos los eventos de consulta
function setupPerformanceMonitoring() {
  mongoose.set('debug', true);
  
  // Agregar hooks para monitorear tiempos de consultas
  mongoose.connection.on('query', (query) => {
    const startTime = performance.now();
    
    // Guardar tiempo de inicio para cada operación
    query.startTime = startTime;
    
    // Contabilizar
    queryStats.totalQueries++;
  });
  
  // Cuando una consulta finaliza
  mongoose.connection.on('queryResponse', (response, query) => {
    if (query.startTime) {
      const endTime = performance.now();
      const queryTime = endTime - query.startTime;
      
      // Registrar estadísticas
      queryStats.queries.push({
        operation: query.operation,
        collection: query.collection,
        query: JSON.stringify(query.query),
        time: queryTime,
        timestamp: new Date()
      });
      
      // Limitar el historial a las últimas 100 consultas
      if (queryStats.queries.length > 100) {
        queryStats.queries.shift();
      }
      
      // Actualizar estadísticas
      queryStats.avgTime = queryStats.queries.reduce((sum, q) => sum + q.time, 0) / queryStats.queries.length;
      queryStats.maxTime = Math.max(queryStats.maxTime, queryTime);
      queryStats.minTime = Math.min(queryStats.minTime, queryTime);
    }
  });
  
  return queryStats;
}

// Middleware para medir tiempo de respuesta del servidor
function responseTimeMiddleware(req, res, next) {
  const start = performance.now();
  
  // Función que se ejecuta al finalizar la respuesta
  res.on('finish', () => {
    const duration = performance.now() - start;
    
    // Registrar en console para debugging
    console.log(`${req.method} ${req.originalUrl} - ${duration.toFixed(2)}ms`);
    
    // Almacenar métricas en la request para posible uso en vistas
    req.responseTime = duration;
  });
  
  next();
}

module.exports = {
  setupPerformanceMonitoring,
  responseTimeMiddleware,
  getQueryStats: () => queryStats
}; 