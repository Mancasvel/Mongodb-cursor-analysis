"""
Ejemplos correctos de manejo de cursores en MongoDB con PyMongo
Este archivo complementa el notebook cursors_mongodb.ipynb con ejemplos corregidos
"""

from pymongo import MongoClient
import time

def connect_to_mongodb():
    """Conecta a MongoDB y devuelve un cliente"""
    client = MongoClient('mongodb://localhost:27017/')
    return client

def correct_explain_usage():
    """Ejemplo correcto de uso de explain() en versiones recientes de PyMongo"""
    client = connect_to_mongodb()
    db = client.cursor_analysis
    users = db.users
    
    # Forma correcta de usar explain en PyMongo versiones recientes (4.x)
    # La sintaxis puede variar según la versión de PyMongo
    print("\n=== EJEMPLO DE USO CORRECTO DE EXPLAIN() ===")
    
    # En versiones 4.x de PyMongo se usa el parámetro verbosity
    try:
        explanation = users.find({"age": {"$gt": 30}}).explain(verbosity="executionStats")
        print("Plan de consulta:", explanation["queryPlanner"]["winningPlan"])
        print("Documentos devueltos:", explanation["executionStats"]["nReturned"])
        print("Documentos examinados:", explanation["executionStats"]["totalDocsExamined"])
        print("Tiempo de ejecución (ms):", explanation["executionStats"]["executionTimeMillis"])
        
        # Verificar si se usó un índice
        stage = explanation["queryPlanner"]["winningPlan"].get("inputStage", {}).get("stage", "")
        if stage == "IXSCAN":
            print("Se utilizó un índice:", explanation["queryPlanner"]["winningPlan"]["inputStage"]["indexName"])
        else:
            print("No se utilizó índice (COLLSCAN)")
            
    except TypeError as e:
        print("Error de versión en explain(). Intenta la sintaxis alternativa:")
        # Para versiones anteriores
        explanation = users.find({"age": {"$gt": 30}}).explain()
        print("Plan básico:", explanation["queryPlanner"]["winningPlan"])
    
    return explanation

def proper_cursor_handling():
    """Ejemplo de manejo óptimo de cursor con cierre explícito"""
    client = connect_to_mongodb()
    db = client.cursor_analysis
    users = db.users
    
    print("\n=== EJEMPLO DE MANEJO CORRECTO DE CURSOR ===")
    
    # Usando context manager para asegurar el cierre del cursor
    # (Solo disponible en versiones recientes de PyMongo)
    print("Ejemplo 1: Usando context manager (recomendado)")
    try:
        with users.find({"age": {"$gt": 25}}).batch_size(2) as cursor:
            for doc in cursor:
                print(f"Procesando: {doc['name']}")
    except AttributeError:
        print("El context manager para cursor no está disponible en esta versión de PyMongo")
    
    # Alternativa usando try-finally para cierre explícito
    print("\nEjemplo 2: Usando try-finally para cierre explícito")
    cursor = users.find({"age": {"$gt": 25}}).batch_size(2)
    try:
        for doc in cursor:
            print(f"Procesando: {doc['name']}")
    finally:
        # Cerrar explícitamente el cursor para liberar recursos
        cursor.close()
    
    # Ejemplo de procesamiento por lotes con cierre explícito
    print("\nEjemplo 3: Procesamiento por lotes con cierre explícito")
    cursor = users.find().batch_size(3)
    batch = []
    batch_size = 3
    count = 0
    
    try:
        for doc in cursor:
            batch.append(doc)
            count += 1
            
            # Cuando tenemos un lote completo
            if len(batch) >= batch_size:
                print(f"Procesando lote de {len(batch)} documentos")
                # Aquí iría la lógica de procesamiento del lote
                batch = []  # Limpiar para el siguiente lote
        
        # Procesar los documentos restantes (último lote incompleto)
        if batch:
            print(f"Procesando lote final de {len(batch)} documentos")
            # Procesar el lote final
    finally:
        # Siempre cerramos el cursor explícitamente
        cursor.close()
        print("Cursor cerrado correctamente")

