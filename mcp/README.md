# MongoDB MCP (Model Context Protocol)

Este es un servidor que permite interactuar con MongoDB Atlas mediante lenguaje natural o instrucciones de texto simples.

## Características

- **Procesamiento de Lenguaje Natural**: Interpreta comandos en lenguaje natural y los convierte en operaciones de MongoDB.
- **Soporte para Consultas Multimodales**: Procesa imágenes junto con texto para extraer información relevante.
- **Mantenimiento de Contexto**: Mantiene el contexto de conversaciones por sesión.
- **API REST**: Expone endpoints para interactuar con el MCP desde cualquier aplicación.
- **WebSocket**: Permite una comunicación bidireccional en tiempo real.
- **Integración con cursor.sh**: Incluye una extensión/script para integrar MCP con cursor.sh.
- **Potenciado por OpenRouter**: Utiliza modelos avanzados de diferentes proveedores a través de OpenRouter.

## Requisitos

- Node.js (v14 o superior)
- MongoDB Atlas (o MongoDB local)
- API Key de OpenRouter (para el procesamiento de lenguaje natural)

## Configuración

1. Asegúrate de tener un archivo `.env` en la raíz del proyecto con las siguientes variables:

```
# MongoDB
MONGODB_URI=tu_uri_de_mongodb_atlas

# Servidor
PORT=3000
MCP_PORT=3001
MCP_HOST=localhost

# OpenRouter
OPENROUTER_API_KEY=tu_openrouter_api_key_aqui
OPENROUTER_MODEL=google/gemma-3-27b-it:free
SITE_URL=http://localhost:3001
SITE_NAME=MongoDB-MCP
```

