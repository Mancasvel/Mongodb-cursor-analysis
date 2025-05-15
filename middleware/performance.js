const mongoose = require('mongoose');
const { performance } = require('perf_hooks');
const fs = require('fs').promises;
const path = require('path');

// Configuración del monitoreo de consultas
const queryStatsConfig = {
  maxStoredQueries: process.env.MAX_STORED_QUERIES || 500,  // Aumentado de 100 a 500
  detailedStats: true,
  exportEnabled: process.env.EXPORT_QUERY_STATS === 'true',
  exportPath: process.env.QUERY_STATS_PATH || './logs/query-stats.json',
  exportInterval: process.env.QUERY_STATS_EXPORT_INTERVAL || 3600000 // 1 hora por defecto
};

// Mantener historial de consultas para análisis
const queryStats = {
  queries: [],
  avgTime: 0,
  maxTime: 0,
  minTime: Infinity,
  totalQueries: 0,
  cursorStats: {
    active: 0,
    created: 0,
    closed: 0,
    expired: 0,
    averageBatchSize: 0
  }
};

// Asegurar que exista el directorio de logs si la exportación está habilitada
async function ensureLogDirectory() {
  if (queryStatsConfig.exportEnabled) {
    try {
      const dir = path.dirname(queryStatsConfig.exportPath);
      await fs.mkdir(dir, { recursive: true });
      console.log(`Directorio de logs creado: ${dir}`);
    } catch (error) {
      console.error('Error al crear directorio de logs:', error);
    }
  }
}

// Exportar estadísticas periódicamente
async function exportQueryStats() {
  if (!queryStatsConfig.exportEnabled) return;
  
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = queryStatsConfig.exportPath.replace('.json', `-${timestamp}.json`);
    
    await fs.writeFile(exportPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      stats: queryStats,
      config: queryStatsConfig
    }, null, 2));
    
    console.log(`Estadísticas de consultas exportadas a ${exportPath}`);
  } catch (error) {
    console.error('Error al exportar estadísticas:', error);
  }
}

// Monitorear todos los eventos de consulta
async function setupPerformanceMonitoring() {
  await ensureLogDirectory();
  mongoose.set('debug', true);
  
  // Agregar hooks para monitorear tiempos de consultas
  mongoose.connection.on('query', (query) => {
    const startTime = performance.now();
    
    // Guardar tiempo de inicio para cada operación
    query.startTime = startTime;
    
    // Contabilizar
    queryStats.totalQueries++;
    
    // Detectar operaciones de cursor
    if (query.operation === 'find') {
      queryStats.cursorStats.created++;
      queryStats.cursorStats.active++;
    }
  });
  
  // Cuando una consulta finaliza
  mongoose.connection.on('queryResponse', (response, query) => {
    if (query.startTime) {
      const endTime = performance.now();
      const queryTime = endTime - query.startTime;
      
      // Detectar finalización de cursor
      if (query.operation === 'find') {
        queryStats.cursorStats.active = Math.max(0, queryStats.cursorStats.active - 1);
        queryStats.cursorStats.closed++;
      }
      
      // Extraer información adicional
      let batchSize = null;
      let indexUsed = false;
      
      // Intentar extraer información de batchSize y uso de índices
      if (query.query && typeof query.query === 'object') {
        if (query.query.options && query.query.options.batchSize) {
          batchSize = query.query.options.batchSize;
          // Actualizar promedio de batchSize
          queryStats.cursorStats.averageBatchSize = 
            (queryStats.cursorStats.averageBatchSize * (queryStats.cursorStats.created - 1) + batchSize) / 
            queryStats.cursorStats.created;
        }
        
        // Intentar determinar si se usó un índice (heurística simple)
        if (query.response && query.response.length > 0 && query.response._options) {
          indexUsed = query.response._options.explain && 
                     query.response._options.explain.queryPlanner && 
                     query.response._options.explain.queryPlanner.winningPlan.inputStage && 
                     query.response._options.explain.queryPlanner.winningPlan.inputStage.stage === 'IXSCAN';
        }
      }
      
      // Registro detallado
      const queryDetail = {
        operation: query.operation,
        collection: query.collection,
        query: JSON.stringify(query.query),
        time: queryTime,
        timestamp: new Date(),
        batchSize,
        indexUsed
      };
      
      // Registrar estadísticas
      queryStats.queries.push(queryDetail);
      
      // Limitar el historial al número configurado
      if (queryStats.queries.length > queryStatsConfig.maxStoredQueries) {
        queryStats.queries.shift();
      }
      
      // Actualizar estadísticas
      queryStats.avgTime = queryStats.queries.reduce((sum, q) => sum + q.time, 0) / queryStats.queries.length;
      queryStats.maxTime = Math.max(queryStats.maxTime, queryTime);
      queryStats.minTime = Math.min(queryStats.minTime, queryTime);
    }
  });
  
  // Capturar errores de cursor
  mongoose.connection.on('error', (error) => {
    if (error.code === 43) { // CursorNotFound
      queryStats.cursorStats.expired++;
      queryStats.cursorStats.active = Math.max(0, queryStats.cursorStats.active - 1);
    }
  });
  
  // Configurar exportación periódica si está habilitada
  if (queryStatsConfig.exportEnabled) {
    setInterval(exportQueryStats, queryStatsConfig.exportInterval);
    console.log(`Exportación de estadísticas configurada cada ${queryStatsConfig.exportInterval / 60000} minutos`);
  }
  
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
  getQueryStats: () => queryStats,
  getQueryStatsConfig: () => queryStatsConfig
}; 