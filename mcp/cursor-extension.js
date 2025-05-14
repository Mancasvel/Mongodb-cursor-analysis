// ==UserScript==
// @name         MongoDB MCP for Cursor.sh
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Integración de MongoDB MCP con Cursor.sh
// @author       Ksty
// @match        https://cursor.sh/*
// @match        http://localhost:*/*cursor*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    // Configuración
    const MCP_WS_URL = 'ws://localhost:3001'; // URL del WebSocket del MCP
    let ws = null;
    let sessionId = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    
    // Elementos de la UI
    let mcpPanel;
    let mcpInput;
    let mcpOutput;
    let mcpStatus;
    let mcpToggle;
    
    // Inicializar cuando el DOM esté completamente cargado
    window.addEventListener('load', function() {
        // Esperar un poco para asegurarnos de que Cursor.sh ha cargado completamente
        setTimeout(initMcpExtension, 2000);
    });
    
    // Función principal de inicialización
    function initMcpExtension() {
        // Crear el panel de MCP
        createMcpUI();
        
        // Intentar conectar al WebSocket
        connectWebSocket();
        
        // Agregar manejadores de eventos
        addEventListeners();
    }
    
    // Crear la interfaz de usuario
    function createMcpUI() {
        // Crear el panel principal
        mcpPanel = document.createElement('div');
        mcpPanel.id = 'mcp-panel';
        mcpPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 400px;
            height: 300px;
            background-color: #1e1e1e;
            border: 1px solid #444;
            border-radius: 8px;
            display: flex;
            flex-direction: column;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
            font-size: 12px;
            overflow: hidden;
        `;
        
        // Crear la barra de título
        const titleBar = document.createElement('div');
        titleBar.style.cssText = `
            padding: 8px;
            background-color: #333;
            border-bottom: 1px solid #444;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        `;
        
        const title = document.createElement('div');
        title.textContent = 'MongoDB MCP';
        title.style.fontWeight = 'bold';
        
        // Indicador de estado
        mcpStatus = document.createElement('div');
        mcpStatus.style.cssText = `
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background-color: #f44;
            margin-right: 8px;
        `;
        
        // Botón de minimizar
        mcpToggle = document.createElement('button');
        mcpToggle.textContent = '−';
        mcpToggle.style.cssText = `
            background: none;
            border: none;
            color: #ccc;
            font-size: 16px;
            cursor: pointer;
        `;
        
        titleBar.appendChild(title);
        titleBar.appendChild(mcpStatus);
        titleBar.appendChild(mcpToggle);
        mcpPanel.appendChild(titleBar);
        
        // Crear el área de salida
        mcpOutput = document.createElement('div');
        mcpOutput.style.cssText = `
            flex: 1;
            padding: 8px;
            overflow-y: auto;
            background-color: #1e1e1e;
            color: #ddd;
            white-space: pre-wrap;
            word-break: break-word;
        `;
        mcpPanel.appendChild(mcpOutput);
        
        // Crear el área de entrada
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            padding: 8px;
            background-color: #252525;
            border-top: 1px solid #444;
        `;
        
        // Contenedor para URL de imagen (inicialmente oculto)
        const imageUrlContainer = document.createElement('div');
        imageUrlContainer.style.cssText = `
            display: none;
            margin-bottom: 8px;
        `;
        
        const imageUrlInput = document.createElement('input');
        imageUrlInput.type = 'text';
        imageUrlInput.placeholder = 'URL de la imagen...';
        imageUrlInput.style.cssText = `
            flex: 1;
            padding: 6px 8px;
            background-color: #333;
            border: 1px solid #555;
            border-radius: 4px;
            color: #ddd;
            font-family: inherit;
            font-size: inherit;
            margin-bottom: 8px;
        `;
        
        const imageToggleButton = document.createElement('button');
        imageToggleButton.textContent = '🖼️ Añadir Imagen';
        imageToggleButton.style.cssText = `
            align-self: flex-start;
            margin-bottom: 8px;
            padding: 4px 8px;
            background-color: #333;
            border: 1px solid #555;
            border-radius: 4px;
            color: #ddd;
            cursor: pointer;
            font-size: 12px;
        `;
        
        imageUrlContainer.appendChild(imageUrlInput);
        inputContainer.appendChild(imageToggleButton);
        inputContainer.appendChild(imageUrlContainer);
        
        const queryInputContainer = document.createElement('div');
        queryInputContainer.style.cssText = `
            display: flex;
            width: 100%;
        `;
        
        mcpInput = document.createElement('input');
        mcpInput.type = 'text';
        mcpInput.placeholder = 'Escribe una consulta en lenguaje natural...';
        mcpInput.style.cssText = `
            flex: 1;
            padding: 6px 8px;
            background-color: #333;
            border: 1px solid #555;
            border-radius: 4px;
            color: #ddd;
            font-family: inherit;
            font-size: inherit;
        `;
        
        const sendButton = document.createElement('button');
        sendButton.textContent = 'Enviar';
        sendButton.style.cssText = `
            margin-left: 8px;
            padding: 6px 12px;
            background-color: #0078d7;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
        `;
        
        queryInputContainer.appendChild(mcpInput);
        queryInputContainer.appendChild(sendButton);
        inputContainer.appendChild(queryInputContainer);
        
        mcpPanel.appendChild(inputContainer);
        
        // Agregar el panel al DOM
        document.body.appendChild(mcpPanel);
        
        // Hacer el panel arrastrable
        makeDraggable(mcpPanel, titleBar);
        
        // Agregar evento de clic al botón de enviar
        sendButton.addEventListener('click', sendQuery);
        
        // Agregar evento de tecla Enter al input
        mcpInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                sendQuery();
            }
        });
        
        // Agregar evento al botón de minimizar
        mcpToggle.addEventListener('click', togglePanel);
        
        // Agregar evento al botón de imagen
        imageToggleButton.addEventListener('click', function() {
            if (imageUrlContainer.style.display === 'none') {
                imageUrlContainer.style.display = 'block';
                imageToggleButton.textContent = '🖼️ Cancelar Imagen';
            } else {
                imageUrlContainer.style.display = 'none';
                imageUrlInput.value = '';
                imageToggleButton.textContent = '🖼️ Añadir Imagen';
            }
        });
    }
    
    // Conectar al WebSocket del MCP
    function connectWebSocket() {
        try {
            ws = new WebSocket(MCP_WS_URL);
            
            ws.onopen = function() {
                isConnected = true;
                reconnectAttempts = 0;
                updateStatus('connected');
                appendToOutput('Conectado al servidor MCP', 'system');
            };
            
            ws.onmessage = function(event) {
                try {
                    const message = JSON.parse(event.data);
                    handleMessage(message);
                } catch (error) {
                    console.error('Error al procesar mensaje:', error);
                    appendToOutput(`Error al procesar mensaje: ${error.message}`, 'error');
                }
            };
            
            ws.onerror = function(error) {
                console.error('Error de WebSocket:', error);
                updateStatus('error');
                appendToOutput('Error de conexión con el servidor MCP', 'error');
            };
            
            ws.onclose = function() {
                isConnected = false;
                updateStatus('disconnected');
                appendToOutput('Desconectado del servidor MCP', 'system');
                
                // Intentar reconectar
                if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                    reconnectAttempts++;
                    appendToOutput(`Intentando reconectar (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`, 'system');
                    setTimeout(connectWebSocket, 3000);
                }
            };
        } catch (error) {
            console.error('Error al conectar WebSocket:', error);
            updateStatus('error');
            appendToOutput(`Error al conectar: ${error.message}`, 'error');
        }
    }
    
    // Manejar mensajes recibidos del WebSocket
    function handleMessage(message) {
        switch (message.type) {
            case 'connection':
                sessionId = message.sessionId;
                appendToOutput(`Sesión iniciada: ${sessionId}`, 'system');
                break;
                
            case 'processing':
                appendToOutput(message.message, 'system');
                break;
                
            case 'result':
                appendToOutput(`Operación: ${message.operation} en colección: ${message.collection}`, 'info');
                appendToOutput(`Encontrados: ${message.metadata.resultCount} documento(s)`, 'info');
                if (message.metadata.usedImage) {
                    appendToOutput(`Se procesó imagen en la consulta`, 'info');
                }
                appendToOutput('Resultado:', 'label');
                appendToOutput(JSON.stringify(message.result, null, 2), 'json');
                break;
                
            case 'error':
                appendToOutput(`Error: ${message.message}`, 'error');
                break;
                
            case 'context_reset':
                sessionId = message.sessionId;
                appendToOutput(`Contexto reseteado. Nueva sesión: ${sessionId}`, 'system');
                break;
                
            default:
                appendToOutput(`Mensaje recibido: ${JSON.stringify(message)}`, 'system');
        }
    }
    
    // Enviar una consulta al MCP
    function sendQuery() {
        const query = mcpInput.value.trim();
        
        if (!query) return;
        
        if (!isConnected) {
            appendToOutput('No conectado al servidor MCP', 'error');
            return;
        }
        
        // Comandos especiales
        if (query === '!reset') {
            ws.send(JSON.stringify({
                type: 'reset_context'
            }));
            mcpInput.value = '';
            return;
        }
        
        // Preparar el payload
        const payload = {
            type: 'query',
            query: query,
            sessionId: sessionId
        };
        
        // Añadir URL de imagen si está presente
        const imageUrl = imageUrlInput.value.trim();
        if (imageUrl) {
            payload.imageUrl = imageUrl;
            appendToOutput(`> Consulta con imagen: ${imageUrl}`, 'system');
        }
        
        // Enviar consulta normal
        appendToOutput(`> ${query}`, 'query');
        
        ws.send(JSON.stringify(payload));
        
        // Limpiar inputs
        mcpInput.value = '';
        
        // Resetear la sección de imagen
        if (imageUrl) {
            imageUrlInput.value = '';
            imageUrlContainer.style.display = 'none';
            imageToggleButton.textContent = '🖼️ Añadir Imagen';
        }
    }
    
    // Agregar texto al área de salida
    function appendToOutput(text, type = 'normal') {
        const entry = document.createElement('div');
        
        switch (type) {
            case 'system':
                entry.style.color = '#888';
                break;
            case 'error':
                entry.style.color = '#f44';
                break;
            case 'query':
                entry.style.color = '#4f8';
                entry.style.fontWeight = 'bold';
                break;
            case 'info':
                entry.style.color = '#48f';
                break;
            case 'label':
                entry.style.color = '#fa4';
                entry.style.fontWeight = 'bold';
                break;
            case 'json':
                entry.style.color = '#aaa';
                entry.style.backgroundColor = '#222';
                entry.style.padding = '4px';
                entry.style.borderRadius = '4px';
                entry.style.marginTop = '4px';
                entry.style.marginBottom = '8px';
                break;
        }
        
        entry.textContent = text;
        mcpOutput.appendChild(entry);
        mcpOutput.scrollTop = mcpOutput.scrollHeight;
    }
    
    // Actualizar el indicador de estado
    function updateStatus(status) {
        switch (status) {
            case 'connected':
                mcpStatus.style.backgroundColor = '#4f8';
                break;
            case 'disconnected':
                mcpStatus.style.backgroundColor = '#f44';
                break;
            case 'error':
                mcpStatus.style.backgroundColor = '#f84';
                break;
        }
    }
    
    // Alternar visibilidad del panel
    function togglePanel() {
        const isMinimized = mcpPanel.style.height === '30px';
        
        if (isMinimized) {
            mcpPanel.style.height = '300px';
            mcpToggle.textContent = '−';
        } else {
            mcpPanel.style.height = '30px';
            mcpToggle.textContent = '+';
        }
    }
    
    // Hacer un elemento arrastrable
    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        handle.onmousedown = dragMouseDown;
        
        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            // Obtener la posición inicial del cursor
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Llamar a la función cuando el cursor se mueve
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            // Calcular la nueva posición
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Establecer la nueva posición del elemento
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
        
        function closeDragElement() {
            // Detener el movimiento cuando se suelta el ratón
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }
    
    // Agregar manejadores de eventos
    function addEventListeners() {
        // Agregar comandos al editor de Cursor.sh
        document.addEventListener('keydown', function(e) {
            // Ctrl+Alt+M para mostrar/ocultar el panel MCP
            if (e.ctrlKey && e.altKey && e.key === 'm') {
                e.preventDefault();
                mcpPanel.style.display = mcpPanel.style.display === 'none' ? 'flex' : 'none';
            }
        });
    }
})(); 