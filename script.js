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

    const openChat = () => {
        widgetContainer.classList.add('open');
        messageInputField.focus();
        if (chatHistory.length === 0) {
            showWelcomeMessage();
        }
    };

    openChatBtn.addEventListener('click', openChat);
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

    const linkify = (text) => {
        const fragment = document.createDocumentFragment();
        const urlRegex = /((?:https?:\/\/|www\.)[^\s\/$.?#].[^\s]*|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})\b/g;
        const parts = text.split(urlRegex);

        for (const part of parts) {
            if (part && part.match(urlRegex)) {
                const a = document.createElement('a');
                let href = part;
                if (!href.startsWith('http://') && !href.startsWith('https://')) {
                    href = '//' + href;
                }
                a.href = href;
                a.textContent = part;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                fragment.appendChild(a);
            } else if (part) {
                fragment.appendChild(document.createTextNode(part));
            }
        }
        return fragment;
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
                    messageBubble.appendChild(linkify(part.content));
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
            messageBubble.appendChild(linkify(message.text));
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
            sessionStorage.setItem('chatHistory', JSON.stringify(chatHistory));
        } catch (e) {
            console.error("Could not save chat history:", e);
        }
    };
    
    const loadChatHistory = () => {
        try {
            const savedHistory = sessionStorage.getItem('chatHistory');
            if (savedHistory) {
                chatHistory = JSON.parse(savedHistory);
                lastMessageDate = null; // Reset last message date
                messagesContainer.innerHTML = ''; // Clear existing messages
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

    const showWelcomeMessage = () => {
        addMessageToHistory("¡Hola! Soy tu Asistente Virtual. ¿En qué puedo ayudarte hoy?", MESSAGE_SENDER.BOT);
    };

    const extractBotMessage = (responseData) => {
        if (Array.isArray(responseData) && responseData.length > 0 && responseData[0].Respuesta) {
            return [{ type: 'text', content: responseData[0].Respuesta }];
        }
        if (responseData && responseData.reply && Array.isArray(responseData.reply)) {
            return responseData.reply;
        }
        if (responseData && typeof responseData === 'object' && responseData !== null) {
            const text = responseData.reply || responseData.text || responseData.output;
            if (text) return [{ type: 'text', content: text }];
        }
        if(typeof responseData === 'string') {
            try {
                const parsed = JSON.parse(responseData);
                return extractBotMessage(parsed);
            } catch(e) {
                return [{ type: 'text', content: responseData }];
            }
        }
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
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMessage,
                    history: chatHistory.slice(-10) 
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            if (response.status === 204) {
                 addMessageToHistory("El asistente no generó una respuesta.", MESSAGE_SENDER.BOT);
            } else {
                const responseData = await response.json();
                const botMessage = extractBotMessage(responseData);
                addMessageToHistory(botMessage, MESSAGE_SENDER.BOT);
            }

        } catch (error) {
            console.error('Error al comunicar con el webhook:', error);
            const errorMessage = 'Lo siento, no pude conectarme con el asistente. Por favor, inténtalo de nuevo.';
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