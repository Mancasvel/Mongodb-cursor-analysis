# Gestión y Análisis de Cursores MongoDB

Aplicación web avanzada para la gestión, análisis y optimización de cursores en MongoDB Atlas, con soporte para lenguaje natural, benchmarking, dashboards interactivos y módulos de IA.

---

## Características Principales

- **CRUD de Cursores**: Gestión completa de documentos con Express, Mongoose y MongoDB Atlas.
- **Dashboards Interactivos**: Visualización y comparación de rendimiento de diferentes técnicas de consulta y cursor.
- **Benchmarking Automatizado**: Scripts y endpoints para pruebas de rendimiento y consumo de memoria.
- **Optimización de Cursores**: Batch size dinámico, proyección, cierre explícito, manejo de errores y cursores tailable.
- **MCP (Model Context Protocol)**: Servidor de IA que convierte lenguaje natural (y consultas multimodales con imágenes) en operaciones MongoDB reales, vía REST y WebSocket.
- **Integración con cursor.sh**: Extensión Tampermonkey para enviar consultas en lenguaje natural desde cursor.sh (no terminado, además cursor consigue de forma nativa con su manejo de MCP conectarse a MongoDB Atlas solo con la configuracion del .json).
- **Cliente CLI**: Interfaz de línea de comandos para interactuar con MCP.

---

## Estructura del Proyecto

```
.
├── app.js                  # App principal Express
├── models/
│   └── Cursor.js           # Modelo de cursor
├── middleware/
│   └── performance.js      # Monitoreo y logging de rendimiento
├── routes/
│   ├── cursores.js         # Rutas CRUD y ejecución de cursores
│   └── dashboard.js        # Dashboards de análisis y comparación
├── views/
│   ├── layouts/            # Layout principal
│   ├── cursores/           # Vistas CRUD
│   ├── dashboard/          # Dashboards: comparar, queries, poblar
│   └── home.ejs            # Página principal
├── public/
│   ├── css/                # Estilos
│   ├── js/                 # Scripts cliente
│   └── images/             # Imágenes
├── mcp/                    # Módulo Model Context Protocol
│   ├── mcpServer.js        # Servidor MCP
│   ├── services/           # NLP, DB y WebSocket services
│   ├── routes/             # Endpoints REST MCP
│   ├── cursor-client.js    # Cliente CLI
│   ├── cursor-extension.js # Extensión para cursor.sh
│   └── README.md           # Documentación MCP
├── performance_monitor.js  # Monitorización y benchmarking automático
├── optimize_cursors.js     # Script de optimización de cursores
├── tailable_cursor_example.js # Ejemplo de cursor tailable
├── ... (más scripts de test y análisis)
├── package.json            # Dependencias y scripts
└── .env-example            # Variables de entorno
```

---

## Instalación y Configuración

1. Clona el repositorio y entra en la carpeta:
   ```
   git clone https://github.com/Mancasvel/Mongodb-cursor-analysis.git
   cd cursores-mongodb-app
   ```
2. Instala dependencias:
   ```
   npm install
   ```
3. Configura `.env` (ver `.env-example`).
4. Inicia la app principal:
   ```
   npm start
   # o en desarrollo
   npm run dev
   ```
5. Inicia el servidor MCP (opcional, para IA):
   ```
   npm run mcp
   # o en desarrollo
   npm run mcp:dev
   ```

---

## Comandos y Scripts Relevantes

- `npm start`         → Inicia la app web principal
- `npm run dev`       → App con recarga automática
- `npm run mcp`       → Servidor MCP (IA, lenguaje natural)
- `npm run mcp:dev`   → MCP en modo desarrollo
- `npm run mcp:client`→ Cliente CLI para MCP

---

## Dashboards y Visualizaciones

- **Comparación de Técnicas**: Dashboard para comparar rendimiento de consultas directas, agregaciones, cursores nativos y optimizados.
- **Queries y Poblar**: Dashboards para lanzar queries personalizadas y poblar la base de datos con datos de prueba.
- **Gráficos y Métricas**: Visualización de tiempos, uso de memoria, lotes procesados, uso de índices, etc.

---

## Benchmarking y Optimización

- **Scripts de Test**: `performance_monitor.js`, `test_api.js`, `native_driver_test.js`, `cursor_iteration_test.js`, `direct_test.js`, etc.
- **Optimización de Cursores**: Uso de batch size óptimo, proyección, cierre explícito, manejo de errores (CursorNotFound), y chunking para grandes volúmenes.
- **Cursores Tailable**: Ejemplo de uso en `tailable_cursor_example.js` para colecciones capped y monitoreo en tiempo real.
- **Comparativas**: Resultados y hallazgos en los archivos `.md` como `mongodb_cursor_optimization_findings.md`, `optimized_cursor_report.md`, etc.

---

## MCP: Model Context Protocol (IA y Lenguaje Natural)

- **Servidor MCP**: Convierte instrucciones en lenguaje natural (y con imágenes) en operaciones MongoDB reales.
- **API REST**: `/api/mcp/query`, `/api/mcp/collections/:name/metadata`, `/api/mcp/sessions/:sessionId`
- **WebSocket**: Comunicación bidireccional, soporte de contexto y consultas multimodales.
- **Cliente CLI**: `npm run mcp:client` para interactuar desde terminal.

- **Servicios**: NLP (OpenRouter), DB, WebSocket, gestión de contexto y sesiones.

---

## Buenas Prácticas y Recomendaciones

- **Batch Size Óptimo**: Ajusta el tamaño de lote según el tamaño de documento y memoria disponible (ver scripts y rutas).
- **Proyección**: Limita los campos retornados para reducir uso de memoria y red.
- **Cierre Explícito**: Cierra los cursores siempre que sea posible (`cursor.close()`).
- **Manejo de Errores**: Controla errores como `CursorNotFound` y reintenta si es necesario.
- **Uso de global.gc()**: Para mediciones precisas de memoria y tiempo, ejecuta la app con:
  ```
  node --expose-gc app.js
  ```
  Así puedes forzar la recolección de basura y obtener métricas realistas.
- **Cursores Tailable**: Úsalos para monitoreo en tiempo real sobre colecciones capped.
- **Comparar Técnicas**: Usa los dashboards y scripts para comparar rendimiento entre métodos (directo, agregación, cursor, etc.).

---

## Hallazgos y Resultados Clave

- **Mongoose vs Native Driver**: Usar `.lean()` con Mongoose puede ser más rápido que el driver nativo para ciertos casos.
- **Batch Size**: Un batch size de 500-1000 es óptimo para la mayoría de los casos.
- **Iteración**: Métodos como `for-await`, `hasNext/next`, y `forEach` son muy similares en rendimiento para lotes grandes.
- **Proyección y Chunking**: Reducen drásticamente el uso de memoria y mejoran el rendimiento.
- **Tailable Cursors**: Ideales para monitoreo en tiempo real de logs/eventos.

---

## Documentación y Recursos

- [MongoDB_Cursors.md](MongoDB_Cursors.md): Guía completa de cursores MongoDB
- [mongodb_cursor_optimization_findings.md](mongodb_cursor_optimization_findings.md): Hallazgos de optimización
- [optimized_cursor_report.md](optimized_cursor_report.md): Reporte de optimización
- [improvements.md](improvements.md): Mejoras y recomendaciones
- [mcp/README.md](mcp/README.md): Documentación completa de MCP

---

## Licencia

ISC 

