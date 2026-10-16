const API = "https://api.telegram.org";

class Telegram {
  constructor(token) {
    this.token = token;
  }

  async call(method, params = {}, signal) {
    const response = await fetch(`${API}/bot${this.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(params),
      signal,
    });
    const body = await response.json();
    if (!body.ok) throw new Error(`Telegram ${method}: ${body.description}`);
    return body.result;
  }

  getUpdates(offset, signal) {
    return this.call("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] }, signal);
  }

  sendText(chatId, text, replyTo) {
    return this.call("sendMessage", { chat_id: chatId, text, ...reply(replyTo) });
  }
}

function reply(messageId) {
  return messageId ? { reply_parameters: { message_id: messageId, allow_sending_without_reply: true } } : {};
}

module.exports = { Telegram };
