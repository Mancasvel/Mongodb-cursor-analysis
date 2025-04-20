require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const ejsLayouts = require('express-ejs-layouts');

// Importar rutas
const cursoresRoutes = require('./routes/cursores');

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
  })
  .catch((err) => {
    console.error('Error al conectar a MongoDB Atlas:', err);
  });

// Configurar middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method')); // Para poder usar PUT y DELETE en formularios
app.use(express.static(path.join(__dirname, 'public')));

// Configurar EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(ejsLayouts);
app.set('layout', 'layouts/main');

// Rutas
app.get('/', (req, res) => {
  res.render('home', { layout: 'layouts/main' });
});

app.use('/cursores', cursoresRoutes);

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