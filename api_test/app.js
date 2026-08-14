const STORAGE_KEY = "local-ai-chat:v1";
const API_KEY_SESSION_KEY = "local-ai-chat:api-key";
const PROVIDER_STORAGE_KEY = `${STORAGE_KEY}:provider`;
const DEFAULT_PROVIDER = "gemini";
const PROVIDERS = {
  gemini: {
    name: "Gemini",
    keyLabel: "Gemini API key",
    keyPlaceholder: "AIza…",
    defaultModel: "gemini-3.5-flash",
    models: [
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-pro-latest",
      "gemini-flash-latest",
      "gemini-flash-lite-latest",
    ],
  },
  openai: {
    name: "OpenAI",
    keyLabel: "OpenAI API key",
    keyPlaceholder: "sk-…",
    defaultModel: "gpt-5.6-terra",
    models: [
      "gpt-5.6",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.6-luna",
      "gpt-5.5",
      "gpt-5.5-pro",
      "gpt-5.4",
      "gpt-5.4-pro",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.3-codex",
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5.1",
      "gpt-5",
      "gpt-5-pro",
      "gpt-5-mini",
      "gpt-5-nano",
      "o3-pro",
      "o3",
      "o4-mini",
      "o3-mini",
      "o1-pro",
      "o1",
      "o1-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4-turbo",
      "gpt-4",
      "gpt-3.5-turbo",
    ],
  },
};

const elements = {
  apiKey: document.querySelector("#api-key"),
  apiKeyLabel: document.querySelector("#api-key-label"),
  chatForm: document.querySelector("#chat-form"),
  chatTitle: document.querySelector("#chat-title"),
  clearHistory: document.querySelector("#clear-history"),
  connectionStatus: document.querySelector("#connection-status"),
  deleteChat: document.querySelector("#delete-chat"),
  emptyState: document.querySelector("#empty-state"),
  errorBanner: document.querySelector("#error-banner"),
  historyList: document.querySelector("#history-list"),
  loadModels: document.querySelector("#load-models"),
  messageInput: document.querySelector("#message-input"),
  messageTemplate: document.querySelector("#message-template"),
  messages: document.querySelector("#messages"),
  modelInput: document.querySelector("#model-input"),
  newChatButton: document.querySelector("#new-chat-button"),
  providerSelect: document.querySelector("#provider-select"),
  sendButton: document.querySelector("#send-button"),
  systemPrompt: document.querySelector("#system-prompt"),
  toggleKey: document.querySelector("#toggle-key"),
};

let state = loadState();
let activeChatId = state.activeChatId;
let requestController = null;

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function newChat() {
  return {
    id: createId(),
    title: "New conversation",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.chats)) {
      if (!saved.chats.length) {
        const chat = newChat();
        return { chats: [chat], activeChatId: chat.id };
      }
      return {
        chats: saved.chats,
        activeChatId: saved.chats.some((chat) => chat.id === saved.activeChatId)
          ? saved.activeChatId
          : saved.chats[0].id,
      };
    }
  } catch (error) {
    console.warn("Could not load chat history.", error);
  }

  const chat = newChat();
  return { chats: [chat], activeChatId: chat.id };
}

function saveState() {
  state.activeChatId = activeChatId;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveChat() {
  return state.chats.find((chat) => chat.id === activeChatId) || state.chats[0];
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(timestamp);
}

function render() {
  const chat = getActiveChat();
  if (!chat) return;

  elements.chatTitle.textContent = chat.title;
  elements.emptyState.hidden = chat.messages.length > 0;

  elements.messages.querySelectorAll(".message").forEach((message) => message.remove());
  chat.messages.forEach((message) => renderMessage(message));

  const sortedChats = [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt);
  elements.historyList.replaceChildren();

  if (!sortedChats.some((item) => item.messages.length)) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = "Your conversations will appear here.";
    elements.historyList.append(empty);
  } else {
    sortedChats
      .filter((item) => item.messages.length)
      .forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `history-item${item.id === activeChatId ? " active" : ""}`;
        button.textContent = item.title;
        button.title = item.title;
        button.addEventListener("click", () => {
          activeChatId = item.id;
          hideError();
          saveState();
          render();
        });
        elements.historyList.append(button);
      });
  }

  requestAnimationFrame(() => {
    elements.messages.scrollTop = elements.messages.scrollHeight;
  });
}

