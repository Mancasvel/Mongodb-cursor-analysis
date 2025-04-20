require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');
const { performance } = require('perf_hooks');

// Importar middleware de performance
const { setupPerformanceMonitoring, responseTimeMiddleware } = require('./middleware/performance');

// Importar rutas
const cursoresRoutes = require('./routes/cursores');
const dashboardRoutes = require('./routes/dashboard');

// Crear la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;

// Conexión a MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('Conexión exitosa a MongoDB Atlas');
    // Configurar monitoreo de rendimiento después de conectar
    setupPerformanceMonitoring();
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB Atlas:', err);
  });

// Configurar middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method')); // Para poder usar PUT y DELETE en formularios
app.use(express.static(path.join(__dirname, 'public')));
app.use(responseTimeMiddleware); // Middleware para medir tiempo de respuesta

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Middleware para pasar información común a todas las vistas
// Este middleware se ejecutará en TODAS las solicitudes
app.use((req, res, next) => {
  // Agregar la URL actual para resaltar el ítem activo en el menú
  res.locals.currentUrl = req.originalUrl;
  // Continuar con el siguiente middleware
  next();
});

// Rutas
app.get('/', (req, res) => {
  res.render('home', { layout: 'layouts/main' });
});

app.use('/cursores', cursoresRoutes);
app.use('/dashboard', dashboardRoutes);

// Ruta 404 para manejar páginas no encontradas
app.use((req, res) => {
  res.status(404).render('error', { 
    message: 'Página no encontrada',
    layout: 'layouts/main'
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { 
    message: 'Error interno del servidor',
    error: err,
    layout: 'layouts/main'
  });
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
  console.log(`Abrir en navegador: http://localhost:${PORT}`);
}); 