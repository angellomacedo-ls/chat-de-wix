document.addEventListener('DOMContentLoaded', () => {
    const n8nWebhookUrl = 'https://angellomacedo.app.n8n.cloud/webhook/7121dfe8-1a50-4c64-b1ea-90465e913322';
    
    const widgetContainer = document.getElementById('chat-widget-container');
    const openChatBtn = document.getElementById('open-chat-btn');
    const closeChatBtn = document.getElementById('close-chat-btn');
    
    const messageForm = document.getElementById('message-form');
    const messageInputField = document.getElementById('message-input');
    const messagesContainer = document.getElementById('messages');
    const typingIndicator = document.getElementById('typing-indicator');
    const sendButton = document.getElementById('send-button');
    const scrollToBottomBtn = document.getElementById('scroll-to-bottom-btn');

    const MESSAGE_SENDER = { USER: 'user', BOT: 'bot' };
    let chatHistory = [];
    let lastMessageDate = null;

    openChatBtn.addEventListener('click', () => widgetContainer.classList.add('open'));
    closeChatBtn.addEventListener('click', () => widgetContainer.classList.remove('open'));

    // Lógica para el botón de scroll
    messagesContainer.addEventListener('scroll', () => {
        const threshold = 200; // Píxeles desde el fondo para mostrar el botón
        const isScrolledUp = messagesContainer.scrollHeight - messagesContainer.scrollTop > messagesContainer.clientHeight + threshold;
        scrollToBottomBtn.classList.toggle('hidden', !isScrolledUp);
    });

    scrollToBottomBtn.addEventListener('click', () => {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    });

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

    const processMessageText = (text) => {
        const markdownLinkRegex = /\*\[([^\]]+)\]\(([^)]+)\)\*/g;
        const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%?=~_|])(?![^<]*>|[^<>]*<\/a>)/ig;

        const processedText = text
            .replace(markdownLinkRegex, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            .replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);

        return processedText
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    };

    const formatDateSeparator = (date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Hoy';
        }
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Ayer';
        }
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const displayMessage = (message) => {
        const messageDate = new Date(message.timestamp);
        
        if (!lastMessageDate || messageDate.toDateString() !== lastMessageDate.toDateString()) {
            const dateSeparator = document.createElement('div');
            dateSeparator.classList.add('date-separator');
            dateSeparator.textContent = formatDateSeparator(messageDate);
            messagesContainer.appendChild(dateSeparator);
        }
        lastMessageDate = messageDate;

        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 1;

        const formattedText = processMessageText(message.text);
        const time = messageDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const messageContainer = document.createElement('li');
        messageContainer.classList.add('message-container', `${message.sender}-message-container`);

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message', `${message.sender}-message`);
        messageBubble.innerHTML = formattedText; // innerHTML es seguro aquí porque processMessageText sanitiza el contenido.

        const timestampSpan = document.createElement('span');
        timestampSpan.classList.add('timestamp');
        timestampSpan.textContent = time;

        messageContainer.appendChild(messageBubble);
        messageContainer.appendChild(timestampSpan);
        messagesContainer.appendChild(messageContainer);

        if (isScrolledToBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
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
        // Prioridad 1: Buscar una propiedad 'reply' o 'text' o 'output' en el objeto principal.
        if (responseData && typeof responseData === 'object') {
            if (responseData.reply) return responseData.reply;
            if (responseData.text) return responseData.text;
            if (responseData.output) return responseData.output;
        }

        // Prioridad 2: Si es un array, buscar en el primer elemento.
        if (Array.isArray(responseData) && responseData.length > 0) {
            const firstItem = responseData[0];
            if (firstItem && typeof firstItem === 'object') {
                if (firstItem.reply) return firstItem.reply;
                if (firstItem.text) return firstItem.text;
                if (firstItem.output) return firstItem.output;
                if (firstItem.Respuesta) return firstItem.Respuesta; // Para compatibilidad con versiones anteriores
                if (firstItem.body && firstItem.body.Respuesta) return firstItem.body.Respuesta; // Para compatibilidad
            }
        }

        // Si todo lo demás falla, convierte la respuesta a un string para depuración.
        if (typeof responseData === 'object') {
            return JSON.stringify(responseData);
        }

        // Fallback final para respuestas inesperadas.
        return responseData || "No se recibió una respuesta válida.";
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

            // Si la respuesta es "204 No Content", no intentes leer el cuerpo.
            if (response.status === 204) {
                addMessageToHistory("El asistente recibió el mensaje, pero no generó una respuesta.", MESSAGE_SENDER.BOT);
            } else {
                const responseData = await response.json();
                const botMessage = extractBotMessage(responseData);
                addMessageToHistory(botMessage, MESSAGE_SENDER.BOT);
            }

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
