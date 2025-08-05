document.addEventListener('DOMContentLoaded', () => {
    const n8nWebhookUrl = 'https://angellomacedo.app.n8n.cloud/webhook-test/7121dfe8-1a50-4c64-b1ea-90465e913322';
    
    const widgetContainer = document.getElementById('chat-widget-container');
    const openChatBtn = document.getElementById('open-chat-btn');
    const closeChatBtn = document.getElementById('close-chat-btn');
    
    const messageForm = document.getElementById('message-form');
    const messageInputField = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const sendButton = document.getElementById('send-button');

    const MESSAGE_SENDER = { USER: 'user', BOT: 'bot' };
    let chatHistory = [];

    openChatBtn.addEventListener('click', () => widgetContainer.classList.add('open'));
    closeChatBtn.addEventListener('click', () => widgetContainer.classList.remove('open'));

    const setUILoadingState = (isLoading) => {
        sendButton.disabled = isLoading;
        typingIndicator.classList.toggle('hidden', !isLoading);
        if(isLoading) {
            messageInputField.disabled = true;
        } else {
            messageInputField.disabled = false;
            messageInputField.focus();
        }
    };

    const markdownToHtml = (text) => {
        return text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    };

    const displayMessage = (message) => {
        const formattedText = markdownToHtml(message.text);
        const time = new Date(message.timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const messageContainer = document.createElement('li');
        messageContainer.classList.add('message-container', `${message.sender}-message-container`);
        messageContainer.innerHTML = `
            <div class="message ${message.sender}-message">${formattedText}</div>
            <span class="timestamp">${time}</span>
        `;
        messagesContainer.appendChild(messageContainer);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const saveChatHistory = () => {
        try {
            localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        } catch (e) {
            console.error("Could not save chat history:", e);
        }
    };
    
    const loadChatHistory = () => {
        try {
            const savedHistory = localStorage.getItem('chatHistory');
            if (savedHistory) {
                chatHistory = JSON.parse(savedHistory);
                chatHistory.forEach(displayMessage);
            }
        } catch (e) {
            console.error("Could not load chat history:", e);
            chatHistory = [];
        }
    };

    const addMessageToHistory = (text, sender) => {
        const message = { text, sender, timestamp: new Date().toISOString() };
        chatHistory.push(message);
        saveChatHistory();
        displayMessage(message);
    };

    const extractBotMessage = (responseData) => {
        // Intenta parsear la respuesta si es un string JSON
        let data = responseData;
        if (typeof data === 'string') {
            try {
                data = JSON.parse(data);
            } catch (e) {
                // Si no es un JSON válido, devuelve el texto tal cual
                return responseData;
            }
        }

        if (Array.isArray(data) && data.length > 0) {
            // Busca la propiedad 'Respuesta' en el primer objeto del array
            if(data[0].body && data[0].body.Respuesta) {
                return data[0].body.Respuesta;
            }
            // Fallback a otras posibles estructuras
            return data[0].Respuesta || JSON.stringify(data[0]);
        }
        if (data && data.reply) {
            return data.reply;
        }
        // Si la respuesta es un JSON pero no tiene la estructura esperada
        if(typeof data === 'object' && data !== null) {
            return JSON.stringify(data);
        }
        // Fallback final
        return "No se recibió una respuesta válida.";
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const userMessage = messageInputField.value.trim();
        if (!userMessage) return;

        addMessageToHistory(userMessage, MESSAGE_SENDER.USER);
        messageInputField.value = '';
        setUILoadingState(true);

        try {
            const response = await fetch(n8nWebhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: userMessage,
                    history: chatHistory.slice(-10) 
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // n8n puede devolver el JSON dentro de un campo 'data' o directamente
            const responseData = await response.json();
            const botMessage = extractBotMessage(responseData);
            addMessageToHistory(botMessage, MESSAGE_SENDER.BOT);

        } catch (error) {
            console.error('Error al comunicar con el webhook:', error);

            if (error.response) {
                error.response.text().then(text => {
                    console.error('Respuesta del servidor (texto):', text);
                });
            }
            
            const errorMessage = 'Lo siento, no pude conectarme con el asistente en este momento. Por favor, inténtalo de nuevo más tarde.';
            addMessageToHistory(errorMessage, MESSAGE_SENDER.BOT);
        } finally {
            setUILoadingState(false);
        }
    };

    messageForm.addEventListener('submit', handleFormSubmit);
    
    messageInputField.addEventListener('input', () => {
        sendButton.disabled = messageInputField.value.trim() === '';
    });

    loadChatHistory();
    setUILoadingState(false);
});