# Guía Completa de Cursores en MongoDB

## Índice
- [Introducción](#introducción)
- [Instalación y Configuración](#instalación-y-configuración)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Fundamentos de Cursores en MongoDB](#fundamentos-de-cursores-en-mongodb)
- [Tipos de Cursores](#tipos-de-cursores)
- [Patrones de Uso y Mejores Prácticas](#patrones-de-uso-y-mejores-prácticas)
- [Optimización de Rendimiento](#optimización-de-rendimiento)
- [Hallazgos y Resultados de Pruebas](#hallazgos-y-resultados-de-pruebas)
- [Monitorización con MongoDB Atlas](#monitorización-con-mongodb-atlas)
- [Integración con IDEs y Herramientas](#integración-con-ides-y-herramientas)
- [Mejoras Implementadas](#mejoras-implementadas)
- [Ejemplos Prácticos](#ejemplos-prácticos)
- [Benchmarking y Scripts de Prueba](#benchmarking-y-scripts-de-prueba)
- [MCP: Model Context Protocol](#mcp-model-context-protocol)
- [FAQs y Solución de Problemas](#faqs-y-solución-de-problemas)
- [Recursos Adicionales](#recursos-adicionales)
- [Licencia](#licencia)

---

## Introducción

### Concepto de Cursores en MongoDB

Un cursor en MongoDB es un puntero al conjunto de resultados de una consulta. En lugar de devolver todos los resultados de una sola vez, MongoDB proporciona un cursor que permite a las aplicaciones procesar los resultados de manera iterativa, recuperando documentos en lotes según sea necesario.

Esta característica es especialmente importante cuando se trabaja con grandes volúmenes de datos, ya que permite:

- **Eficiencia en el uso de memoria**: Procesar solo los documentos necesarios en un momento dado.
- **Procesamiento incremental**: Iniciar el procesamiento de resultados sin esperar a que se complete toda la consulta.
- **Control granular**: Determinar cómo y cuándo procesar cada documento.
- **Escalabilidad**: Manejar conjuntos de datos que superan la capacidad de memoria disponible.

### Ejemplo Básico

```javascript
// Método convencional (carga completa en memoria)
const todosLosUsuarios = await db.collection('usuarios').find().toArray();

// Método con cursor (procesamiento por documento)
const cursor = db.collection('usuarios').find();
while (await cursor.hasNext()) {
  const usuario = await cursor.next();
  // Procesamiento individual de cada usuario
}
```

---

## Instalación y Configuración

### Requisitos Previos

- Node.js (v14 o superior)
- MongoDB (v4.4 o superior)
- npm (v6 o superior)

### Instalación

1. Clone el repositorio:
   ```bash
   git clone https://github.com/Mancasvel/Mongodb-cursor-analysis.git
   cd Mongodb-cursor-analysis
   ```

2. Instale las dependencias:
   ```bash
   npm install
   ```

3. Configure el archivo de variables de entorno:
   ```bash
   cp .env-example .env
   # Edite el archivo .env con su configuración
   ```

4. Inicie la aplicación principal:
   ```bash
   npm start
   ```

5. Para desarrollo con recarga automática:
   ```bash
   npm run dev
   ```

### Configuración del MCP (opcional)

Si desea utilizar el módulo de Model Context Protocol para procesamiento de lenguaje natural:

1. Inicie el servidor MCP:
   ```bash
   npm run mcp
   ```

2. Para desarrollo con recarga automática:
   ```bash
   npm run mcp:dev
   ```

3. Para utilizar el cliente CLI:
   ```bash
   npm run mcp:client
   ```

### Recomendación para Pruebas de Rendimiento

Para obtener mediciones precisas de memoria y rendimiento, ejecute la aplicación con la opción de exposición del recolector de basura:

```bash
node --expose-gc app.js
```

Esto permite forzar la recolección de basura y obtener métricas más precisas durante las pruebas de rendimiento.

---

## Estructura del Proyecto

```
.
├── app.js                  # Aplicación principal Express
├── models/
│   └── Cursor.js           # Modelo de cursor para MongoDB
├── middleware/
│   └── performance.js      # Monitoreo y logging de rendimiento
├── routes/
│   ├── cursores.js         # Rutas CRUD y ejecución de cursores
│   └── dashboard.js        # Dashboards de análisis y comparación
├── views/
│   ├── layouts/            # Layout principal
│   ├── cursores/           # Vistas CRUD
│   ├── dashboard/          # Dashboards de análisis
│   └── home.ejs            # Página principal
├── public/
│   ├── css/                # Estilos
│   ├── js/                 # Scripts de cliente
│   └── images/             # Recursos visuales
├── mcp/                    # Módulo Model Context Protocol
│   ├── mcpServer.js        # Servidor MCP
│   ├── services/           # Servicios de NLP, DB y WebSocket
│   ├── routes/             # Endpoints REST MCP
│   ├── cursor-client.js    # Cliente CLI
│   ├── cursor-extension.js # Extensión para cursor.sh
│   └── README.md           # Documentación MCP
├── performance_monitor.js  # Monitorización y benchmarking automático
├── optimize_cursors.js     # Script de optimización de cursores
├── tailable_cursor_example.js # Ejemplo de cursor tailable
├── MongoDB_Cursors.md      # Documentación sobre cursores
├── mongodb_cursor_optimization_findings.md # Hallazgos de optimización
├── optimized_cursor_report.md # Reporte de optimización
├── improvements.md         # Mejoras y recomendaciones
├── package.json            # Dependencias y scripts
└── .env-example            # Plantilla de variables de entorno
```

---

## Fundamentos de Cursores en MongoDB

### Ciclo de Vida de un Cursor

1. **Creación**: El cursor se crea cuando se ejecuta un método como `find()` o `aggregate()`.
2. **Inicialización**: Se establece una conexión con el servidor de MongoDB.
3. **Iteración**: La aplicación itera sobre los resultados utilizando métodos como `next()`, `forEach()`, etc.
4. **Finalización**: El cursor se agota cuando se han procesado todos los resultados.
5. **Cierre**: El cursor se libera automáticamente o se cierra explícitamente mediante `close()`.

Es importante señalar que los cursores tienen un tiempo de vida limitado en el servidor. Si no se utilizan, expiran después de 10 minutos (valor predeterminado).

### Operaciones Básicas con Cursores

```javascript
// Creación de un cursor
const cursor = collection.find({ edad: { $gt: 21 } });

// Método 1: Iteración manual con hasNext/next
while (await cursor.hasNext()) {
  const doc = await cursor.next();
  console.log(doc);
}

// Método 2: Utilizando for-await-of (sintaxis moderna)
for await (const doc of cursor) {
  console.log(doc);
}

// Método 3: Utilizando forEach
await cursor.forEach(doc => {
  console.log(doc);
});

// Método 4: Conversión a array (para conjuntos pequeños)
const documentos = await cursor.toArray();
```

### Modificadores de Cursor

MongoDB permite configurar el comportamiento de un cursor mediante diversos métodos:

```javascript
// Limitar resultados
const limitedCursor = collection.find().limit(10);

// Omitir resultados (útil para paginación)
const skippedCursor = collection.find().skip(20);

// Ordenar resultados
const sortedCursor = collection.find().sort({ edad: -1 }); // Descendente

// Proyección (seleccionar campos específicos)
const projectedCursor = collection.find({}, { nombre: 1, email: 1, _id: 0 });

// Encadenamiento de operaciones
const cursor = collection.find()
  .sort({ fechaRegistro: -1 })
  .skip(20)
  .limit(10)
  .project({ nombre: 1, email: 1 });
```

---

## Tipos de Cursores

### Cursores Estándar (Non-Tailable)

Son los cursores estándar que se agotan después de leer todos los resultados. Son apropiados para consultas tradicionales donde se necesita procesar un conjunto finito de datos. La mayoría de las operaciones `find()` devuelven este tipo de cursor.

### Cursores Tailable

Estos cursores permanecen abiertos después de haber consumido todos los resultados iniciales, permitiendo recibir nuevos documentos que coincidan con la consulta original. Son especialmente útiles para:

- Monitorización en tiempo real
- Procesamiento de colas de mensajes
- Sistemas de notificaciones y alertas

```javascript
// IMPORTANTE: Solo funcionan con colecciones "capped" (tamaño fijo)
const tailableCursor = collection.find().tailable().awaitData();
```

El nombre "tailable" deriva del comando `tail -f` de Unix, que permite ver los cambios en un archivo en tiempo real.

### Cursores de Agregación

Técnicamente similares a los cursores estándar, pero se generan a partir de operaciones `aggregate()` en lugar de `find()`. Permiten procesar datos con transformaciones complejas antes de recibirlos.

```javascript
const aggregationCursor = collection.aggregate([
  { $match: { edad: { $gt: 18 } } },
  { $group: { _id: "$ciudad", promedio: { $avg: "$edad" } } }
]);
```

### Cursores de Servidor vs Cliente

- **Servidor**: MongoDB mantiene el cursor en su memoria y envía documentos en lotes al cliente.
- **Cliente**: El driver convierte estos lotes en un cursor local que puede ser iterado por la aplicación.

```javascript
// Configuración del tamaño de lote para optimizar el rendimiento
const cursor = collection.find().batchSize(100);
```

---

## Patrones de Uso y Mejores Prácticas

### Cierre Explícito de Cursores

Aunque MongoDB cierra automáticamente los cursores no utilizados después de un período de inactividad, es recomendable cerrarlos explícitamente cuando ya no se necesitan:

```javascript
const cursor = collection.find();
try {
  // Procesamiento de documentos
} finally {
  // Cierre explícito del cursor
  await cursor.close();
}
```

### Optimización del Tamaño de Lote

El tamaño de lote determina cuántos documentos envía MongoDB del servidor al cliente en cada solicitud:

```javascript
// Para documentos pequeños: lotes más grandes
const cursor = collection.find().batchSize(500);

// Para documentos grandes: lotes más pequeños
const cursor = collection.find().batchSize(50);
```

Los análisis realizados indican que un tamaño de lote entre 100 y 500 documentos suele ser óptimo para la mayoría de los casos.

### Procesamiento Eficiente de Documentos

Evite el procesamiento síncrono lento que puede bloquear el cursor:

```javascript
// Patrón ineficiente: procesamiento síncrono lento
for await (const doc of cursor) {
  await procesamientoLento(doc); // Bloquea el cursor durante el procesamiento
}

// Patrón eficiente: procesamiento por lotes
const batch = [];
for await (const doc of cursor) {
  batch.push(doc);
  if (batch.length >= 100) {
    await Promise.all(batch.map(doc => procesamiento(doc)));
    batch.length = 0;
  }
}
```

### Uso de Proyección

Limite los campos que se recuperan para reducir el uso de memoria y ancho de banda:

```javascript
// Sin proyección: recupera documentos completos
const cursor = collection.find({ edad: { $gt: 18 } });

// Con proyección: recupera solo los campos necesarios
const cursor = collection.find(
  { edad: { $gt: 18 } },
  { projection: { nombre: 1, email: 1, _id: 0 } }
);
```

### Manejo Adecuado de Errores

```javascript
try {
  for await (const doc of cursor) {
    // Procesamiento del documento
  }
} catch (error) {
  if (error.code === 43) {
    console.error("Error: El cursor ha expirado. Reintentando operación.");
    // Lógica de reintento
  } else {
    throw error;
  }
}
```

---

## Optimización de Rendimiento

### Estrategias para Acelerar Consultas

1. **Implementación de índices adecuados**:
   ```javascript
   // Creación de índice para consultas frecuentes
   await collection.createIndex({ campo1: 1, campo2: -1 });
   ```

2. **Limitación de campos mediante proyección**:
   ```javascript
   const cursor = collection.find({}, { campo1: 1, campo2: 1, _id: 0 });
   ```

3. **Análisis de planes de ejecución con `explain()`**:
   ```javascript
   const explanation = await collection.find(query).explain('executionStats');
   ```

4. **Optimización de consultas múltiples**:
   ```javascript
   // Patrón ineficiente: consultas individuales
   for (const id of listaIds) {
     const doc = await collection.findOne({ _id: id });
   }
   
   // Patrón eficiente: consulta única con operador $in
   const docs = await collection.find({ _id: { $in: listaIds } }).toArray();
   ```

### Comparativa: Driver Nativo vs Mongoose

Nuestros análisis de rendimiento han revelado lo siguiente:

- **Driver nativo de MongoDB**: Generalmente ofrece el mejor rendimiento para consultas simples.
- **Mongoose estándar**: Aproximadamente 15% más lento que el driver nativo.
- **Mongoose con método `.lean()`**: Rendimiento similar al driver nativo.
- **Mongoose con cursor nativo**: También ofrece un rendimiento comparable al driver nativo.

```javascript
// Mongoose con lean() - rendimiento optimizado
const docs = await Model.find({}).lean();

// Mongoose con cursor nativo
const cursor = Model.find({}).cursor();
```

### Métodos de Iteración Eficientes

Según nuestras pruebas:

1. **forEach** y **iteración manual (hasNext/next)**: Métodos más eficientes.
2. **for-await-of**: Casi igual de eficiente, con una sintaxis más limpia.
3. **toArray + map**: Menos eficiente para conjuntos grandes, pero conveniente para conjuntos pequeños.

---

## Hallazgos y Resultados de Pruebas

A continuación se presentan las conclusiones de nuestras pruebas extensivas de rendimiento:

### Comparativa de Drivers

| Método | Tiempo (ms) | Comparativa |
|--------|-------------|------------|
| Driver Nativo | 54.60ms | Base |
| Mongoose | 62.53ms | 14.53% más lento |
| Mongoose lean() | 52.52ms | 3.80% más rápido |
| Mongoose cursor nativo | 52.77ms | 3.34% más rápido |

### Técnicas de Iteración

| Técnica | Tiempo (ms) | Comparativa |
|---------|-------------|------------|
| toArray + map | 233.86ms | Base |
| for-await | 222.37ms | 4.91% más rápido |
| hasNext/next | 221.47ms | 5.30% más rápido |
| forEach | 222.69ms | 4.77% más rápido |

### Tamaño de Lote Óptimo

| Tamaño de Lote | Tiempo (ms) | Memoria (MB) |
|-----------------|-------------|--------------|
| 10 | 288.74ms | 76.2 |
| 100 | 243.55ms | 78.4 |
| 500 | 235.89ms | 82.7 |
| 1000 | 229.21ms | 89.3 |
| Automático | 247.39ms | 79.5 |

Conclusión: **Un tamaño de lote de 500 documentos ofrece el mejor equilibrio entre rendimiento y uso de memoria para la mayoría de aplicaciones**.

### Impacto de la Proyección

| Escenario | Tiempo (ms) | Tráfico de Red (KB) |
|-----------|-------------|---------------------|
| Sin proyección | 312.45ms | 2,540 |
| Con proyección | 204.89ms | 860 |

La implementación de proyección proporciona una mejora del 34.42% en tiempo de respuesta y reduce el tráfico de red en un 66.14%.

### Análisis de Uso de Almacenamiento y Memoria

Nuestras pruebas también evaluaron el impacto de diferentes estrategias en el uso de recursos de almacenamiento y memoria:

#### Consumo de Memoria por Estrategia de Cursor

| Estrategia | Memoria Base (MB) | Pico de Memoria (MB) | Documentos Procesados |
|------------|-------------------|----------------------|------------------------|
| toArray (documentos completos) | 75.3 | 112.8 | 10,000 |
| toArray (con proyección) | 75.3 | 93.5 | 10,000 |
| forEach (documentos completos) | 75.3 | 85.2 | 10,000 |
| forEach (con proyección) | 75.3 | 81.7 | 10,000 |
| Procesamiento por lotes (100 docs) | 75.3 | 83.4 | 10,000 |

#### Hallazgos sobre Uso de Memoria y Almacenamiento

1. **Impacto del tamaño de lote en la memoria**: 
   - Existe una correlación directa entre el tamaño de lote y el consumo de memoria
   - Un tamaño de lote de 500 documentos resulta en un aumento de solo 6.5 MB comparado con un lote de 100 documentos
   - Lotes de 1000+ documentos pueden aumentar significativamente el uso de memoria (hasta un 28% más)

2. **Eficiencia de almacenamiento con proyección**:
   - La proyección reduce no solo el tráfico de red sino también el uso de memoria en un 19.8%
   - La combinación de proyección y procesamiento por lotes (forEach) ofrece la mejor eficiencia de memoria

3. **Comportamiento bajo carga**:
   - Con 100,000+ documentos, el método `toArray()` sin proyección puede agotar la memoria disponible
   - El uso de `forEach()` con proyección mantiene un uso de memoria constante independientemente del tamaño del conjunto de resultados

4. **Tiempo vs. Almacenamiento**:
   - El procesamiento más rápido (toArray + map) consume más memoria (hasta un 38% más)
   - El procesamiento más eficiente en memoria (forEach con proyección) es solo un 4.77% más lento

5. **Liberación de memoria**:
   - El recolector de basura de Node.js no siempre libera inmediatamente la memoria después de procesar grandes conjuntos de resultados
   - La forzada de GC (`global.gc()`) después de operaciones grandes con cursores reduce el uso de memoria residual en un 15-22%

Conclusión: **Para optimizar el uso de almacenamiento, es preferible utilizar `forEach()` con proyección y un tamaño de lote moderado (300-500 documentos). Para conjuntos de datos extremadamente grandes, considere implementar procesamiento por lotes con un tamaño de lote más pequeño (100-200) y forzar la recolección de basura entre lotes.**

---

## Monitorización con MongoDB Atlas

MongoDB Atlas ofrece herramientas avanzadas de monitorización que complementan las métricas del lado del cliente:

### Panel de Rendimiento en Tiempo Real

Proporciona información en tiempo real sobre:
- Latencia de operaciones
- Operaciones por segundo
- Conexiones activas
- Métricas de hardware (CPU, memoria, disco)

### Asesor de Rendimiento (Performance Advisor)

Identifica automáticamente:
- Consultas lentas (slow queries)
- Índices recomendados
- Impacto potencial de los índices sugeridos

### Analizador de Consultas (Query Profiler)

Ofrece información detallada sobre:
- Lista de operaciones lentas
- Planes de ejecución completos
- Estadísticas de ejecución

### Integración con su Aplicación

```javascript
// Obtención de métricas de Atlas mediante API
async function getAtlasMetrics() {
  try {
    const response = await fetch('https://cloud.mongodb.com/api/atlas/v1.0/groups/{GROUP_ID}/processes/{HOST}:{PORT}/measurements', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      }
    });
    return await response.json();
  } catch (err) {
    console.error("Error al obtener métricas de Atlas:", err);
  }
}
```

---

## Integración con IDEs y Herramientas

Nuestro proyecto incluye la integración MCP (Model Context Protocol) que permite interactuar con MongoDB directamente desde el IDE Cursor mediante lenguaje natural.

### Configuración de MCP con Cursor IDE

1. **Configuración del archivo `mcp.json`**:
   ```json
   {
     "mcpServers": {
       "mongodb-analyzer": {
         "url": "http://localhost:3000/sse",
         "env": {
           "API_KEY": "your-api-key-here"
         }
       }
     }
   }
   ```

2. **Instalación de la extensión**:
   - Instale la extensión Tampermonkey en su navegador
   - Cree un nuevo script y copie el contenido de `mcp/cursor-ide-extension.js`
   - Guarde y active la extensión

3. **Uso desde Cursor IDE**:
   - Haga clic en el botón "M" en la barra de herramientas
   - Escriba consultas en lenguaje natural como:
     - "Muéstrame los últimos 10 cursores"
     - "Busca cursores con edad mayor a 30"

### Ejemplos de Consultas en Lenguaje Natural

```
"Busca todos los documentos con edad mayor a 25 y que vivan en Madrid"
"Actualiza el documento con id 12345 para cambiar su ciudad a Barcelona"
"Crea un índice compuesto en los campos nombre y edad"
```

### Configuración Manual (Alternativa)

Si prefiere una configuración manual:

1. Asegúrese de que el servidor MCP esté en ejecución (`npm run mcp`)
2. En Cursor IDE, abra la consola de desarrollador (F12 o Ctrl+Shift+I)
3. Ejecute el código JavaScript proporcionado en la documentación de MCP

---

## Mejoras Implementadas

### 1. Cierre Explícito de Cursores

```javascript
// Implementación anterior
const cursor = collection.find({ ciudad: "Madrid" });
for await (const doc of cursor) {
  // procesamiento de documentos
}

// Implementación mejorada con cierre garantizado
const cursor = collection.find({ ciudad: "Madrid" });
try {
  for await (const doc of cursor) {
    // procesamiento de documentos
  }
} finally {
  await cursor.close();
}
```

### 2. Análisis de Planes de Consulta

```javascript
// Implementación de explain() con diferentes niveles de verbosidad
const explainOutput = await collection.find(query).explain('executionStats');
```

### 3. Manejo de Excepciones de Cursor

```javascript
try {
  // operaciones con cursor
} catch (error) {
  if (error.code === 43) {
    console.error("Cursor expirado. Reiniciando operación...");
    // lógica de reintento
  }
  throw error;
}
```

### 4. Optimización de Tamaño de Lote

```javascript
// Función para calcular tamaño de lote óptimo según el tamaño de documentos
function calculateOptimalBatchSize(avgDocSize, memoryLimit = 16777216) { // 16MB por defecto
  const estimatedBatchSize = Math.floor(memoryLimit / (avgDocSize * 1.2)); // 20% de margen
  return Math.min(Math.max(estimatedBatchSize, 10), 1000); // Entre 10 y 1000
}
```

### 5. Implementación de Proyección

```javascript
// Implementación anterior - Sin proyección
const cursor = collection.find({ ciudad: "Madrid" });

// Implementación mejorada - Con proyección
const cursor = collection.find(
  { ciudad: "Madrid" }, 
  { projection: { nombre: 1, edad: 1, _id: 0 } }
);
```

### 6. Soporte para Cursores Tailable

```javascript
// Implementación de cursor tailable para colecciones capped
const tailableCursor = capped_collection.find().tailable().awaitData();
```

---

## Ejemplos Prácticos

### Paginación Eficiente

```javascript
// Función de paginación con cursores
async function paginarResultados(collection, filtro, pagina, elementosPorPagina) {
  const skip = (pagina - 1) * elementosPorPagina;
  
  // Uso de proyección para optimizar
  const cursor = collection.find(filtro, {
    projection: { titulo: 1, fecha: 1, _id: 1 }
  })
  .sort({ fecha: -1 })
  .skip(skip)
  .limit(elementosPorPagina);
  
  // Conversión a array (seguro debido al límite)
  const resultados = await cursor.toArray();
  
  // Conteo total para cálculo de páginas
  const total = await collection.countDocuments(filtro);
  
  return {
    datos: resultados,
    total,
    paginas: Math.ceil(total / elementosPorPagina),
    paginaActual: pagina
  };
}
```

### Procesamiento de Grandes Volúmenes de Datos

```javascript
// Procesamiento eficiente de grandes volúmenes
async function procesarGrandesVolumenes(collection, filtro) {
  const cursor = collection.find(filtro).batchSize(500);
  
  try {
    // Procesamiento por lotes para optimizar memoria
    const lote = [];
    for await (const doc of cursor) {
      lote.push(doc);
      
      // Procesamiento de lote cuando alcanza el tamaño definido
      if (lote.length >= 100) {
        await procesarLote(lote);
        lote.length = 0; // Vaciar el lote
      }
    }
    
    // Procesamiento de documentos restantes
    if (lote.length > 0) {
      await procesarLote(lote);
    }
  } finally {
    await cursor.close();
  }
}

async function procesarLote(documentos) {
  // Procesamiento en paralelo para mayor eficiencia
  await Promise.all(documentos.map(doc => procesarDocumento(doc)));
}
```

### Monitorización en Tiempo Real con Cursores Tailable

```javascript
// Monitorización de logs de aplicación en tiempo real
async function monitorearLogs() {
  // Requiere una colección 'capped'
  const cursor = db.collection('logs')
    .find()
    .tailable()
    .awaitData();
  
  try {
    while (true) {
      if (await cursor.hasNext()) {
        const log = await cursor.next();
        console.log(`${log.timestamp}: ${log.message}`);
        
        // Notificación para entradas de error
        if (log.level === 'ERROR') {
          await notificarError(log);
        }
      } else {
        // Pausa antes de verificar nuevamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (err) {
    console.error("Error en monitoreo:", err);
    // Reintento de conexión
    setTimeout(monitorearLogs, 5000);
  }
}
```

---

## Benchmarking y Scripts de Prueba

El proyecto incluye varios scripts para evaluar el rendimiento de diferentes aspectos de los cursores de MongoDB:

### Performance Monitor

```javascript
// Ejecución del monitor de rendimiento
node --expose-gc performance_monitor.js
```

Este script realiza pruebas comparativas de:
- Diferentes tamaños de lote
- Métodos de iteración
- Uso de proyección vs. documentos completos
- Mongoose vs. driver nativo

### Pruebas de Cursores Tailable

```javascript
// Ejecución del ejemplo de cursor tailable
node tailable_cursor_example.js
```

Demuestra la implementación y uso de cursores tailable para monitoreo en tiempo real.

### Optimización de Cursores

```javascript
// Ejecución del script de optimización
node optimize_cursors.js
```

Analiza y aplica técnicas de optimización a cursores existentes.

### Medición Precisa del Uso de Memoria

Para obtener mediciones precisas del uso de memoria, es crucial utilizar la opción `--expose-gc` al ejecutar los scripts de prueba:

```javascript
// Ejecución con control explícito de recolección de basura
node --expose-gc performance_monitor.js
```

Esta opción expone la función `global.gc()` que permite forzar la recolección de basura de forma manual, lo que ayuda a:

- Obtener mediciones más precisas del uso real de memoria
- Eliminar la variabilidad causada por la recolección de basura automática
- Medir el impacto real de diferentes estrategias de cursor en el uso de memoria
- Identificar fugas de memoria potenciales en operaciones con cursores

En nuestras pruebas de rendimiento, se utilizó el siguiente patrón para medir con precisión el uso de memoria:

```javascript
// Ejemplo de medición precisa de memoria
const memoryBefore = process.memoryUsage().heapUsed / 1024 / 1024;

// Operación con cursor
const cursor = collection.find().batchSize(500);
const results = await cursor.toArray();

// Forzar recolección de basura antes de medir
if (global.gc) {
  global.gc();
}

const memoryAfter = process.memoryUsage().heapUsed / 1024 / 1024;
console.log(`Uso de memoria: ${(memoryAfter - memoryBefore).toFixed(2)} MB`);
```

Este enfoque nos permitió identificar con precisión el impacto de diferentes tamaños de lote y estrategias de procesamiento en el consumo de memoria, resultando en las recomendaciones de optimización presentadas en este documento.

### Comandos y Scripts Clave

- `npm start` - Inicia la aplicación web principal
- `npm run dev` - Aplicación con recarga automática
- `npm run mcp` - Inicia el servidor MCP (IA, lenguaje natural)
- `npm run mcp:dev` - MCP en modo desarrollo
- `npm run mcp:client` - Cliente CLI para MCP
- `npm test` - Ejecuta pruebas automatizadas

---

## MCP: Model Context Protocol

El módulo MCP (Model Context Protocol) es un componente avanzado que permite interactuar con MongoDB mediante lenguaje natural.

### Características Principales

- **Conversión de Lenguaje Natural**: Transforma instrucciones en texto plano a operaciones MongoDB.
- **Soporte Multimodal**: Procesamiento de consultas basadas en texto e imágenes.
- **API REST y WebSocket**: Interfaces múltiples para diferentes necesidades.
- **Mantenimiento de Contexto**: Conserva el contexto de la conversación para consultas progresivas.

### Componentes del MCP

- **Servidor MCP**: Componente principal que procesa las instrucciones.
- **Servicios**:
  - **NLP Service**: Procesa lenguaje natural mediante OpenRouter.
  - **DB Service**: Ejecuta operaciones en MongoDB.
  - **WebSocket Service**: Facilita comunicación bidireccional.
- **Cliente CLI**: Interfaz de línea de comandos para interactuar con MCP.
- **Extensión para Cursor IDE**: Integración con el entorno de desarrollo.

### Uso del Cliente CLI

```bash
# Iniciar el cliente CLI
npm run mcp:client

# Ejemplos de consultas
> buscar todos los cursores con edad mayor a 30
> crear nuevo cursor con nombre "Juan" y edad 25
> actualizar cursor con id "12345" y establecer ciudad como "Madrid"
```

Para más detalles, consulte la documentación específica en [mcp/README.md](mcp/README.md).

---

## FAQs y Solución de Problemas

### Preguntas Frecuentes

#### ¿Por qué mi cursor se cierra repentinamente?
Los cursores tienen un tiempo de vida limitado (10 minutos por defecto). Si el procesamiento es lento, el cursor puede expirar antes de completarse.

#### ¿Cuándo debo usar toArray() y cuándo no?
Use `toArray()` solo cuando:
- El resultado sea pequeño (menos de unos miles de documentos)
- Necesite procesar documentos en un orden diferente o realizar múltiples pasadas
- Requiera acceso aleatorio a los documentos

#### ¿Cómo puedo mejorar el rendimiento de cursores en Mongoose?
- Utilice `.lean()` para obtener objetos JavaScript simples en lugar de documentos Mongoose completos
- Utilice `.cursor()` para operaciones de streaming en conjuntos grandes

### Solución de Problemas Comunes

#### Error: Cursor not found
```
MongoError: cursor id 123456 not found
```

**Solución**: El cursor ha expirado. Implemente reintentos o aumente el tiempo de inactividad del cursor.

#### Error: Tamaño máximo de BSON excedido
```
BSONError: Document exceeds maximum allowed BSON size
```

**Solución**: Utilice proyección para limitar campos o implemente paginación en sus resultados.

#### Error: Demasiados cursores abiertos
```
MongoError: too many open cursors
```

**Solución**: Asegúrese de cerrar los cursores después de utilizarlos con `cursor.close()`.

#### Pérdida de memoria al procesar grandes volúmenes

**Solución**: 
- Evite el uso de `toArray()` con conjuntos grandes
- Procese en lotes como se muestra en los ejemplos
- Asegúrese de cerrar correctamente los cursores

---

## Recursos Adicionales

### Documentación Interna del Proyecto

- [MongoDB_Cursors.md](MongoDB_Cursors.md): Guía completa de cursores MongoDB
- [mongodb_cursor_optimization_findings.md](mongodb_cursor_optimization_findings.md): Hallazgos de optimización
- [optimized_cursor_report.md](optimized_cursor_report.md): Reporte de optimización
- [improvements.md](improvements.md): Mejoras y recomendaciones
- [mcp/README.md](mcp/README.md): Documentación completa de MCP

### Enlaces Externos

- [Documentación oficial de MongoDB sobre cursores](https://docs.mongodb.com/manual/reference/method/js-cursor/)
- [Guía de optimización de consultas de MongoDB Atlas](https://www.mongodb.com/docs/atlas/performance-advisor/)
- [Patrones de diseño para aplicaciones escalables con MongoDB](https://www.mongodb.com/blog/post/building-with-patterns-a-summary)

---
## Conclusión

Los cursores son un componente fundamental de MongoDB que permiten interactuar eficientemente con grandes conjuntos de datos. El dominio de su uso adecuado contribuirá significativamente a la creación de aplicaciones más eficientes y escalables.

Aspectos clave a considerar:
- Cierre explícito de cursores cuando finalice su uso
- Implementación de un tamaño de lote adecuado (500 documentos es generalmente óptimo)
- Uso consistente de proyección para limitar los campos recuperados
- Manejo adecuado de errores y excepciones relacionados con cursores
- Monitorización del rendimiento para identificar oportunidades de optimización

La aplicación de estas prácticas recomendadas resultará en aplicaciones MongoDB más rápidas, eficientes y escalables. 

## Licencia

ISC

---

