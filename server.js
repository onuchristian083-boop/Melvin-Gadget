"use strict";

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");

const ROOT = __dirname;
const nvidiaAiDisabled = process.env.NVIDIA_DISABLE_AI === "1";
if (!nvidiaAiDisabled) {
  require("dotenv").config({ path: path.join(ROOT, ".env") });
}
const nvidiaApiKey = nvidiaAiDisabled ? null : process.env.NVIDIA_API_KEY;
const nvidiaModel = process.env.NVIDIA_MODEL || "nvidia/llama-3.1-nemotron-70b-instruct";

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY_BYTES = 32_000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 500;
const MAX_ASSISTANT_MESSAGE_LENGTH = 8_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitByIp = new Map();

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const sendJson = (response, statusCode, data) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(data));
};

const readJsonBody = async (request) => {
  const chunks = [];
  let byteLength = 0;

  for await (const chunk of request) {
    byteLength += chunk.length;
    if (byteLength > MAX_BODY_BYTES) {
      throw new HttpError(413, "Your message is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "The request must contain valid JSON.");
  }
};

let productCatalogPromise;
const loadProductCatalog = () => {
  if (!productCatalogPromise) {
    productCatalogPromise = Promise.all([
      fs.readFile(path.join(ROOT, "mock-database.json"), "utf8"),
      fs.readFile(path.join(ROOT, "phone-specifications.json"), "utf8")
    ])
      .then(([priceContents, specificationContents]) => ({
        priceList: JSON.parse(priceContents),
        specificationDatabase: JSON.parse(specificationContents)
      }))
      .then(({ priceList, specificationDatabase }) => {
        if (!priceList || !Array.isArray(priceList.data)) {
          throw new Error("The mock phone database has an invalid format.");
        }
        if (!specificationDatabase || typeof specificationDatabase.models !== "object") {
          throw new Error("The phone specification database has an invalid format.");
        }

        const products = priceList.data.filter((product) => product && product.category === "APPLE_PHONE");
        const hasInvalidProduct = products.some((product) =>
          typeof product.model !== "string" ||
          !Number.isFinite(product.lowest_price) ||
          product.lowest_price < 0 ||
          typeof product.condition !== "string" ||
          !product.attributes ||
          typeof product.attributes.storage !== "string"
        );

        if (hasInvalidProduct) {
          throw new Error("The mock phone database contains an invalid Apple phone record.");
        }

        const hasInvalidSpecification = Object.values(specificationDatabase.models).some((specification) =>
          !specification ||
          typeof specification.verified !== "boolean" ||
          (specification.verified && (
            typeof specification.source_url !== "string" ||
            !/^https:\/\/(www\.)?apple\.com\//.test(specification.source_url) ||
            !specification.facts ||
            typeof specification.facts !== "object"
          ))
        );
        if (hasInvalidSpecification) {
          throw new Error("The phone specification database contains an invalid or unverified source record.");
        }

        return {
          products: products.slice(0, 100).map((product) => ({
            model: product.model,
            listedPriceNgn: product.lowest_price,
            storage: product.attributes.storage
          })),
          conditionMultipliers: priceList.condition_multipliers || { NAIJA_USED: 1 },
          specifications: specificationDatabase.models,
          specificationsVerifiedAt: specificationDatabase.verified_at,
          specificationSourceNote: specificationDatabase.source_note
        };
      })
      .catch((error) => {
        productCatalogPromise = undefined;
        throw error;
      });
  }

  return productCatalogPromise;
};

const checkRateLimit = (request) => {
  const now = Date.now();
  const clientIp = request.socket.remoteAddress || "unknown";
  const recentRequests = (rateLimitByIp.get(clientIp) || [])
    .filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    throw new HttpError(429, "Too many messages. Please wait a minute and try again.");
  }

  recentRequests.push(now);
  rateLimitByIp.set(clientIp, recentRequests);
};

const getLocalAssistantReply = (question, products, conditionMultipliers, specifications) => {
  const normalizedQuestion = question.toLowerCase();
  const models = Array.from(new Set(products.map((product) => product.model)))
    .sort((firstModel, secondModel) => secondModel.length - firstModel.length);
  const selectedModel = models.find((model) => normalizedQuestion.includes(model.toLowerCase())) ||
    models.find((model) => {
      const shortName = model.replace(/^iphone\s+/i, "");
      if (shortName.length < 2) return false;
      const escapedName = shortName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b${escapedName}\\b`, "i").test(normalizedQuestion);
    });
  const asksForPrice = /price|cost|how much|priced/.test(normalizedQuestion);

  if (/^(hi|hello|hey|good morning|good afternoon)\b/.test(normalizedQuestion)) {
    return "Hi! I can compare iPhone models and storage, or suggest options for your budget. What are you looking for?";
  }

  if (/availability|available|in[\s-]?stock|stock|do you have|can i buy|are you selling/.test(normalizedQuestion)) {
    return "I can’t check live stock. Contact Melvin Gadgets on WhatsApp at +2349130141794 for current availability.";
  }

  if (/choose|recommend|suggest|suit|best|which phone|help me|what phone|pick a phone/.test(normalizedQuestion)) {
    const budgetMatch = normalizedQuestion.match(/(?:budget(?:\s+(?:is|of))?|under|below|around|up to|less than)\s*(?:₦|ngn)?\s*([\d,]+(?:\.\d+)?)\s*(k|m)?\b/);
    if (!budgetMatch) {
      return "I can suggest options for your budget. What is your budget, and do you care most about camera, battery life, or storage?";
    }

    const budgetAmount = Number(budgetMatch[1].replace(/,/g, ""));
    const budget = budgetAmount * (budgetMatch[2] === "m" ? 1_000_000 : budgetMatch[2] === "k" ? 1_000 : 1);
    const lowestPrices = new Map();
    products.forEach((product) => {
      const current = lowestPrices.get(product.model);
      if (!current || product.listedPriceNgn < current.listedPriceNgn) {
        lowestPrices.set(product.model, product);
      }
    });
    const recommendations = Array.from(lowestPrices.values())
      .filter((product) => product.listedPriceNgn <= budget)
      .sort((firstProduct, secondProduct) => secondProduct.listedPriceNgn - firstProduct.listedPriceNgn)
      .slice(0, 3);

    if (recommendations.length === 0) {
      return `I couldn’t find a listed option within ₦${budget.toLocaleString("en-NG")}. Try a different budget or contact us to check current options.`;
    }

    const options = recommendations.map((product) =>
      `${product.model} ${product.storage.toUpperCase()} from ₦${product.listedPriceNgn.toLocaleString("en-NG")}`
    );
    return `For a ₦${budget.toLocaleString("en-NG")} budget, these Naija-used options are closest to your range:\n${options.join("\n")}\n\nPrices and availability need confirmation. Which matters most to you: camera, battery life, or storage?`;
  }

  if (/compare|comparison|difference|\bvs\b/.test(normalizedQuestion)) {
    const comparedModels = models.filter((model) => normalizedQuestion.includes(model.toLowerCase())).slice(0, 2);
    if (comparedModels.length === 2) {
      const summaries = comparedModels.map((model) => {
        const options = products.filter((product) => product.model === model);
        const lowest = Math.min(...options.map((product) => product.listedPriceNgn));
        const highest = Math.max(...options.map((product) => product.listedPriceNgn));
        return `${model}: Naija-used prices ₦${lowest.toLocaleString("en-NG")}–₦${highest.toLocaleString("en-NG")}`;
      });
      return `${summaries.join("\n")}\n\nPrices vary by storage and condition. Which feature would you like to compare?`;
    }
    return "Tell me the two iPhone models you want to compare, such as “compare iPhone 11 and iPhone 12”.";
  }

  if (/camera|battery life|screen|display|performance|processor|specs?|features?|water resistance|waterproof|\busb-c\b|charging/.test(normalizedQuestion) &&
      !asksForPrice && !/changed battery|changed screen/.test(normalizedQuestion)) {
    if (!selectedModel) {
      return "Which iPhone model would you like specifications for? I can share verified display, camera, chip, battery, and water-resistance details when they’re available.";
    }

    const specification = specifications[selectedModel];
    if (!specification || !specification.verified) {
      return `I don’t have verified official specifications for ${selectedModel} yet. I won’t guess; please check Apple’s technical specifications or ask us to confirm the details.`;
    }

    const factKeys = [];
    if (/display|screen/.test(normalizedQuestion)) factKeys.push("display");
    if (/camera|photo/.test(normalizedQuestion)) factKeys.push("rear_camera", "front_camera");
    if (/battery|playback/.test(normalizedQuestion)) factKeys.push("battery");
    if (/chip|processor|performance/.test(normalizedQuestion)) factKeys.push("chip");
    if (/water resistance|waterproof/.test(normalizedQuestion)) factKeys.push("water_resistance");
    if (/\busb-c\b|charging|connector/.test(normalizedQuestion)) factKeys.push("connector");
    if (/specs?|features?/.test(normalizedQuestion) && factKeys.length === 0) {
      factKeys.push(...Object.keys(specification.facts));
    }

    const availableFacts = Array.from(new Set(factKeys))
      .filter((key) => specification.facts[key])
      .map((key) => `${key.replace(/_/g, " ")}: ${specification.facts[key]}`);
    const missingFacts = Array.from(new Set(factKeys)).filter((key) => !specification.facts[key]);
    const missingNote = missingFacts.length
      ? `\nI don’t have verified ${missingFacts.map((key) => key.replace(/_/g, " ")).join(" or ")} details for this model.`
      : "";
    const cameraSuggestion = missingFacts.some((key) => key.includes("camera"))
      ? " I do have verified camera details for iPhone 16 and iPhone 17 if you’d like to compare them."
      : "";
    const everydayNote = specification.everyday_note ? `\nIn everyday terms: ${specification.everyday_note}` : "";
    const waterNote = factKeys.includes("water_resistance")
      ? "\nWater resistance is not permanent and may decline with wear."
      : "";
    const verifiedFacts = availableFacts.length ? availableFacts.join("\n") : "No verified details for that topic are listed.";
    return `${selectedModel} verified details:\n${verifiedFacts}${missingNote}${cameraSuggestion}${everydayNote}${waterNote}\nSource: ${specification.source_url}`;
  }

  if (selectedModel && (asksForPrice || /changed battery|changed screen/.test(normalizedQuestion))) {
    const storageMatch = normalizedQuestion.match(/\b(?:64|128|256|512)\s*gb\b|\b1\s*tb\b/i);
    const requestedStorage = storageMatch ? storageMatch[0].replace(/\s+/g, "").toLowerCase() : null;
    const variants = products.filter((product) =>
      product.model === selectedModel && (!requestedStorage || product.storage.toLowerCase() === requestedStorage)
    );

    if (variants.length === 0) {
      return `I don’t have that storage option listed for ${selectedModel}. Contact us to confirm current options and prices.`;
    }

    const conditionLabels = {
      NAIJA_USED: "Naija used",
      UK_USED: "UK used",
      CHANGED_BATTERY: "Changed battery",
      CHANGED_SCREEN: "Changed screen"
    };
    const prices = variants.map((variant) => {
      const conditionPrices = Object.entries(conditionMultipliers).map(([condition, multiplier]) => {
        const price = Math.round(variant.listedPriceNgn * multiplier);
        return `${conditionLabels[condition] || condition}: ₦${price.toLocaleString("en-NG")}`;
      });
      return `${variant.storage.toUpperCase()}: ${conditionPrices.join("; ")}`;
    });

    return `${selectedModel} prices:\n${prices.join("\n")}\n\nPrices can change. Contact us to confirm today’s prices and availability.`;
  }

  if (asksForPrice) {
    return "Tell me the iPhone model and storage you want to compare, for example “iPhone 12 128GB”.";
  }

  return "I can help compare phone prices, models, and storage, or suggest a phone for your budget. For example, ask “Which phone suits a ₦500k budget?”";
};

const getAssistantReply = async (messages) => {
  const {
    products,
    conditionMultipliers,
    specifications,
    specificationsVerifiedAt,
    specificationSourceNote
  } = await loadProductCatalog();
  const catalog = products.flatMap((product) =>
    Object.entries(conditionMultipliers).map(([condition, multiplier]) =>
      `${product.model}: NGN ${Math.round(product.listedPriceNgn * multiplier)}; condition ${condition}; storage ${product.storage}`
    )
  ).join("\n");
  const specificationCatalog = Object.entries(specifications).map(([model, specification]) => {
    if (!specification.verified) {
      return `${model}: no verified specification record.`;
    }
    const facts = Object.entries(specification.facts)
      .map(([fact, value]) => `${fact.replace(/_/g, " ")}: ${value}`)
      .join("; ");
    return `${model} (verified ${specificationsVerifiedAt}; source ${specification.source_url}): ${facts}${specification.everyday_note ? `; everyday context: ${specification.everyday_note}` : ""}`;
  }).join("\n");
  const instructions = [
    "You are the Melvin Gadgets shopping assistant. Be clear, friendly, and concise.",
    "Use the listed prices directly without repeatedly calling them mock, demo, or sample data. Never claim that a price or availability is current, confirmed, or live. If asked, direct customers to WhatsApp at +2349130141794 for confirmation.",
    "Never claim to know current availability, real prices, device condition, or unlisted product facts. Direct customers to WhatsApp at +2349130141794 for genuine product information.",
    "For specification questions, use only the verified specification catalog below. Cite its Apple source URL. Never infer missing facts; say they are not verified for that model.",
    "Ask a brief follow-up question when a customer's budget or needs are unclear.",
    "Listed prices in NGN (for reference; not confirmed live offers):",
    catalog,
    "Verified device specifications:",
    specificationCatalog,
    `Specification caveat: ${specificationSourceNote}`
  ].join("\n\n");

  const question = messages[messages.length - 1].content;
  if (!nvidiaApiKey || nvidiaAiDisabled) {
    return getLocalAssistantReply(question, products, conditionMultipliers, specifications);
  }

  let response;
  try {
    response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${nvidiaApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: nvidiaModel,
        messages: [{ role: "system", content: instructions }, ...messages],
        max_tokens: 350,
        stream: false
      }),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    console.error("Could not reach the NVIDIA API.");
    return getLocalAssistantReply(question, products, conditionMultipliers, specifications);
  }

  if (!response.ok) {
    console.error(`NVIDIA API request failed with status ${response.status}.`);
    return getLocalAssistantReply(question, products, conditionMultipliers, specifications);
  }

  let completion;
  try {
    completion = await response.json();
  } catch {
    return getLocalAssistantReply(question, products, conditionMultipliers, specifications);
  }

  const reply = completion.choices?.[0]?.message?.content;
  if (typeof reply !== "string" || !reply.trim()) {
    console.error("NVIDIA API response did not contain output text.");
    return getLocalAssistantReply(question, products, conditionMultipliers, specifications);
  }

  return reply.trim();
};

const handleChatRequest = async (request, response) => {
  try {
    checkRateLimit(request);

    if (!request.headers["content-type"]?.includes("application/json")) {
      throw new HttpError(415, "The request must use JSON.");
    }

    const body = await readJsonBody(request);
    if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) {
      throw new HttpError(400, "Send up to 12 chat messages.");
    }

    const hasInvalidMessage = body.messages.some((message) =>
      !message ||
      !["user", "assistant"].includes(message.role) ||
      typeof message.content !== "string" ||
      !message.content.trim() ||
      message.content.length > (message.role === "user" ? MAX_MESSAGE_LENGTH : MAX_ASSISTANT_MESSAGE_LENGTH)
    );

    if (hasInvalidMessage || body.messages[body.messages.length - 1].role !== "user") {
      throw new HttpError(400, "The chat message is invalid.");
    }

    const reply = await getAssistantReply(body.messages);
    sendJson(response, 200, { reply });
  } catch (error) {
    const statusCode = error instanceof HttpError ? error.statusCode : 500;
    if (!(error instanceof HttpError)) {
      console.error("The chat request failed.", error);
    }
    sendJson(response, statusCode, {
      error: error instanceof HttpError ? error.message : "The assistant could not answer right now."
    });
  }
};

const contentTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jfif": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp"
};

const serveFile = async (request, response, pathname) => {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(ROOT, relativePath);
  const resolvedRelativePath = path.relative(ROOT, filePath);

  if (
    resolvedRelativePath === ".." ||
    resolvedRelativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(resolvedRelativePath) ||
    resolvedRelativePath.split(path.sep).some((part) => part.startsWith(".")) ||
    resolvedRelativePath.toLowerCase() === "server.js"
  ) {
    response.writeHead(404).end("Not found");
    return;
  }

  try {
    const contents = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY"
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      response.writeHead(404).end("Not found");
      return;
    }
    throw error;
  }
};

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;

  if (pathname === "/api/chat") {
    if (request.method !== "POST") {
      response.writeHead(405, { "Allow": "POST" }).end("Method not allowed");
      return;
    }
    handleChatRequest(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Allow": "GET, HEAD" }).end("Method not allowed");
    return;
  }

  serveFile(request, response, pathname).catch((error) => {
    console.error("Could not serve the requested page.", error);
    if (!response.headersSent) {
      response.writeHead(500).end("The page could not be loaded.");
    } else {
      response.destroy();
    }
  });
});

server.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  console.log(`Melvin Gadgets is running on http://localhost:${PORT}`);
  if (!nvidiaApiKey) {
    console.warn("NVIDIA_API_KEY is not set; the chat endpoint will remain unavailable.");
  }
});
