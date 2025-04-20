# Gestión de Cursores MongoDB

Aplicación web desarrollada con Node.js, Express, MongoDB Atlas y EJS para realizar operaciones CRUD sobre una colección de cursores.

## Características

- Conexión a MongoDB Atlas
- Operaciones CRUD completas (Crear, Leer, Actualizar, Eliminar)
- Interfaz web responsive usando Bootstrap
- Paginación de resultados
- Validación de formularios
- Manejo de errores

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
├── app.js              # Archivo principal
├── models/             # Modelos de Mongoose
│   └── Cursor.js       # Modelo de cursor
├── views/              # Vistas EJS
│   ├── layouts/        # Layouts para las vistas
│   ├── cursores/       # Vistas para cursores
│   ├── error.ejs       # Página de error
│   └── home.ejs        # Página principal
├── public/             # Archivos estáticos
│   ├── css/            # Hojas de estilo
│   └── js/             # Scripts de cliente
├── routes/             # Definición de rutas
│   └── cursores.js     # Rutas para cursores
├── package.json        # Dependencias y scripts
└── .env                # Variables de entorno
```

## Operaciones Disponibles

- **GET /cursores**: Muestra la lista de todos los cursores con paginación
- **GET /cursores/nuevo**: Muestra el formulario para crear un nuevo cursor
- **POST /cursores**: Crea un nuevo cursor
- **GET /cursores/:id/editar**: Muestra el formulario para editar un cursor
- **PUT /cursores/:id**: Actualiza un cursor existente
- **DELETE /cursores/:id**: Elimina un cursor

## Licencia

ISC 