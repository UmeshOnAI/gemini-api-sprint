document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('record-btn');
    const showCanvasBtn = document.getElementById('show-canvas-btn');
    const hideCanvasBtn = document.getElementById('hide-canvas-btn');
    const generateImageBtn = document.getElementById('generate-image-btn');
    const chatLog = document.getElementById('chat-log');
    const drawingContainer = document.getElementById('drawing-container');
    const imageDisplay = document.getElementById('image-display');
    const controls = document.getElementById('controls');

    const API_URL = 'http://127.0.0.1:5001';
    let conversationHistory = [];
    let isRecording = false;

    // --- Speech Recognition Setup ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert("Sorry, your browser doesn't support Speech Recognition.");
        return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    // --- Drawing Board Setup ---
    const board = new DrawingBoard.Board('drawing-board', {
        background: "#FFFFFF",
        color: "#000000",
        size: 10,
        webStorage: false, // Don't save drawings locally
        controls: ['Color', { Size: { type: 'dropdown' } }, 'DrawingMode', 'Navigation'],
    });

    // --- UI Update Functions ---
    const addToLog = (speaker, message) => {
        const entry = document.createElement('div');
        entry.classList.add(speaker); // 'user' or 'ai'
        entry.innerHTML = `<strong>${speaker.charAt(0).toUpperCase() + speaker.slice(1)}:</strong> ${message}`;
        chatLog.appendChild(entry);
        chatLog.scrollTop = chatLog.scrollHeight;
    };

    const speak = (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        speechSynthesis.speak(utterance);
    };
    
    // --- API Communication ---
    const sendChatMessage = async (message) => {
        try {
            const response = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: message, history: conversationHistory })
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            addToLog('ai', data.reply);
            conversationHistory.push({ role: "user", parts: [message] });
            conversationHistory.push({ role: "model", parts: [data.reply] });
            speak(data.reply);
            showCanvasBtn.style.display = 'inline-block';
        } catch (error) {
            console.error("Error sending chat message:", error);
            addToLog('ai', "I'm sorry, I'm having trouble connecting. Please try again later.");
        }
    };

    // --- Event Handlers ---
    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    recognition.onstart = () => {
        isRecording = true;
        recordBtn.textContent = 'Stop Recording';
        recordBtn.style.backgroundColor = '#d92828';
    };

    recognition.onend = () => {
        isRecording = false;
        recordBtn.textContent = 'Start Recording';
        recordBtn.style.backgroundColor = '#6d28d9';
    };
    
    let finalTranscript = '';
    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // When we have a final transcript, send it to the backend
        if (finalTranscript) {
            addToLog('user', finalTranscript);
            sendChatMessage(finalTranscript);
            finalTranscript = ''; // Reset for the next utterance
        }
    };
    
    showCanvasBtn.addEventListener('click', () => {
        drawingContainer.style.display = 'block';
        controls.style.display = 'none';
        chatLog.style.display = 'none';
    });

    hideCanvasBtn.addEventListener('click', () => {
        drawingContainer.style.display = 'none';
        controls.style.display = 'flex';
        chatLog.style.display = 'block';
    });
    
    generateImageBtn.addEventListener('click', async () => {
        const imageData = board.getImg();
        generateImageBtn.disabled = true;
        generateImageBtn.textContent = 'Generating...';

        try {
            const response = await fetch(`${API_URL}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageData: imageData, history: conversationHistory })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // Display the generated image
            imageDisplay.innerHTML = `<img src="${data.imageUrl}" alt="Generated Dream Vision">`;
            
            // Integrate the result back into the conversation
            const aiMessage = `Thank you for sharing that vision. It seems to have a powerful energy. Let's talk about what you see here. How does this image make you feel?`;
            addToLog('ai', aiMessage);
            conversationHistory.push({ role: "model", parts: [aiMessage] });
            speak(aiMessage);

        } catch (error) {
            console.error("Error generating image:", error);
            addToLog('ai', "I'm sorry, I couldn't bring that vision to life. Let's continue talking instead.");
        } finally {
            generateImageBtn.disabled = false;
            generateImageBtn.textContent = 'Generate Vision';
            hideCanvasBtn.click(); // Go back to chat
        }
    });
});