2. Obtén una API key de [OpenRouter](https://openrouter.ai/) y colócala en el archivo `.env`.

## Uso

### Iniciar el servidor MCP

```bash
npm run mcp
```

O en modo desarrollo con reinicio automático:

```bash
npm run mcp:dev
```

### Usar el cliente de línea de comandos

```bash
npm run mcp:client
```

En el cliente de línea de comandos, puedes usar estos comandos especiales:
- `!reset`: Resetea el contexto de la conversación
- `!image`: Inicia una consulta con imagen (te pedirá la URL)
- `!exit`: Sale del cliente

### Integración con cursor.sh

Para usar MCP desde cursor.sh:

1. Asegúrate de que el servidor MCP esté en ejecución.
2. Instala la extensión Tampermonkey en tu navegador.
3. Crea un nuevo script y copia el contenido de `cursor-extension.js`.
4. Activa el script y visita cursor.sh.
5. Pulsa `Ctrl+Alt+M` para mostrar/ocultar el panel de MCP.
6. Usa el botón "Añadir Imagen" para incluir una imagen en tu consulta.

## API REST

### Enviar una consulta

```
POST /api/mcp/query
{
  "query": "muéstrame los últimos 10 cursos analizados",
  "sessionId": "opcional-para-mantener-contexto",
  "imageUrl": "https://ejemplo.com/imagen.jpg" // opcional
}
```

### Obtener metadatos de una colección

```
GET /api/mcp/collections/:nombre/metadata
```

### Eliminar una sesión

```
DELETE /api/mcp/sessions/:sessionId
```

## WebSocket

El servidor WebSocket está disponible en la misma dirección del servidor HTTP.

Mensajes que puedes enviar:

```json
{
  "type": "query",
  "query": "muéstrame los últimos 10 cursos analizados",
  "sessionId": "opcional",
  "imageUrl": "https://ejemplo.com/imagen.jpg" // opcional
}
```

```json
{
  "type": "reset_context"
}
```

## Operaciones actualmente implementadas

MCP puede interpretar lenguaje natural y convertirlo en operaciones MongoDB. Aquí están las operaciones que el sistema actualmente soporta:

### Operaciones de consulta (Query)

| Tipo | Operación | Descripción | Ejemplo de lenguaje natural |
|------|-----------|-------------|------------------------------|
| query | find | Buscar documentos con filtros | "Encuentra todos los cursores de Madrid" |
| query | findOne | Buscar un único documento | "Muéstrame el cursor con nombre Juan" |

#### Parámetros de consulta adicionales

| Parámetro | Descripción | Ejemplo de lenguaje natural |
|-----------|-------------|------------------------------|
| limit | Limitar resultados | "Muestra los 5 primeros cursores" |
| sort | Ordenar resultados | "Ordena los cursores por edad de mayor a menor" |
| project | Seleccionar campos | "Muestra solo el nombre y la edad de los cursores" |

### Operaciones de actualización (Update)

| Tipo | Operación | Descripción | Ejemplo de lenguaje natural |
|------|-----------|-------------|------------------------------|
| update | updateOne | Actualizar un documento | "Actualiza la edad de Juan a 30 años" |
| update | updateMany | Actualizar varios documentos | "Cambia la ciudad a 'Barcelona' para todos los cursores de Madrid" |

### Operaciones de inserción (Insert)

| Tipo | Operación | Descripción | Ejemplo de lenguaje natural |
|------|-----------|-------------|------------------------------|
| insert | insertOne | Insertar un documento | "Crea un nuevo cursor con nombre María, 25 años, de Barcelona" |
| insert | insertMany | Insertar varios documentos | "Añade estos 3 nuevos cursores a la base de datos" |

### Operaciones de eliminación (Delete)

| Tipo | Operación | Descripción | Ejemplo de lenguaje natural |
|------|-----------|-------------|------------------------------|
| delete | deleteOne | Eliminar un documento | "Elimina el cursor con ID 12345" |
| delete | deleteMany | Eliminar varios documentos | "Borra todos los cursores de más de 2 meses de antigüedad" |

### Operaciones de agregación (Aggregate)

| Tipo | Operación | Descripción | Ejemplo de lenguaje natural |
|------|-----------|-------------|------------------------------|
| aggregate | aggregate | Pipeline de agregación | "Agrupa los cursores por ciudad y muestra la cantidad en cada una" |

### Consultas con imágenes

El sistema puede procesar imágenes junto con consultas de texto gracias a los modelos multimodales de OpenRouter. El sistema extraerá información relevante de las imágenes y la utilizará para construir consultas MongoDB.

## Posibles extensiones futuras

Aquí hay algunas operaciones adicionales que podrías implementar para extender las capacidades del MCP:

### Operaciones de estadísticas y análisis

- **count**: Contar documentos que coinciden con un criterio
- **distinct**: Obtener valores únicos de un campo
- **Análisis avanzado**: Funciones de agregación más complejas como promedio, mínimo, máximo, etc.

### Operaciones geoespaciales

- **geoNear**: Búsqueda por proximidad geográfica
- **geoWithin**: Búsqueda dentro de un área geográfica

### Operaciones de índices

- **listIndexes**: Listar índices de una colección
- **createIndex**: Crear un nuevo índice
- **dropIndex**: Eliminar un índice existente

### Operaciones administrativas

- **listCollections**: Listar colecciones en la base de datos
- **createCollection**: Crear una nueva colección
- **dropCollection**: Eliminar una colección
- **backupData**: Exportar datos como backup

## Ejemplos de consultas

- "Muéstrame los últimos 10 cursores analizados"
- "¿Cuántos cursores hay de la ciudad de Madrid?"
- "Elimina todos los datos del cursor con ID 12345"
- "Actualiza la edad del cursor con nombre Juan a 30 años"
- "Crea un nuevo cursor con nombre María, 25 años, de Barcelona"
- "Agrupa los cursores por ciudad y muéstrame cuántos hay en cada una"

### Consultas con imágenes

- "Identifica los elementos en esta imagen y busca cursores relacionados"
- "Extrae el texto de esta imagen y busca cursores que lo contengan"
- "Analiza esta imagen y crea un cursor con la información encontrada"
- "Esta imagen contiene un ID de cursor, encuéntralo y muéstrame sus datos"

## Acerca de OpenRouter

El sistema utiliza [OpenRouter](https://openrouter.ai/) como proveedor de modelos de inteligencia artificial. OpenRouter te permite acceder a una variedad de modelos de diferentes proveedores, incluyendo:

- Google Gemma
- Anthropic Claude
- Mistral AI
- Y muchos otros

Entre las ventajas de usar OpenRouter están:
- Acceso a modelos con capacidades multimodales (procesamiento de imágenes)
- Menor costo en comparación con APIs directas
- Posibilidad de cambiar entre diferentes modelos fácilmente

## Solución de problemas

- **Error de conexión a MongoDB**: Verifica tu URI de conexión en el archivo `.env`.
- **Error de API Key**: Asegúrate de haber configurado correctamente tu API Key de OpenRouter.
- **El cliente WebSocket no se conecta**: Verifica que el servidor MCP esté en ejecución y el puerto sea accesible.
- **Problemas con imágenes**: Asegúrate de que la URL de la imagen sea accesible públicamente y sea un formato válido (JPG, PNG, etc.).

## Licencia

ISC 