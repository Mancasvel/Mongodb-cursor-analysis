# Integración del MCP con Cursor IDE

Este documento explica cómo integrar el servidor MCP (Model Context Protocol) con Cursor IDE para permitir interactuar directamente con MongoDB mediante lenguaje natural desde el editor.

## Configuración Automática

### 1. Configuración del archivo `mcp.json`

Cursor IDE busca un archivo de configuración en `~/.cursor/mcp.json` (Linux/Mac) o `C:\Users\[tu-usuario]\.cursor\mcp.json` (Windows). Copia el siguiente contenido a ese archivo:

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

Este archivo le indica a Cursor que debe conectarse al servidor MCP cuando se solicite.

### 2. Instalación de la extensión para Cursor

1. Instala la extensión Tampermonkey en tu navegador
2. Crea un nuevo script
3. Copia el contenido del archivo `mcp/cursor-ide-extension.js` en el nuevo script
4. Guarda y activa la extensión

## Configuración Manual

Si prefieres una configuración manual, sigue estos pasos:

1. Asegúrate de que el servidor MCP esté en ejecución (`npm run mcp`)
2. En Cursor IDE, abre la consola de desarrollador (F12 o Ctrl+Shift+I)
3. Ejecuta el siguiente código:

```javascript
// Configuración manual del MCP
const mcpConfig = {
  serverUrl: 'http://localhost:3000/sse',
  apiKey: 'your-api-key-here'
};

// Crear conexión SSE
const eventSource = new EventSource(`${mcpConfig.serverUrl}?apiKey=${mcpConfig.apiKey}`);

// Eventos de la conexión
eventSource.onopen = () => console.log('Conectado al servidor MCP');
eventSource.addEventListener('message', (event) => console.log('Mensaje del MCP:', JSON.parse(event.data)));
eventSource.addEventListener('error', (error) => console.error('Error MCP:', error));

// Función para enviar consultas
window.sendMCPQuery = async (query) => {
  try {
    const response = await fetch(`${mcpConfig.serverUrl}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mcpConfig.apiKey}`
      },
      body: JSON.stringify({
        query: query
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return 'Consulta enviada';
  } catch (error) {
    console.error('Error al enviar consulta:', error);
    return `Error: ${error.message}`;
  }
};

console.log('Conector MCP inicializado. Usa sendMCPQuery("tu consulta") para enviar consultas.');
```

## Uso

Una vez configurado, puedes interactuar con el MCP de las siguientes formas:

### 1. Desde la interfaz (con la extensión instalada)

- Haz clic en el botón "M" que aparece en la barra de herramientas
- Escribe tu consulta en lenguaje natural

### 2. Desde la consola de desarrollador

```javascript
window.MCPIntegration.executeQuery("muéstrame los últimos 10 cursores");
```

### 3. Desde la línea de comandos de Cursor

Presiona `Cmd+P` (Mac) o `Ctrl+P` (Windows/Linux) y escribe:

```
> MCP: busca todos los cursores de Madrid
```

## Ejemplos de consultas

- "Muéstrame los últimos 10 cursores"
- "Busca cursores con edad mayor a 30"
- "Crea un nuevo cursor con nombre Juan y edad 25"
- "Actualiza el cursor con id 12345 y establece ciudad a Madrid"

## Solución de problemas

- **El botón MCP no aparece**: Asegúrate de que la extensión está correctamente instalada y activada.
- **No hay conexión con el servidor**: Verifica que el servidor MCP está en ejecución con `npm run mcp`.
- **Error en las consultas**: Revisa la consola de desarrollador para ver los mensajes de error detallados.
- **Problemas con SSE**: Si tienes problemas con la conexión SSE, verifica que tu navegador es compatible con EventSource y que el servidor está enviando los eventos correctamente con las cabeceras CORS apropiadas.

## API de integración

La extensión expone una API global que puedes utilizar para interactuar con el MCP:

```javascript
// Conectar al servidor MCP
window.MCPIntegration.connect();

// Ejecutar una consulta
window.MCPIntegration.executeQuery("tu consulta aquí");

// Verificar si está conectado
const isConnected = window.MCPIntegration.isConnected();
```

Esta API está disponible una vez que la extensión se ha cargado en Cursor IDE. 