document.addEventListener("DOMContentLoaded", function () {
  const chatbotContainer = document.getElementById("chatbot-container");
  const closeBtn = document.getElementById("close-btn");
  const clearBtn = document.getElementById("clear-btn");
  const endChatBtn = document.getElementById("end-chat-btn");
  const sendBtn = document.getElementById("send-btn");
  const chatBotInput = document.getElementById("chatbot-input");
  const chatbotMessages = document.getElementById("chatbot-messages");
  const chatbotIcon = document.getElementById("chatbot-icon");
  const typingIndicator = document.getElementById("typing-indicator");

  let isFirstOpen = true;
  let conversationHistory = [];
  let idleTimeout;
  const MAX_RETRIES = 2;
  const sessionId = generateSessionId(); // Unique session ID for chat history

  chatbotIcon.addEventListener("click", async () => {
    chatbotContainer.classList.remove("hidden");
    chatbotIcon.style.display = "none";
    if (isFirstOpen) {
      displayWelcomeMessage();
      await loadChatHistory(); // Load previous chat history
      isFirstOpen = false;
    }
    resetIdleTimer();
  });

  closeBtn.addEventListener("click", confirmEndChat);
  endChatBtn.addEventListener("click", confirmEndChat);
  clearBtn.addEventListener("click", async () => {
    chatbotMessages.innerHTML = "";
    conversationHistory = [];
    displayWelcomeMessage();
    await clearChatHistory(); // Clear chat history in MongoDB
    resetIdleTimer();
  });

  sendBtn.addEventListener("click", sendMessage);
  chatBotInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  function generateSessionId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function saveChatMessage(role, text) {
    try {
      await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          role,
          text,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  }

  async function loadChatHistory() {
    try {
      const response = await fetch(`http://localhost:3000/api/chat/${sessionId}`);
      const messages = await response.json();
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          appendMessage(msg.role, msg.text, false, new Date(msg.timestamp));
          conversationHistory.push({ role: msg.role, text: msg.text });
        });
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  }

  async function clearChatHistory() {
    try {
      await fetch(`http://localhost:3000/api/chat/${sessionId}`, {
        method: 'DELETE',
      });
    } catch (error) {
      console.error('Error clearing chat history:', error);
    }
  }

  function resetIdleTimer() {
    clearTimeout(idleTimeout);
    idleTimeout = setTimeout(() => {
      appendMessage("bot", "Let me know if you need anything else. Click 'End Chat' to close this session.");
      setTimeout(() => {
        chatbotContainer.classList.add("hidden");
        chatbotIcon.style.display = "flex";
        chatbotMessages.innerHTML = "";
        conversationHistory = [];
        isFirstOpen = true;
      }, 3000);
    }, 5 * 60 * 1000); // 5 minutes
  }

  function confirmEndChat() {
    const shouldEnd = confirm("Are you sure you want to end the chat? Your conversation will be cleared.");
    if (shouldEnd) {
      chatbotContainer.classList.add("hidden");
      chatbotIcon.style.display = "flex";
      chatbotMessages.innerHTML = "";
      conversationHistory = [];
      isFirstOpen = true;
      clearTimeout(idleTimeout);
      clearChatHistory();
    }
  }

  function displayWelcomeMessage() {
    const welcomeMessage = "Hi, I'm AIISH CARE. How can I help you today?";
    appendMessage("bot", welcomeMessage, true);
    saveChatMessage("bot", welcomeMessage);
    appendQuickReplies([
      { text: "Book Appointment", message: "How can I book an appointment?" },
      { text: "Stuttering Help", message: "What exercises help with stuttering?" },
      { text: "Clinic Hours", message: "What are the clinic's operating hours?" },
      { text: "Teletherapy", message: "Tell me about teletherapy." },
      { text: "Aphasia Info", message: "What is aphasia?" },
      { text: "Child Therapy", message: "What therapy options are available for children?" },
    ]);
  }

  function appendQuickReplies(replies) {
    const replyContainer = document.createElement("div");
    replyContainer.classList.add("quick-replies");
    replies.forEach((reply) => {
      const button = document.createElement("button");
      button.textContent = reply.text;
      button.classList.add("quick-reply-btn");
      button.addEventListener("click", () => {
        appendMessage("user", reply.message);
        conversationHistory.push({ role: "user", text: reply.message });
        saveChatMessage("user", reply.message);
        getBotResponse(reply.message);
        replyContainer.remove();
        resetIdleTimer();
      });
      replyContainer.appendChild(button);
    });
    chatbotMessages.appendChild(replyContainer);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  function sendMessage() {
    const userMessage = chatBotInput.value.trim();
    if (userMessage) {
      appendMessage("user", userMessage);
      conversationHistory.push({ role: "user", text: userMessage });
      saveChatMessage("user", userMessage);
      chatBotInput.value = "";
      getBotResponse(userMessage);
      resetIdleTimer();
    }
  }

  function appendMessage(sender, message, isWelcome = false, timestamp = new Date()) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message", sender);
    if (isWelcome) messageElement.classList.add("welcome-message");

    const textElement = document.createElement("div");
    textElement.classList.add("message-text");
    textElement.textContent = message;

    const timeElement = document.createElement("div");
    timeElement.classList.add("message-time");
    timeElement.textContent = timestamp.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    messageElement.appendChild(textElement);
    messageElement.appendChild(timeElement);
    chatbotMessages.appendChild(messageElement);
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }

  async function getBotResponse(userMessage, retryCount = 0) {
    typingIndicator.classList.remove("hidden");
    const API_KEY = "AIzaSyDlk3x1Gpn9K-Wv48VICK__gy6B-1VUfOY";
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;

    const sanitizedMessage = userMessage.replace(/[<>]/g, "");
    const conversationContext = conversationHistory
      .slice(-6)
      .map((msg) => `${msg.role === "user" ? "Patient" : "Assistant"}: ${msg.text}`)
      .join("\n");

    const fullPrompt = `
You are AIISH CARE, a virtual health assistant at AIISH, Mysuru. Respond in one short, professional sentence. Stay on-topic and context-aware.

Below are example responses for common queries:

- Query: "greetings" or "hi" or "hello"
  Response: Hello, it's nice to assist you today. How can I help with your speech therapy needs?
- Query: "how can i book an appointment" or "appointments"
  Response: You can book an appointment through our online portal, which is quick and easy. Would you like the link to the portal or a guide to get started?
- Query: "what kind of exercises help with stuttering"
  Response: Stuttering therapy includes breathing exercises and fluency-shaping techniques tailored by our clinicians. Would you like to learn about our personalized therapy tools?
- Query: "what are the clinic operating hours"
  Response: Our clinic is open Monday to Friday, 9 AM to 5 PM. Would you like to schedule an appointment during those hours?
- Query: "can i record my therapy session"
  Response: Yes, with your clinician's consent, you can record sessions for review, stored securely for 12 months. Would you like to know more about session features like shared notes?
- Query: "what services are offered" or "speech therapy services"
  Response: We provide speech therapy, audiology, and rehabilitation engineering for various needs. Are you looking for a specific service?
- Query: "teletherapy" or "online therapy"
  Response: Our teletherapy sessions are conducted securely online, offering flexibility. Would you like to book a teletherapy session or learn more?
- Query: "cost of therapy" or "fees"
  Response: Therapy costs depend on the session type, and we can provide a detailed estimate during consultation. Would you like to schedule a consultation to discuss pricing?
- Query: "accessibility features" or "support for disabilities"
  Response: Our platform supports screen readers and adjustable text for accessibility. Would you like details on how we can accommodate specific needs?
- Query: "cancel appointment" or "reschedule appointment"
  Response: You can cancel or reschedule appointments easily through our online portal. Would you like the link to manage your appointment?
- Query: "speech therapy for children" or "pediatric therapy"
  Response: We offer child-friendly speech therapy tailored to young patients' needs. Would you like to arrange a consultation for a child?
- Query: "how to prepare for a session" or "session preparation"
  Response: Prepare a quiet space and any materials recommended by your clinician for a productive session. Would you like tips for a specific therapy type?
- Query: "contact information" or "how to reach the clinic"
  Response: You can contact us at +91-821-2502100 or through our website’s contact form. Would you prefer the website link or more details?
- Query: "what is aphasia" or "aphasia information"
  Response: Aphasia is a condition affecting language comprehension and expression, often caused by brain injury. Would you like to explore therapy options for aphasia?
- Query: "dysarthria" or "what is dysarthria"
  Response: Dysarthria involves difficulty with speech due to muscle weakness, and our therapists can help improve clarity. Would you like to discuss treatment plans for dysarthria?
- Query: "track therapy progress" or "how to monitor progress"
  Response: Your clinician will provide progress reports, and our platform tracks session outcomes. Would you like to schedule a review with your therapist?
- Query: "post-session exercises" or "exercises after therapy"
  Response: Your clinician will assign specific exercises to practice at home, accessible via our portal. Would you like guidance on accessing these materials?
- Query: "insurance" or "does insurance cover therapy"
  Response: Insurance coverage varies, and our office can verify your plan’s benefits. Would you like us to assist with an insurance inquiry?
- Query: "emergency contact" or "urgent help"
  Response: For urgent issues, please call our clinic at +91-821-2502100 or visit the nearest hospital. Can I help with non-urgent questions now?
- Query: "clinician qualifications" or "therapist credentials"
  Response: Our clinicians are certified speech-language pathologists with extensive training. Would you like to know more about our team or book with a specific therapist?
- Default (unrecognized queries)
  Response: I'm not sure I fully understand your question, but I'm here to help. Could you provide more details, or would you like to schedule a consultation?

End responses with a helpful follow-up question if possible.

Conversation history:
${conversationContext}

Current patient query: ${sanitizedMessage}
`;

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
        }),
      });

      typingIndicator.classList.add("hidden");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.candidates || !data.candidates.length) {
        throw new Error("No response from Gemini API");
      }

      let botMessage = data.candidates[0].content.parts[0].text.trim();

      if (botMessage.length < 10 || botMessage.includes("I don't understand")) {
        botMessage = "I'm not sure I understood that. Can you rephrase or give more details?";
      }

      appendMessage("bot", botMessage);
      conversationHistory.push({ role: "bot", text: botMessage });
      saveChatMessage("bot", botMessage);
    } catch (error) {
      console.error("Error:", error);
      if (retryCount < MAX_RETRIES) {
        setTimeout(() => getBotResponse(userMessage, retryCount + 1), 1000);
        return;
      }
      typingIndicator.classList.add("hidden");
      const errorMessage = "I'm having trouble responding now. Try again later or contact the clinic.";
      appendMessage("bot", errorMessage);
      conversationHistory.push({ role: "bot", text: errorMessage });
      saveChatMessage("bot", errorMessage);
    }
  }
});