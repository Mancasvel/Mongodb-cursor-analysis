# Gestión de Cursores MongoDB

Aplicación web desarrollada con Node.js, Express, MongoDB Atlas y EJS para realizar operaciones CRUD sobre una colección de cursores.

## Características

- Conexión a MongoDB Atlas
- Operaciones CRUD completas (Crear, Leer, Actualizar, Eliminar)
- Interfaz web responsive usando Bootstrap
- Paginación de resultados
- Validación de formularios
- Manejo de errores
- Dashboard de monitoreo de rendimiento en tiempo real
- Benchmark de diferentes tipos de consultas MongoDB
- Análisis y visualización de cursores MongoDB

## Requisitos

- Node.js (v14.x o superior)
- NPM o Yarn
- Cuenta en MongoDB Atlas

## Instalación

1. Clona el repositorio:
   ```
   git clone https://github.com/tu-usuario/cursores-mongodb-app.git
   cd cursores-mongodb-app
   ```

2. Instala las dependencias:
   ```
   npm install
   ```

3. Crea un archivo `.env` en la raíz del proyecto con la siguiente información:
   ```
   PORT=3000
   MONGODB_URI=mongodb+srv://tu-usuario:tu-contraseña@tu-cluster.mongodb.net/cursoresDB?retryWrites=true&w=majority
   ```
   
   Reemplaza los valores de conexión a MongoDB Atlas con los de tu cuenta.

## Uso

1. Inicia la aplicación:
   ```
   npm start
   ```

2. Abre tu navegador y visita: `http://localhost:3000`

3. Para desarrollo con recarga automática, usa:
   ```
   npm run dev
   ```

## Estructura del Proyecto

```
.
├── app.js                 # Archivo principal
├── models/                # Modelos de Mongoose
│   └── Cursor.js          # Modelo de cursor
├── middleware/            # Middleware personalizado
│   └── performance.js     # Monitoreo de rendimiento
├── views/                 # Vistas EJS
│   ├── layouts/           # Layouts para las vistas
│   ├── cursores/          # Vistas para cursores
│   ├── dashboard/         # Vistas para dashboard
│   ├── error.ejs          # Página de error
│   └── home.ejs           # Página principal
├── public/                # Archivos estáticos
│   ├── css/               # Hojas de estilo
│   ├── js/                # Scripts de cliente
│   └── images/            # Imágenes
├── routes/                # Definición de rutas
│   ├── cursores.js        # Rutas para cursores
│   └── dashboard.js       # Rutas para dashboard
├── package.json           # Dependencias y scripts
└── .env                   # Variables de entorno
```

## Operaciones Disponibles

- **GET /cursores**: Muestra la lista de todos los cursores con paginación
- **GET /cursores/nuevo**: Muestra el formulario para crear un nuevo cursor
- **POST /cursores**: Crea un nuevo cursor
- **GET /cursores/:id/editar**: Muestra el formulario para editar un cursor
- **PUT /cursores/:id**: Actualiza un cursor existente
- **DELETE /cursores/:id**: Elimina un cursor
- **GET /cursores/:id/ejecutar**: Ejecuta un cursor y muestra estadísticas detalladas

## Dashboard de Análisis de Cursores MongoDB

La aplicación incluye un completo dashboard para analizar el rendimiento de las consultas de MongoDB:

### Funcionalidades del Dashboard

- **Monitoreo en tiempo real**: Visualiza estadísticas de rendimiento de consultas MongoDB
- **Métricas principales**: Total de consultas, tiempo promedio, tiempo máximo y conteo de cursores
- **Gráficos de rendimiento**: Visualiza tiempos de consulta y distribución por tipo de operación
- **Análisis de consultas recientes**: Tabla detallada con las últimas consultas ejecutadas
- **Benchmark de consultas**: Ejecuta pruebas de rendimiento para varios tipos de consultas:
  - Consultas básicas
  - Consultas con ordenamiento
  - Consultas con paginación (skip y limit)
  - Conteo de documentos
  - Operaciones de agregación

### Logging de Rendimiento

El sistema registra automáticamente información detallada sobre cada consulta:

```
Mongoose: cursors.find({}, { sort: { fechaCreacion: -1 }, skip: 0, limit: 10 })
GET /cursores - 171.68ms

Mongoose: cursors.aggregate([ { '$group': { _id: '$ciudad', count: { '$sum': 1 } } }], {})
Mongoose: cursors.find({}, { limit: 5 })
Mongoose: cursors.find({}, { sort: { fechaCreacion: -1 }, limit: 10 })
Mongoose: cursors.find({}, { skip: 2, limit: 3 })
Mongoose: cursors.countDocuments({}, {})
POST /dashboard/benchmark - 415.69ms
```

### Simulación de Cursores MongoDB

La aplicación incluye una funcionalidad educativa para simular el comportamiento real de los cursores de MongoDB:

- Procesamiento por lotes (batch size)
- Evaluación diferida (lazy evaluation)
- Métricas como documentos examinados vs. retornados
- Uso de índices
- Tiempo de ejecución

## Licencia

ISC 