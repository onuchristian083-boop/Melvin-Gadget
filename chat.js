const chatForm = document.querySelector("#chat-form");
const chatMessages = document.querySelector("#chat-box");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-btn");

 
const API_BASE_URL = "http://localhost:3000";

const MAX_USER_MESSAGE_LENGTH = 500;  
const MAX_HISTORY = 12;               
const REQUEST_TIMEOUT_MS = 60000;

if (chatForm && chatMessages && messageInput && sendButton) {
  const conversation = [];

  messageInput.maxLength = MAX_USER_MESSAGE_LENGTH;

  const addMessage = (text, sender) => {
    const message = document.createElement("div");
    message.className = `chat-message chat-message-${sender}`;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    paragraph.style.whiteSpace = "pre-line"; 
    message.append(paragraph);
    chatMessages.append(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const getReply = async (question) => {
    if (window.location.protocol === "file:") {
      throw new Error("Open the chat through the local server at http://localhost:3000/chat.html.");
    }

    const messages = [...conversation, { role: "user", content: question }].slice(-MAX_HISTORY);

    let response;
    try {
      response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });
    } catch (error) {
      console.error("Network error:", error);
      if (error && error.name === "TimeoutError") {
        throw new Error("The assistant is taking too long. Please try again.");
      }
      throw new Error("I can't reach the server right now. Check your connection and try again.");
    }

     
    const rawText = await response.text();
    let result;
    try {
      result = JSON.parse(rawText);
    } catch {
      console.error(`Server sent (status ${response.status}):`, rawText.slice(0, 300));

      
      if (response.status === 404 || response.status === 405 || /^\s*</.test(rawText)) {
        throw new Error(
          "The chat server was not found. This page must be served by server.js (Node), not a static host."
        );
      }
      if (response.status >= 500) {
        throw new Error("The server had a problem. Please try again in a moment.");
      }
      throw new Error("The assistant returned an invalid response. Please try again.");
    }

    if (!response.ok) {
      throw new Error(
        typeof result.error === "string" ? result.error : "The assistant could not answer right now."
      );
    }

    if (typeof result.reply !== "string" || !result.reply.trim()) {
      console.error("Unexpected response shape:", result);
      throw new Error("The assistant returned an empty response. Please try again.");
    }

    conversation.push({ role: "user", content: question }, { role: "assistant", content: result.reply });
    return result.reply;
  };

  const submitQuestion = async (question) => {
    const trimmedQuestion = question.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
    if (!trimmedQuestion || sendButton.disabled) return;

    addMessage(trimmedQuestion, "user");
    messageInput.value = "";
    messageInput.disabled = true;
    sendButton.disabled = true;
    sendButton.textContent = "Thinking...";

    try {
      addMessage(await getReply(trimmedQuestion), "assistant");
    } catch (error) {
      console.error("Could not get a reply from the Melvin Gadgets assistant.", error);
      addMessage(error.message || "The assistant could not answer right now. Please try again.", "assistant");
    } finally {
      messageInput.disabled = false;
      sendButton.disabled = false;
      sendButton.textContent = "Send";
      messageInput.focus();
    }
  };

  chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    submitQuestion(messageInput.value);
  });

  document.querySelectorAll("[data-chat-prompt]").forEach((button) => {
    button.addEventListener("click", () => submitQuestion(button.dataset.chatPrompt || ""));
  });
}