function renderMessage(message, pending = false) {
  const fragment = elements.messageTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".message");
  const role = fragment.querySelector(".message-role");
  const time = fragment.querySelector(".message-time");
  const body = fragment.querySelector(".message-body");
  const copyButton = fragment.querySelector(".copy-button");

  article.classList.add(message.role, ...(pending ? ["pending"] : []));
  role.textContent = message.role === "user" ? "You" : "Assistant";
  time.textContent = formatTime(message.createdAt || Date.now());
  body.textContent = message.content;

  copyButton.hidden = pending;
  copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      copyButton.textContent = "Copied";
      setTimeout(() => (copyButton.textContent = "Copy"), 1200);
    } catch {
      showError("Your browser did not allow clipboard access.");
    }
  });

  elements.messages.append(fragment);
  return article;
}

function updateConnectionStatus() {
  const hasKey = Boolean(elements.apiKey.value.trim());
  const provider = PROVIDERS[elements.providerSelect.value];
  elements.connectionStatus.textContent = hasKey ? `${provider.name} key ready` : "Not connected";
  elements.connectionStatus.classList.toggle("ready", hasKey);
}

function detectProvider(apiKey, model = "") {
  if (/^AIza/i.test(apiKey) || /^gemini-/i.test(model) || /^models\/gemini-/i.test(model)) {
    return "gemini";
  }
  if (/^sk-/i.test(apiKey) || /^(gpt-|o\d|chatgpt-)/i.test(model)) {
    return "openai";
  }
  return null;
}

function isLikelyOpenAITextChatModel(modelId) {
  if (!/^(gpt-|o\d|chatgpt-)/i.test(modelId)) return false;
  return !/(image|audio|realtime|transcribe|tts|search|moderation|computer-use|sora)/i.test(modelId);
}

function setModelOptions(modelIds, selectedModel = "") {
  const uniqueModels = [...new Set(modelIds)];
  if (selectedModel && !uniqueModels.includes(selectedModel)) {
    uniqueModels.unshift(selectedModel);
  }

  elements.modelInput.replaceChildren(
    ...uniqueModels.map((id) => {
      const option = document.createElement("option");
      option.value = id;
      option.textContent = id;
      return option;
    }),
  );
  elements.modelInput.value = selectedModel || uniqueModels[0] || "";
}

function selectProvider(providerId, options = {}) {
  const provider = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
  const previousModel = elements.modelInput.value.trim();
  const compatibleModel = providerId === "gemini"
    ? /^(models\/)?gemini-/i.test(previousModel)
    : /^(gpt-|o\d|chatgpt-)/i.test(previousModel);

  elements.providerSelect.value = providerId;
  elements.apiKeyLabel.textContent = provider.keyLabel;
  elements.apiKey.placeholder = provider.keyPlaceholder;
  const selectedModel = options.keepModel && compatibleModel
    ? previousModel
    : localStorage.getItem(`${STORAGE_KEY}:model:${providerId}`) || provider.defaultModel;
  setModelOptions(provider.models, selectedModel);

  localStorage.setItem(PROVIDER_STORAGE_KEY, providerId);
  localStorage.setItem(`${STORAGE_KEY}:model`, elements.modelInput.value.trim());
  hideError();
  updateConnectionStatus();
}

function autoResizeComposer() {
  elements.messageInput.style.height = "auto";
  elements.messageInput.style.height = `${Math.min(elements.messageInput.scrollHeight, 170)}px`;
}

function showError(message) {
  elements.errorBanner.textContent = message;
  elements.errorBanner.hidden = false;
}

function hideError() {
  elements.errorBanner.hidden = true;
  elements.errorBanner.textContent = "";
}

function sanitizeApiError(message) {
  return String(message)
    .replace(/AIza[A-Za-z0-9_*.-]{8,}/g, "AIza…[redacted]")
    .replace(/sk-[A-Za-z0-9_*.-]{8,}/gi, "sk-…[redacted]");
}

function setLoading(loading) {
  elements.messageInput.disabled = loading;
  elements.sendButton.disabled = false;
  elements.sendButton.type = loading ? "button" : "submit";
  elements.sendButton.querySelector(".send-label").textContent = loading ? "Stop" : "Send";
  elements.sendButton.querySelector(".send-arrow").textContent = loading ? "■" : "↑";
}

function extractOpenAIResponseText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const textParts = (data.output || [])
    .flatMap((item) => item.content || [])
    .filter((content) => content.type === "output_text" && typeof content.text === "string")
    .map((content) => content.text);

  return textParts.join("\n").trim();
}

