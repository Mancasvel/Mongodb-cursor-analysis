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
    
    // Convertir a array para más fácil uso en la vista
    const operationsArray = Object.keys(operationsData).map(op => ({
      operation: op,
      count: operationsData[op].count,
      avgTime: operationsData[op].avgTime.toFixed(2),
      totalTime: operationsData[op].totalTime.toFixed(2)
    }));
    
    // Datos del sistema MongoDB
    const dbStats = {
      dbName: mongoose.connection.db.databaseName,
      connectionState: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
      host: mongoose.connection.host,
      port: mongoose.connection.port
    };
    
    // Asegurar que los tiempos en el gráfico estén correctamente formateados
    const recentQueries = stats.queries.slice(-10);
    
    res.render('dashboard/index', {
      stats,
      totalCursores,
      operationsData: operationsArray,
      dbStats,
      // Datos para gráficos
      chartData: {
        labels: recentQueries.map(q => {
          const time = new Date(q.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `${q.operation} (${time})`;
        }),
        times: recentQueries.map(q => q.time.toFixed(2))
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
    const stats = getQueryStats();
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
    const benchmarkTime = parseFloat((endTime - startTime).toFixed(2));
    
    // Registrar el benchmark en las estadísticas de rendimiento
    stats.queries.push({
      operation: 'benchmark',
      collection: 'multiple',
      query: 'Benchmark completo',
      time: benchmarkTime,
      timestamp: new Date()
    });
    
    // Actualizar estadísticas totales
    stats.totalQueries++;
    stats.avgTime = (stats.avgTime * (stats.queries.length - 1) + benchmarkTime) / stats.queries.length;
    stats.maxTime = Math.max(stats.maxTime, benchmarkTime);
    
    res.json({
      success: true,
      message: 'Benchmark completado',
      tiempo: benchmarkTime,
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

// Vista para poblar la base de datos
router.get('/poblar', (req, res) => {
  res.render('dashboard/poblar');
});

// Ruta para poblar la BD con datos de prueba
router.post('/poblar', async (req, res) => {
  try {
    const { cantidad, ciudades } = req.body;
    
    // Validación básica
    if (!cantidad || cantidad < 1 || cantidad > 1000) {
      return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 1000' });
    }
    
    if (!ciudades || !Array.isArray(ciudades) || ciudades.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una ciudad' });
    }
    
    // Crear documentos de prueba
    const nombres = ['Ana', 'Pedro', 'María', 'Juan', 'Lucía', 'Carlos', 'Sofía', 'Miguel', 'Laura', 'Pablo'];
    const documentos = [];
    
    // Generar datos aleatorios
    for (let i = 0; i < cantidad; i++) {
      const nombre = nombres[Math.floor(Math.random() * nombres.length)];
      const edad = Math.floor(Math.random() * 60) + 18; // Edades entre 18 y 77
      const ciudad = ciudades[Math.floor(Math.random() * ciudades.length)];
      
      documentos.push({
        nombre,
        edad,
        ciudad,
        fecha: new Date()
      });
    }
    
    // Insertar documentos en la base de datos usando insertMany
    // Nota: Esta operación no utiliza cursores. Los cursores son para lectura, no escritura.
    await Cursor.insertMany(documentos);
    
    // Contar total de documentos en la colección
    const totalDocumentos = await Cursor.countDocuments();
    
    // Enviar respuesta
    res.json({
      success: true,
      mensaje: `Se han creado ${cantidad} documentos nuevos`,
      totalDocumentos,
      documentosCreados: cantidad
    });
    
  } catch (error) {
    console.error('Error al poblar la base de datos:', error);
    res.status(500).json({ error: 'Error al poblar la base de datos' });
  }
});

module.exports = router;