def demonstrate_cursor_timeout():
    """Demostración de timeout de cursor y cómo manejarlo"""
    client = connect_to_mongodb()
    db = client.cursor_analysis
    users = db.users
    
    print("\n=== DEMOSTRACIÓN DE TIMEOUT DE CURSOR ===")
    print("NOTA: Este ejemplo puede tardar más de 10 minutos en completarse")
    
    # Crear un cursor sin opciones noTimeout
    cursor = users.find()
    
    # En producción, para cursores de larga duración, usar:
    # cursor = users.find(no_cursor_timeout=True)
    
    print("Cursor creado. Esperando a que expire (simulando operación larga)...")
    try:
        # Obtener el primer elemento pero no iterar más
        first = next(cursor, None)
        if first:
            print("Primer documento:", first)
            
        # Simular un proceso largo (más de 10 minutos)
        # Nota: Esto es solo para demostración, en producción no bloquear el hilo así
        time.sleep(10)  # Reducido a 10 segundos para este ejemplo
        
        # Intentar usar el cursor después de un tiempo
        # Esto normalmente causaría un error CursorNotFound después de 10 minutos
        print("Intentando usar el cursor después de esperar...")
        for doc in cursor:
            print(doc)
            
    except Exception as e:
        print(f"Error al usar el cursor: {e}")
        print("Este error es esperado después del timeout del servidor (10 minutos)")
        print("En producción, se debería manejar reconectando o recreando el cursor")
    finally:
        # Siempre cerrar el cursor, incluso si hay error
        try:
            cursor.close()
            print("Cursor cerrado correctamente")
        except Exception as e:
            print(f"Error al cerrar el cursor: {e}")

def calculate_optimal_batch_size(avg_doc_size_bytes=1024, memory_limit_bytes=16777216):
    """Calcula el tamaño óptimo de lote basado en el tamaño del documento"""
    # 16MB es el límite predeterminado de BSON
    # Añadimos un margen de seguridad del 20%
    estimated_batch_size = memory_limit_bytes / (avg_doc_size_bytes * 1.2)
    
    # Limitamos entre 10 y 1000 documentos por lote
    return min(max(int(estimated_batch_size), 10), 1000)

def estimate_document_size(collection, sample_size=5):
    """Estima el tamaño promedio de documento en bytes basado en muestreo"""
    import json
    
    # Obtener una muestra de documentos
    sample = list(collection.find().limit(sample_size))
    
    if not sample:
        return 1024  # Valor predeterminado si no hay documentos
    
    # Estimar tamaño basado en la serialización a JSON (aproximado)
    total_size = sum(len(json.dumps(doc, default=str)) for doc in sample)
    avg_size = total_size / len(sample)
    
    # Aplicar un factor para compensar la diferencia entre JSON y BSON
    return int(avg_size * 1.1)

def optimize_cursor_example():
    """Ejemplo de optimización de cursor con batchSize calculado dinámicamente"""
    client = connect_to_mongodb()
    db = client.cursor_analysis
    users = db.users
    
    print("\n=== EJEMPLO DE OPTIMIZACIÓN DE CURSOR ===")
    
    # Estimar el tamaño promedio de documento
    avg_doc_size = estimate_document_size(users)
    optimal_batch_size = calculate_optimal_batch_size(avg_doc_size)
    
    print(f"Tamaño promedio de documento: {avg_doc_size} bytes")
    print(f"Tamaño óptimo de lote calculado: {optimal_batch_size} documentos")
    
    # Usar el tamaño óptimo de lote
    cursor = users.find().batch_size(optimal_batch_size)
    try:
        count = 0
        for doc in cursor:
            # Solo mostrar algunos para no saturar la salida
            if count < 3:
                print(f"Documento {count+1}: {doc['name'] if 'name' in doc else doc}")
            count += 1
        print(f"Total de documentos procesados: {count}")
    finally:
        cursor.close()
        print("Cursor cerrado correctamente")

if __name__ == "__main__":
    print("EJEMPLOS DE USO CORRECTO DE CURSORES EN MONGODB")
    print("=" * 50)
    
    # Ejecutar los ejemplos
    correct_explain_usage()
    proper_cursor_handling()
    optimize_cursor_example()
    
    # Este ejemplo es opcional ya que toma tiempo
    if input("\n¿Desea ejecutar el ejemplo de timeout de cursor? (s/n): ").lower() == 's':
        demonstrate_cursor_timeout()
    
    print("\nEjemplos completados correctamente") 