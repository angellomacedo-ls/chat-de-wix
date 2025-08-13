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
        if(isLoading) {
            messageInputField.disabled = true;
        } else {
            messageInputField.disabled = false;
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
        const messageDate = new Date(message.timestamp);
        
        if (!lastMessageDate || messageDate.toDateString() !== lastMessageDate.toDateString()) {
            const dateSeparator = document.createElement('div');
            dateSeparator.classList.add('date-separator');
            dateSeparator.textContent = formatDateSeparator(messageDate);
            messagesContainer.appendChild(dateSeparator);
        }
        lastMessageDate = messageDate;

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
        try {
            const savedHistory = localStorage.getItem('chatHistory');
            if (savedHistory) {
                chatHistory = JSON.parse(savedHistory);
                chatHistory.forEach(message => {
                    try {
                        displayMessage(message);
                    } catch (e) {
                        console.error("Could not display message:", message, e);
                    }
                });
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
        // Handles the specific format from n8n: [{"Respuesta": "..."}]
        if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].Respuesta) {
            return [{ type: 'text', content: responseData[0].Respuesta }];
        }

        // Handles the format for links: {"reply": [...]}
        if (responseData && responseData.reply && Array.isArray(responseData.reply)) {
            return responseData.reply;
        }
        
        // Handles simple objects: {"text": "..."} or {"output": "..."}
        if (responseData && typeof responseData === 'object' && responseData !== null) {
            const text = responseData.reply || responseData.text || responseData.output;
            if (text) return [{ type: 'text', content: text }];
        }

        // Handles a plain string response
        if(typeof responseData === 'string') {
            return [{ type: 'text', content: responseData }];
        }

        // Fallback for any other unexpected format
        return [{ type: 'text', content: "No se recibió una respuesta válida." }];
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

            if (response.status === 204) {
                addMessageToHistory([{ type: 'text', content: "El asistente recibió el mensaje, pero no generó una respuesta." }], MESSAGE_SENDER.BOT);
            } else {
                const responseText = await response.text();
                let botMessage;
                try {
                    const responseData = JSON.parse(responseText);
                    botMessage = extractBotMessage(responseData);
                } catch (e) {
                    botMessage = extractBotMessage(responseText);
                }
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