const chatForm = document.querySelector("#chat-form");
const chatMessages = document.querySelector("#chat-box");
const messageInput = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-btn");

if (chatForm && chatMessages && messageInput && sendButton) {
  const conversation = [];

  const addMessage = (text, sender) => {
    const message = document.createElement("div");
    message.className = `chat-message chat-message-${sender}`;
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    message.append(paragraph);
    chatMessages.append(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  };

  const getReply = async (question) => {
    if (window.location.protocol === "file:") {
      throw new Error("Open the chat through the local server at http://localhost:3000/chat.html.");
    }

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [...conversation, { role: "user", content: question }].slice(-12)
      })
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("The assistant returned an invalid response. Please try again.");
    }

    if (!response.ok) {
      throw new Error(typeof result.error === "string" ? result.error : "The assistant could not answer right now.");
    }

    if (typeof result.reply !== "string" || !result.reply.trim()) {
      throw new Error("The assistant returned an invalid response.");
    }

    conversation.push({ role: "user", content: question }, { role: "assistant", content: result.reply });
    return result.reply;
  };

  const submitQuestion = async (question) => {
    const trimmedQuestion = question.trim();
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
