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

// Ruta para comparar rendimiento
router.get('/comparar', async (req, res) => {
  try {
    // Obtener ciudades disponibles para el filtro
    const ciudades = await Cursor.distinct('ciudad');
    
    // Obtener el límite de documentos de la consulta (por defecto 5000)
    const limit = parseInt(req.query.limit) || 5000;
    const batchSize = parseInt(req.query.batchSize) || 1000; // Tamaño de lote óptimo
    
    // Registramos el tiempo inicial para la consulta directa
    const startDirect = process.hrtime();
    
    // Ejecutamos una consulta directa sin cursor (carga todo en memoria)
    const resultDirect = await Cursor.find({}).limit(limit).lean();
    
    // Calculamos el tiempo de ejecución para la consulta directa
    const endDirect = process.hrtime(startDirect);
    const timeDirect = (endDirect[0] * 1e9 + endDirect[1]) / 1e6; // Convertimos a milisegundos
    
    // Registramos el tiempo inicial para la agregación
    const startAggregation = process.hrtime();
    
    // Ejecutamos una agregación sin cursor (carga todo en memoria)
    const resultAggregation = await Cursor.aggregate([
      { $match: {} },
      { $limit: limit }
    ]);
    
    // Calculamos el tiempo de ejecución para la agregación
    const endAggregation = process.hrtime(startAggregation);
    const timeAggregation = (endAggregation[0] * 1e9 + endAggregation[1]) / 1e6;
    
    // Registramos el tiempo inicial para el cursor
    const startCursor = process.hrtime();
    
    // Creamos un cursor optimizado para la consulta con un batch size adecuado
    // Nota: en MongoDB los cursores por defecto tienen un batch size de 100
    const cursor = Cursor.find({}).lean().cursor({ batchSize });
    
    // Variables para el proceso del cursor
    let count = 0;
    let resultCursor = [];
    
    // Procesamos el cursor manualmente con for-await
    for await (const doc of cursor) {
      resultCursor.push(doc);
      count++;
      if (count >= limit) break;
    }
    
    // Calculamos el tiempo de ejecución para el cursor
    const endCursor = process.hrtime(startCursor);
    const timeCursor = (endCursor[0] * 1e9 + endCursor[1]) / 1e6;
    
    // Registramos el tiempo para la agregación con cursor
    const startAggCursor = process.hrtime();
    
    // Usamos cursor para la agregación con la sintaxis correcta
    const aggCursor = Cursor.aggregate([
      { $match: {} },
      { $limit: limit }
    ]).cursor({ batchSize });  // La sintaxis correcta para cursor de agregación
    
    // Variables para el proceso del cursor de agregación
    let countAgg = 0;
    let resultAggCursor = [];
    
    // Procesamos el cursor de agregación
    for await (const doc of aggCursor) {
      resultAggCursor.push(doc);
      countAgg++;
      if (countAgg >= limit) break;
    }
    
    // Calculamos el tiempo de ejecución para el cursor de agregación
    const endAggCursor = process.hrtime(startAggCursor);
    const timeAggCursor = (endAggCursor[0] * 1e9 + endAggCursor[1]) / 1e6;
    
    // Renderizamos la vista con los resultados
    res.render('dashboard/comparar', {
      title: 'Comparación de Rendimiento',
      timeDirect,
      timeAggregation,
      timeCursor,
      timeAggCursor,
      countDirect: resultDirect.length,
      countAggregation: resultAggregation.length,
      countCursor: resultCursor.length,
      countAggCursor: resultAggCursor.length,
      limit,
      batchSize,
      ciudades
    });
    
  } catch (error) {
    console.error('Error al comparar rendimiento:', error);
    // Reemplazar req.flash que no está disponible con un redirect simple
    // req.flash('error', 'Error al realizar la comparación de rendimiento');
    res.status(500).render('error', {
      message: 'Error al realizar la comparación de rendimiento',
      error
    });
  }
});

// Ruta para poblar la BD con datos de prueba
router.post('/poblar', async (req, res) => {
  try {
    const { cantidad, ciudades } = req.body;
    
    // Validación básica
    if (!cantidad || cantidad < 1 || cantidad > 100000) {
      return res.status(400).json({ error: 'La cantidad debe estar entre 1 y 100000' });
    }
    
    if (!ciudades || !Array.isArray(ciudades) || ciudades.length === 0) {
      return res.status(400).json({ error: 'Debes seleccionar al menos una ciudad' });
    }
    
    // Datos para generar documentos aleatorios
    const nombres = ['Ana', 'Pedro', 'María', 'Juan', 'Lucía', 'Carlos', 'Sofía', 'Miguel', 'Laura', 'Pablo', 
                    'Elena', 'Javier', 'Carmen', 'David', 'Raquel', 'Antonio', 'Isabel', 'Francisco', 'Sara', 'Manuel',
                    'Cristina', 'José', 'Patricia', 'Luis', 'Rosa', 'Daniel', 'Marta', 'Alejandro', 'Beatriz', 'Fernando'];
    
    const apellidos = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
                      'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez', 'Navarro'];
    
    // Fecha de inicio (hace 1 año)
    const fechaInicio = new Date();
    fechaInicio.setFullYear(fechaInicio.getFullYear() - 1);
    
    // Tamaño del lote para inserción eficiente
    const batchSize = 1000;
    let totalInsertados = 0;
    
    console.time('Tiempo de inserción');
    
    // Insertar documentos en lotes para mayor eficiencia
    for (let i = 0; i < cantidad; i += batchSize) {
      // Determinar tamaño del lote actual
      const currentBatchSize = Math.min(batchSize, cantidad - i);
      const documentos = [];
      
      // Generar datos aleatorios para este lote
      for (let j = 0; j < currentBatchSize; j++) {
        const nombre = nombres[Math.floor(Math.random() * nombres.length)];
        const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
        const edad = Math.floor(Math.random() * 60) + 18; // Edades entre 18 y 77
        const ciudad = ciudades[Math.floor(Math.random() * ciudades.length)];
        
        // Fecha aleatoria en el último año
        const fechaAleatoria = new Date(fechaInicio.getTime() + Math.random() * (Date.now() - fechaInicio.getTime()));
        
        documentos.push({
          nombre: `${nombre} ${apellido}`,
          edad,
          ciudad,
          fechaCreacion: fechaAleatoria
        });
      }
      
      // Insertar lote actual
      await Cursor.insertMany(documentos, { ordered: false });
      totalInsertados += documentos.length;
      
      // Actualizar progreso en consola
      console.log(`Progreso: ${Math.min(i + batchSize, cantidad)}/${cantidad} documentos insertados`);
    }
    
    console.timeEnd('Tiempo de inserción');
    
    // Contar total de documentos en la colección
    const totalDocumentos = await Cursor.countDocuments();
    
    // Enviar respuesta
    res.json({
      success: true,
      mensaje: `Se han creado ${totalInsertados} documentos nuevos (${cantidad} solicitados)`,
      totalDocumentos,
      documentosCreados: totalInsertados
    });
    
  } catch (error) {
    console.error('Error al poblar la base de datos:', error);
    res.status(500).json({ error: 'Error al poblar la base de datos' });
  }
});

module.exports = router;
