const express = require('express');
const router = express.Router();
const { getQueryStats } = require('../middleware/performance');
const Cursor = require('../models/Cursor');
const mongoose = require('mongoose');
const { performance } = require('perf_hooks');

// Dashboard principal
router.get('/', async (req, res) => {
  try {
    // Obtener estadísticas generales
    const stats = getQueryStats();
    
    // Conteo total de cursores
    const totalCursores = await Cursor.countDocuments();
    
    // Datos para gráfico de operaciones recientes
    const operationsData = {};
    stats.queries.forEach(query => {
      const operation = query.operation;
      if (!operationsData[operation]) {
        operationsData[operation] = {
          count: 0,
          avgTime: 0,
          totalTime: 0
        };
      }
      operationsData[operation].count++;
      operationsData[operation].totalTime += query.time;
    });
    
    // Calcular promedios
    Object.keys(operationsData).forEach(op => {
      operationsData[op].avgTime = operationsData[op].totalTime / operationsData[op].count;
    });
    
    // Datos del sistema MongoDB
    const dbStats = {
      dbName: mongoose.connection.db.databaseName,
      connectionState: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
      host: mongoose.connection.host,
      port: mongoose.connection.port
    };
    
    res.render('dashboard/index', {
      stats,
      totalCursores,
      operationsData,
      dbStats,
      // Datos para gráficos
      chartData: {
        labels: stats.queries.slice(-10).map(q => q.operation),
        times: stats.queries.slice(-10).map(q => q.time.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error en dashboard:', error);
    res.status(500).render('error', {
      message: 'Error al cargar las estadísticas de rendimiento',
      error
    });
  }
});

// Detalle de consultas recientes
router.get('/queries', (req, res) => {
  const stats = getQueryStats();
  res.render('dashboard/queries', { 
    queries: stats.queries.slice().reverse() // Mostrar las más recientes primero
  });
});

// Realizar consulta de prueba para medir rendimiento
router.post('/benchmark', async (req, res) => {
  try {
    const startTime = performance.now();
    
    // Simular diferentes tipos de consultas
    const results = await Promise.all([
      Cursor.find().limit(5).exec(), // Consulta básica
      Cursor.find().sort({fechaCreacion: -1}).limit(10).exec(), // Consulta con ordenamiento
      Cursor.find().skip(2).limit(3).exec(), // Consulta con paginación
      Cursor.countDocuments(), // Conteo
      Cursor.aggregate([
        { $group: { _id: "$ciudad", count: { $sum: 1 } } }
      ]) // Agregación simple
    ]);
    
    const endTime = performance.now();
    const benchmarkTime = endTime - startTime;
    
    res.json({
      success: true,
      message: 'Benchmark completado',
      tiempo: benchmarkTime.toFixed(2),
      resultados: {
        basica: results[0].length,
        ordenada: results[1].length,
        paginada: results[2].length,
        conteo: results[3],
        agregacion: results[4].length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error al realizar benchmark',
      error: error.message
    });
  }
});

module.exports = router;
