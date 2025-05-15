/**
 * Ejemplo de uso de cursores tailable en MongoDB
 * Los cursores tailable son similares a los comandos 'tail -f' en Unix
 * y se utilizan para monitorear continuamente colecciones capped
 * 
 * Para ejecutar: node tailable_cursor_example.js
 */

const { MongoClient } = require('mongodb');
const assert = require('assert');

// URI de conexión a MongoDB
const uri = 'mongodb://localhost:27017';

// Nombre de la base de datos y colección
const dbName = 'cursor_analysis';
const collectionName = 'logs_capped';

// Tamaño de la colección capped (1MB)
const cappedSize = 1024 * 1024;

// Conectar a MongoDB y configurar el ejemplo
async function run() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Conectado correctamente a MongoDB');
    
    const db = client.db(dbName);
    
    // Eliminar la colección si ya existe
    try {
      await db.collection(collectionName).drop();
      console.log('Colección anterior eliminada');
    } catch (e) {
      // La colección no existía, continuar
    }
    
    // Crear una colección capped (de tamaño fijo)
    await db.createCollection(collectionName, {
      capped: true,
      size: cappedSize,
      max: 100 // máximo de documentos
    });
    
    console.log(`Colección capped '${collectionName}' creada con éxito`);
    
    // Insertar algunos documentos iniciales
    const collection = db.collection(collectionName);
    await collection.insertMany([
      { type: 'info', message: 'Aplicación iniciada', timestamp: new Date() },
      { type: 'info', message: 'Conexión establecida', timestamp: new Date() }
    ]);
    
    console.log('Documentos iniciales insertados');
    
    // Crear un cursor tailable para monitorear cambios
    const cursor = collection.find({}, {
      tailable: true,
      awaitData: true,
      noCursorTimeout: true
    });
    
    // Función para simular inserción de nuevos datos
    const simulateNewData = async () => {
      for (let i = 1; i <= 5; i++) {
        setTimeout(async () => {
          try {
            const logType = i % 3 === 0 ? 'error' : (i % 2 === 0 ? 'warning' : 'info');
            await collection.insertOne({
              type: logType,
              message: `Evento ${i} generado`,
              timestamp: new Date()
            });
            console.log(`[INSERCIÓN] Nuevo evento de tipo '${logType}' insertado`);
          } catch (err) {
            console.error(`Error al insertar: ${err.message}`);
          }
        }, i * 2000); // Insertar un nuevo documento cada 2 segundos
      }
    };
    
    // Iniciar simulación de datos después de un breve retraso
    setTimeout(simulateNewData, 1000);
    
    // Monitorear la colección con el cursor tailable
    console.log('\n=== MONITOREO DE EVENTOS CON CURSOR TAILABLE ===');
    console.log('Esperando nuevos documentos (se insertarán 5 eventos, uno cada 2 segundos)...\n');
    
    let closeRequested = false;
    
    // Manejar salida con Ctrl+C
    process.on('SIGINT', () => {
      console.log('\nCerrando la aplicación...');
      closeRequested = true;
      setTimeout(() => process.exit(0), 500);
    });
    
    // Iterar sobre el cursor tailable
    while (await cursor.hasNext() && !closeRequested) {
      const doc = await cursor.next();
      const timestamp = doc.timestamp.toISOString().replace('T', ' ').substr(0, 19);
      console.log(`[${timestamp}] ${doc.type.toUpperCase()}: ${doc.message}`);
    }
    
    // Cerrar el cursor explícitamente
    await cursor.close();
    console.log('Cursor cerrado correctamente');
    
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    // Cerrar la conexión
    await client.close();
    console.log('Conexión cerrada');
  }
}

// Ejecutar el ejemplo
run().catch(console.error);

/**
 * NOTAS IMPORTANTES SOBRE CURSORES TAILABLE:
 * 
 * 1. Solo funcionan con colecciones capped (de tamaño fijo)
 * 2. Son ideales para casos de uso tipo streaming o colas de mensajes
 * 3. Permanecen abiertos incluso cuando se agotan los resultados iniciales
 * 4. Con la opción awaitData, el cursor espera la llegada de nuevos documentos
 * 5. Requieren índices adecuados si se utilizan con criterios de filtrado
 * 
 * CASOS DE USO COMUNES:
 * - Monitoreo en tiempo real de logs
 * - Sistemas de chat
 * - Notificaciones en tiempo real
 * - Procesamiento de flujos de datos
 */ 