function extractGeminiResponseText(data) {
  const text = (data.candidates || [])
    .flatMap((candidate) => candidate?.content?.parts || [])
    .filter((part) => typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();

  if (text) return text;

  const blockedReason = data?.promptFeedback?.blockReason;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (blockedReason) throw new Error(`Gemini blocked this prompt: ${blockedReason}.`);
  if (finishReason && finishReason !== "STOP") {
    throw new Error(`Gemini returned no text (${finishReason}).`);
  }
  return "";
}

function toGeminiContents(messages) {
  return messages.reduce((contents, message) => {
    const role = message.role === "assistant" ? "model" : "user";
    const previous = contents.at(-1);
    if (previous?.role === role) {
      previous.parts[0].text += `\n\n${message.content}`;
    } else {
      contents.push({ role, parts: [{ text: message.content }] });
    }
    return contents;
  }, []);
}

async function requestOpenAI({ apiKey, model, messages, instructions, signal }) {
  const payload = {
    model,
    input: messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    store: false,
  };
  if (instructions) payload.instructions = instructions;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI request failed with status ${response.status}.`);
  }
  return extractOpenAIResponseText(data);
}

async function requestGemini({ apiKey, model, messages, instructions, signal }) {
  const modelId = model.replace(/^models\//i, "");
  const payload = { contents: toGeminiContents(messages) };
  if (instructions) {
    payload.system_instruction = { parts: [{ text: instructions }] };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal,
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini request failed with status ${response.status}.`);
  }
  return extractGeminiResponseText(data);
}

async function sendMessage(event) {
  event.preventDefault();
  hideError();

  const apiKey = elements.apiKey.value.trim();
  const providerId = elements.providerSelect.value;
  const provider = PROVIDERS[providerId];
  const model = elements.modelInput.value.trim();
  const content = elements.messageInput.value.trim();

  if (!apiKey) {
    showError(`Paste your ${provider.name} API key before sending a message.`);
    elements.apiKey.focus();
    return;
  }
  if (!model) {
    showError("Choose or enter a model name.");
    elements.modelInput.focus();
    return;
  }
  if (!content) return;

  sessionStorage.setItem(API_KEY_SESSION_KEY, apiKey);

  const chat = getActiveChat();
  const userMessage = { role: "user", content, createdAt: Date.now() };
  chat.messages.push(userMessage);
  if (chat.messages.length === 1) {
    chat.title = content.length > 46 ? `${content.slice(0, 46).trim()}…` : content;
  }
  chat.updatedAt = Date.now();
  elements.messageInput.value = "";
  autoResizeComposer();
  saveState();
  render();

  const pendingMessage = {
    role: "assistant",
    content: "Thinking",
    createdAt: Date.now(),
  };
  const pendingElement = renderMessage(pendingMessage, true);
  elements.messages.scrollTop = elements.messages.scrollHeight;

  requestController = new AbortController();
  setLoading(true);

  try {
    const instructions = elements.systemPrompt.value.trim();
    const request = providerId === "gemini" ? requestGemini : requestOpenAI;
    const assistantText = await request({
      apiKey,
      model,
      messages: chat.messages,
      instructions,
      signal: requestController.signal,
    });
    if (!assistantText) {
      throw new Error(`${provider.name} returned no text. Try another model or prompt.`);
    }

    chat.messages.push({
      role: "assistant",
      content: assistantText,
      createdAt: Date.now(),
    });
    chat.updatedAt = Date.now();
    saveState();
  } catch (error) {
    if (error.name === "AbortError") {
      showError("Generation stopped.");
    } else if (error instanceof TypeError) {
      showError("Could not reach the API. Open this page through a local web server and check your internet connection.");
    } else {
      showError(sanitizeApiError(error.message || "Something went wrong while contacting the API."));
    }
  } finally {
    pendingElement.remove();
    requestController = null;
    setLoading(false);
    render();
    elements.messageInput.focus();
  }
}

