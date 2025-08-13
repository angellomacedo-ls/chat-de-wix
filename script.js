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

    messagesContainer.addEventListener('scroll', () => {
        const threshold = 200;
        const isScrolledUp = messagesContainer.scrollHeight - messagesContainer.scrollTop > messagesContainer.clientHeight + threshold;
        scrollToBottomBtn.classList.toggle('hidden', !isScrolledUp);
    });

    scrollToBottomBtn.addEventListener('click', () => {
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    });

    const setUILoadingState = (isLoading) => {
        sendButton.disabled = isLoading;
        typingIndicator.classList.toggle('hidden', !isLoading);
        messageInputField.disabled = isLoading;
        if (!isLoading) {
            messageInputField.focus();
        }
    };

    const formatDateSeparator = (date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return 'Hoy';
        if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
        return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    const displayMessage = (message) => {
        if (!message || !message.text || !message.sender || !message.timestamp) {
            console.error("Invalid message object:", message);
            return; 
        }

        const messageDate = new Date(message.timestamp);
        if (isNaN(messageDate.getTime())) {
            console.error("Invalid timestamp for message:", message);
            return;
        }

        if (!lastMessageDate || messageDate.toDateString() !== lastMessageDate.toDateString()) {
            const dateSeparator = document.createElement('div');
            dateSeparator.classList.add('date-separator');
            dateSeparator.textContent = formatDateSeparator(messageDate);
            messagesContainer.appendChild(dateSeparator);
            lastMessageDate = messageDate;
        }

        const isScrolledToBottom = messagesContainer.scrollHeight - messagesContainer.clientHeight <= messagesContainer.scrollTop + 1;

        const time = messageDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const messageContainer = document.createElement('li');
        messageContainer.classList.add('message-container', `${message.sender}-message-container`);

        const messageBubble = document.createElement('div');
        messageBubble.classList.add('message', `${message.sender}-message`);

        if (Array.isArray(message.text)) {
            message.text.forEach(part => {
                if (part.type === 'text' && part.content) {
                    messageBubble.appendChild(document.createTextNode(part.content));
                } else if (part.type === 'link' && part.url && part.text) {
                    const link = document.createElement('a');
                    link.href = part.url;
                    link.textContent = part.text;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    messageBubble.appendChild(link);
                }
            });
        } else if (typeof message.text === 'string') {
            messageBubble.appendChild(document.createTextNode(message.text));
        }

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
        const savedHistory = localStorage.getItem('chatHistory');
        if (!savedHistory) return;

        try {
            const parsedHistory = JSON.parse(savedHistory);
            if (Array.isArray(parsedHistory)) {
                chatHistory = parsedHistory;
                messagesContainer.innerHTML = ''; // Clear previous messages
                lastMessageDate = null;
                chatHistory.forEach(displayMessage);
            }
        } catch (e) {
            console.error("Could not load or parse chat history, clearing it.", e);
            localStorage.removeItem('chatHistory');
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
        if (responseData?.reply && Array.isArray(responseData.reply)) {
            return responseData.reply;
        }
        let content = "No se recibió una respuesta válida.";
        if (typeof responseData === 'string') {
            content = responseData;
        } else if (typeof responseData === 'object' && responseData !== null) {
            content = responseData.reply || responseData.text || responseData.output || JSON.stringify(responseData);
        }
        return [{ type: 'text', content }];
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: chatHistory.slice(-10) 
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (response.status === 204) {
                addMessageToHistory([{ type: 'text', content: "El asistente recibió el mensaje, pero no generó una respuesta." }], MESSAGE_SENDER.BOT);
            } else {
                const responseData = await response.json();
                const botMessage = extractBotMessage(responseData);
                addMessageToHistory(botMessage, MESSAGE_SENDER.BOT);
            }

        } catch (error) {
            console.error('Error al comunicar con el webhook:', error);
            const errorMessage = 'Lo siento, no pude conectarme con el asistente en este momento. Por favor, inténtalo de nuevo más tarde.';
            addMessageToHistory([{ type: 'text', content: errorMessage }], MESSAGE_SENDER.BOT);
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