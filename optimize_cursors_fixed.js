/**
 * MongoDB Cursor Optimization Script
 * 
 * This script implements the best practices for MongoDB cursors based on our performance tests.
 * It directly modifies the /routes/cursores.js file to optimize the cursor implementation.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

// File to optimize
const targetFile = path.join(__dirname, 'routes', 'cursores.js');

// Read the current file
console.log(`Reading file: ${targetFile}`);
try {
  let fileContent = fs.readFileSync(targetFile, 'utf8');
  console.log(`File read successfully, size: ${fileContent.length} bytes`);
  
  // Create a summary of the optimizations we'll make
  const optimizations = [
    {
      name: 'Default Batch Size',
      description: 'Set optimal batch size to 500 based on performance tests'
    },
    {
      name: 'Use native driver',
      description: 'Access MongoDB collections directly for better performance'
    },
    {
      name: 'Use lean() with Mongoose',
      description: 'Avoid Mongoose document instantiation overhead'
    },
    {
      name: 'Use toArray() for small/medium result sets',
      description: 'Process documents in bulk rather than one by one'
    }
  ];
  
  console.log('\nPlanned optimizations:');
  optimizations.forEach((opt, idx) => {
    console.log(`${idx + 1}. ${opt.name}: ${opt.description}`);
  });
  
  // Backup the original file
  const backupFile = `${targetFile}.backup-${Date.now()}.js`;
  console.log(`\nCreating backup at: ${backupFile}`);
  fs.writeFileSync(backupFile, fileContent);
  console.log('Backup created successfully');

  // Apply optimizations
  console.log('\nApplying optimizations...');
  
  // Fix for document calculation in comparar endpoint
  let optimizedContent = fileContent.replace(
    'const cursorBatchSize = parseInt(batchSize) || 100; // Aumentar el tamaño de lote predeterminado',
    'const cursorBatchSize = parseInt(batchSize) || 500; // Optimizado a 500 basado en pruebas'
  );
  
  // Fix for batch size calculation function
  optimizedContent = optimizedContent.replace(
    '// Limitamos entre 10 y 1000 documentos por batch\n  return Math.min(Math.max(estimatedBatchSize, 10), 1000);',
    '// Limitamos entre 10 y 500 documentos por batch (optimizado basado en pruebas)\n  return Math.min(Math.max(estimatedBatchSize, 10), 500);'
  );
  
  // Add lean() to findById queries
  optimizedContent = optimizedContent.replace(
    'const cursorExiste = await Cursor.findById(cursorId);',
    'const cursorExiste = await Cursor.findById(cursorId).lean(); // Usar lean() para mejor rendimiento'
  );
  
  // Replace cursor iteration with toArray + map in ejecutar endpoint
  optimizedContent = optimizedContent.replace(
    `// Procesamos el cursor en batches para simular uso real
    const cursorResultados = [];
    let batch;
    
    try {
      // Utilizamos el patrón de cursor óptimo: iterar en batches
      while (await mongoCursor.hasNext()) {
        try {
          batch = await mongoCursor.next();
          cursorResultados.push(batch);
          docsReturned++;
          
          // Incrementamos el número de lotes procesados
          if (docsReturned % batchSize === 1) {
            currentBatch++;
          }
          
          // Limitamos a 100 documentos para la demostración
          if (docsReturned >= 100) break;
        } catch (error) {
          if (error.code === 43) { // CursorNotFound error
            console.error("Cursor expirado. Reiniciando operación...");
            // Recreamos el cursor y continuamos desde donde nos quedamos
            mongoCursor = collection.find({ 
              ciudad: cursorExiste.ciudad
            }, {
              projection: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 }
            }).batchSize(batchSize).skip(docsReturned);
          } else {
            throw error; // Otro tipo de error, lo propagamos
          }
        }
      }
    } finally {
      // Aseguramos que el cursor se cierre siempre
      await mongoCursor.close();
    }`,
    `// OPTIMIZACIÓN: Para conjuntos pequeños/medianos (<100K docs), toArray() es más eficiente
    // que iterar uno por uno, especialmente cuando procesamos todos los documentos
    try {
      // Obtenemos todos los documentos de una vez
      const cursorResultados = await mongoCursor.toArray();
      docsReturned = cursorResultados.length;
      
      // Calculamos el número de lotes
      currentBatch = Math.ceil(docsReturned / batchSize);
    } finally {
      // Aseguramos que el cursor se cierre siempre
      await mongoCursor.close();
    }`
  );
  
  // Fix syntax for find with projection in modern MongoDB driver
  optimizedContent = optimizedContent.replace(
    `const mongoCursor = collection.find({ 
      ciudad: cursorExiste.ciudad
    }, {
      // Proyección para seleccionar solo los campos necesarios
      projection: { nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 }
    }).batchSize(batchSize);`,
    `const mongoCursor = collection.find({ 
      ciudad: cursorExiste.ciudad
    })
    .project({ nombre: 1, edad: 1, ciudad: 1, fechaCreacion: 1 })
    .limit(100) // Limitamos a 100 documentos para la demo
    .batchSize(batchSize);`
  );
  
  // Add lean() to Cursor.find() in /comparar endpoint
  optimizedContent = optimizedContent.replace(
    'const resultsNoCursor = await Cursor.find(filter).limit(limit).exec();',
    'const resultsNoCursor = await Cursor.find(filter).limit(limit).lean().exec();'
  );
  
  // Write the optimized file
  console.log('Writing optimized file...');
  fs.writeFileSync(targetFile, optimizedContent);
  console.log(`Optimized file written successfully: ${targetFile}`);
  
  console.log('\nOptimization Notes:');
  console.log('1. Changed default batchSize to 500 based on performance tests');
  console.log('2. Using native MongoDB driver properly with modern syntax');
  console.log('3. Added .lean() to Mongoose queries to avoid document instantiation overhead');
  console.log('4. Using toArray() rather than iterating document by document for small/medium result sets');
  
} catch (error) {
  console.error('Error during optimization:', error);
} 