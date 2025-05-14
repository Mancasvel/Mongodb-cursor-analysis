// ==UserScript==
// @name         MongoDB MCP Cursor IDE Integration
// @namespace    mongodb-cursor-analyzer
// @version      1.0
// @description  Integración del servidor MCP con Cursor IDE
// @author       Cursor MCP
// @match        https://cursor.sh/*
// @match        https://cursor.so/*
// @match        http://localhost:*/cursor*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // Configuración del servidor MCP
    const MCP_CONFIG = {
        serverUrl: 'http://localhost:3000/sse',
        apiKey: 'your-api-key-here',
        autoConnect: true,
        reconnectInterval: 5000,
        maxReconnectAttempts: 5
    };
    
    // Estado de la conexión
    let eventSource = null;
    let sessionId = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    let cursorIDEConnector = null;
    
    // Inicializar cuando la página esté cargada
    window.addEventListener('load', function() {
        console.log('Inicializando MCP para Cursor IDE...');
        setTimeout(initMCPIntegration, 2000);
    });
    
    // Función principal de inicialización
    function initMCPIntegration() {
        // Intentar buscar la API de Cursor
        checkForCursorAPI();
        
        // Conectar al servidor MCP
        if (MCP_CONFIG.autoConnect) {
            connectToMCPServer();
        }
        
        // Inyectar el botón de MCP en la interfaz
        injectMCPButton();
    }
    
    // Verificar si la API de Cursor está disponible
    function checkForCursorAPI() {
        if (window.cursor) {
            console.log('API de Cursor detectada.');
            cursorIDEConnector = new CursorIDEConnector(window.cursor);
        } else {
            console.log('API de Cursor no detectada. Reintentando en 2 segundos...');
            setTimeout(checkForCursorAPI, 2000);
        }
    }
    
    // Conectar al servidor MCP usando SSE
    function connectToMCPServer() {
        try {
            console.log(`Conectando al servidor MCP: ${MCP_CONFIG.serverUrl}`);
            
            // Cerrar la conexión existente si hay alguna
            if (eventSource) {
                eventSource.close();
            }
            
            // Crear nueva conexión SSE
            eventSource = new EventSource(`${MCP_CONFIG.serverUrl}?apiKey=${MCP_CONFIG.apiKey}`);
            
            eventSource.onopen = function() {
                console.log('Conexión establecida con el servidor MCP');
                isConnected = true;
                reconnectAttempts = 0;
                
                // Notificar a la interfaz
                updateConnectionStatusUI(true);
            };
            
            eventSource.addEventListener('message', function(event) {
                try {
                    const message = JSON.parse(event.data);
                    handleMCPMessage(message);
                } catch (error) {
                    console.error('Error al procesar mensaje MCP:', error);
                }
            });
            
            eventSource.addEventListener('error', function(error) {
                console.error('Error de conexión MCP:', error);
                isConnected = false;
                updateConnectionStatusUI(false);
                
                // Intentar reconectar
                if (reconnectAttempts < MCP_CONFIG.maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`Intentando reconectar (${reconnectAttempts}/${MCP_CONFIG.maxReconnectAttempts})...`);
                    setTimeout(connectToMCPServer, MCP_CONFIG.reconnectInterval);
                }
                
                // Cerrar la conexión actual
                eventSource.close();
            });
            
        } catch (error) {
            console.error('Error al iniciar conexión MCP:', error);
        }
    }
    
    // Manejar mensajes del servidor MCP
    function handleMCPMessage(message) {
        console.log('Mensaje recibido del servidor MCP:', message);
        
        switch (message.type) {
            case 'connection':
                sessionId = message.sessionId;
                console.log(`Sesión MCP iniciada: ${sessionId}`);
                break;
                
            case 'result':
                // Si tenemos acceso a la API de Cursor, podemos actualizar el editor
                if (cursorIDEConnector) {
                    cursorIDEConnector.displayResult(message);
                }
                break;
                
            case 'error':
                console.error(`Error MCP: ${message.message}`);
                // Mostrar error en la interfaz
                if (cursorIDEConnector) {
                    cursorIDEConnector.displayError(message.message);
                }
                break;
        }
    }
    
    // Inyectar el botón MCP en la interfaz de Cursor
    function injectMCPButton() {
        // Buscar la barra de herramientas
        const interval = setInterval(() => {
            const toolbars = document.querySelectorAll('.toolbar');
            if (toolbars.length > 0) {
                clearInterval(interval);
                
                // Crear el botón
                const mcpButton = document.createElement('button');
                mcpButton.className = 'toolbar-button mcp-connection-button';
                mcpButton.title = 'MongoDB MCP';
                mcpButton.innerHTML = `
                    <span class="mcp-icon">M</span>
                    <span class="mcp-status-indicator ${isConnected ? 'connected' : 'disconnected'}"></span>
                `;
                
                // Estilos
                const style = document.createElement('style');
                style.textContent = `
                    .mcp-connection-button {
                        position: relative;
                        padding: 4px 8px;
                        margin: 0 4px;
                        background: #2a2a2a;
                        border: none;
                        border-radius: 4px;
                        color: #fff;
                        cursor: pointer;
                    }
                    .mcp-connection-button:hover {
                        background: #3a3a3a;
                    }
                    .mcp-icon {
                        font-weight: bold;
                        font-size: 14px;
                    }
                    .mcp-status-indicator {
                        position: absolute;
                        top: 3px;
                        right: 3px;
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                    }
                    .mcp-status-indicator.connected {
                        background-color: #4CAF50;
                    }
                    .mcp-status-indicator.disconnected {
                        background-color: #F44336;
                    }
                `;
                document.head.appendChild(style);
                
                // Evento de clic
                mcpButton.addEventListener('click', toggleMCPPanel);
                
                // Añadir a la barra de herramientas
                toolbars[0].appendChild(mcpButton);
                
                console.log('Botón MCP inyectado en la interfaz de Cursor');
            }
        }, 1000);
    }
    
    // Actualizar el indicador de estado en la interfaz
    function updateConnectionStatusUI(connected) {
        const indicator = document.querySelector('.mcp-status-indicator');
        if (indicator) {
            indicator.className = `mcp-status-indicator ${connected ? 'connected' : 'disconnected'}`;
        }
    }
    
    // Mostrar/ocultar el panel de MCP
    function toggleMCPPanel() {
        if (!isConnected) {
            connectToMCPServer();
            return;
        }
        
        // Implementar lógica para mostrar/ocultar el panel MCP
        // Esto podría integrarse con tu implementación actual
    }
    
    // Clase para interactuar con la API de Cursor IDE
    class CursorIDEConnector {
        constructor(cursorAPI) {
            this.cursor = cursorAPI;
            console.log('Conector de Cursor IDE inicializado');
        }
        
        // Mostrar resultados en Cursor IDE
        displayResult(result) {
            try {
                // Crear una notificación en Cursor
                this.cursor.showNotification({
                    type: 'info',
                    message: `MCP: Operación ${result.operation} completada con éxito`,
                    timeout: 3000
                });
                
                // Si es posible, podríamos insertar los resultados en un nuevo archivo o panel
                this.insertResultsToEditor(result);
                
            } catch (error) {
                console.error('Error al mostrar resultados en Cursor:', error);
            }
        }
        
        // Insertar resultados en el editor
        insertResultsToEditor(result) {
            // Esto dependerá de la API específica de Cursor
            // Por ahora solo mostraremos en la consola
            console.log('Resultados MCP:', result);
        }
        
        // Mostrar error en Cursor IDE
        displayError(errorMessage) {
            try {
                this.cursor.showNotification({
                    type: 'error',
                    message: `MCP Error: ${errorMessage}`,
                    timeout: 5000
                });
            } catch (error) {
                console.error('Error al mostrar notificación de error:', error);
            }
        }
        
        // Ejecutar una consulta MCP directamente desde Cursor
        async executeMCPQuery(query) {
            if (!isConnected) {
                this.displayError('No conectado al servidor MCP');
                return;
            }
            
            try {
                // Enviar la consulta al servidor MCP mediante una solicitud fetch
                const response = await fetch(`${MCP_CONFIG.serverUrl}/query`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${MCP_CONFIG.apiKey}`
                    },
                    body: JSON.stringify({
                        query: query,
                        sessionId: sessionId
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                console.log(`Consulta MCP enviada: ${query}`);
            } catch (error) {
                console.error('Error al enviar consulta MCP:', error);
                this.displayError(`Error al enviar consulta: ${error.message}`);
            }
        }
    }
    
    // Exponer la API de MCP globalmente para que Cursor pueda acceder a ella
    window.MCPIntegration = {
        connect: connectToMCPServer,
        executeQuery: async function(query) {
            if (cursorIDEConnector) {
                await cursorIDEConnector.executeMCPQuery(query);
            }
        },
        isConnected: function() {
            return isConnected;
        }
    };
    
    console.log('Integración MCP para Cursor IDE cargada');
})(); 