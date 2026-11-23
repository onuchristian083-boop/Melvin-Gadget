const { handleChatRequest, applyCors } = require("../server.js");

module.exports = (request, response) => {
  applyCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204).end();
    return;
  }
  if (request.method !== "POST") {
    response.writeHead(405, { Allow: "POST, OPTIONS" }).end("Method not allowed");
    return;
  }
  return handleChatRequest(request, response);
};