async function loadAvailableModels() {
  hideError();
  const apiKey = elements.apiKey.value.trim();
  const providerId = elements.providerSelect.value;
  const provider = PROVIDERS[providerId];
  if (!apiKey) {
    showError(`Paste your ${provider.name} API key first, then refresh the model list.`);
    elements.apiKey.focus();
    return;
  }

  const originalLabel = elements.loadModels.textContent;
  elements.loadModels.textContent = "Loading";
  elements.loadModels.disabled = true;

  try {
    const isGemini = providerId === "gemini";
    const response = await fetch(
      isGemini
        ? "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000"
        : "https://api.openai.com/v1/models",
      {
        headers: isGemini
          ? { "x-goog-api-key": apiKey }
          : { Authorization: `Bearer ${apiKey}` },
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || "Could not load models.");
    }

    const modelIds = isGemini
      ? (data.models || [])
          .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
          .map((model) => model.name.replace(/^models\//, ""))
          .sort((a, b) => a.localeCompare(b))
      : (data.data || [])
          .map((model) => model.id)
          .filter(isLikelyOpenAITextChatModel)
          .sort((a, b) => a.localeCompare(b));

    setModelOptions(modelIds, modelIds.includes(elements.modelInput.value) ? elements.modelInput.value : "");

    if (!modelIds.length) throw new Error("No chat-capable models were returned for this key.");
    elements.connectionStatus.textContent = `${modelIds.length} ${provider.name} models`;
    elements.connectionStatus.classList.add("ready");
  } catch (error) {
    showError(sanitizeApiError(error.message || "Could not load models."));
  } finally {
    elements.loadModels.textContent = originalLabel;
    elements.loadModels.disabled = false;
  }
}

function startNewChat() {
  if (requestController) requestController.abort();
  const current = getActiveChat();
  if (current && current.messages.length === 0) {
    elements.messageInput.focus();
    return;
  }

  const chat = newChat();
  state.chats.push(chat);
  activeChatId = chat.id;
  hideError();
  saveState();
  render();
  elements.messageInput.focus();
}

function deleteCurrentChat() {
  const chat = getActiveChat();
  if (chat.messages.length && !confirm("Delete this chat from this browser?")) return;

  state.chats = state.chats.filter((item) => item.id !== chat.id);
  if (!state.chats.length) state.chats.push(newChat());
  activeChatId = [...state.chats].sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
  saveState();
  render();
}

function clearAllHistory() {
  if (!state.chats.some((chat) => chat.messages.length)) return;
  if (!confirm("Clear all chat history from this browser?")) return;

  const chat = newChat();
  state = { chats: [chat], activeChatId: chat.id };
  activeChatId = chat.id;
  saveState();
  render();
}

elements.chatForm.addEventListener("submit", sendMessage);
elements.newChatButton.addEventListener("click", startNewChat);
elements.deleteChat.addEventListener("click", deleteCurrentChat);
elements.clearHistory.addEventListener("click", clearAllHistory);
elements.loadModels.addEventListener("click", loadAvailableModels);

elements.providerSelect.addEventListener("change", () => {
  selectProvider(elements.providerSelect.value);
});

elements.apiKey.addEventListener("input", () => {
  sessionStorage.setItem(API_KEY_SESSION_KEY, elements.apiKey.value);
  const detectedProvider = detectProvider(elements.apiKey.value.trim());
  if (detectedProvider && detectedProvider !== elements.providerSelect.value) {
    selectProvider(detectedProvider);
  }
  updateConnectionStatus();
});

elements.toggleKey.addEventListener("click", () => {
  const showing = elements.apiKey.type === "text";
  elements.apiKey.type = showing ? "password" : "text";
  elements.toggleKey.textContent = showing ? "Show" : "Hide";
  elements.toggleKey.setAttribute("aria-label", showing ? "Show API key" : "Hide API key");
});

elements.messageInput.addEventListener("input", autoResizeComposer);
elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    elements.chatForm.requestSubmit();
  }
});

elements.sendButton.addEventListener("click", (event) => {
  if (requestController) {
    event.preventDefault();
    requestController.abort();
  }
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    elements.messageInput.value = button.dataset.prompt;
    autoResizeComposer();
    elements.messageInput.focus();
  });
});

elements.apiKey.value = sessionStorage.getItem(API_KEY_SESSION_KEY) || "";
const legacyModel = localStorage.getItem(`${STORAGE_KEY}:model`) || "";
const initialProvider =
  detectProvider(elements.apiKey.value, legacyModel) ||
  localStorage.getItem(PROVIDER_STORAGE_KEY) ||
  DEFAULT_PROVIDER;
elements.modelInput.value = legacyModel;
selectProvider(initialProvider, { keepModel: true });
elements.systemPrompt.value = localStorage.getItem(`${STORAGE_KEY}:instructions`) || "";

elements.modelInput.addEventListener("change", () => {
  const model = elements.modelInput.value.trim();
  const detectedProvider = detectProvider("", model);
  if (detectedProvider && detectedProvider !== elements.providerSelect.value) {
    selectProvider(detectedProvider, { keepModel: true });
  }
  const providerId = elements.providerSelect.value;
  localStorage.setItem(`${STORAGE_KEY}:model`, model);
  localStorage.setItem(`${STORAGE_KEY}:model:${providerId}`, model);
});
elements.systemPrompt.addEventListener("change", () => {
  localStorage.setItem(`${STORAGE_KEY}:instructions`, elements.systemPrompt.value);
});

updateConnectionStatus();
autoResizeComposer();
render();
