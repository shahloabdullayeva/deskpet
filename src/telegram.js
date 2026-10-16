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

  // Telegram plays ogg/opus, mp3 and m4a as voice notes; anything else goes as an audio file.
  async sendSound(chatId, sound, caption, replyTo) {
    const asVoice = /audio\/(ogg|mpeg|mp4)/.test(sound.mime);
    const form = new FormData();
    form.append("chat_id", String(chatId));
    if (caption) form.append("caption", caption);
    if (replyTo) form.append("reply_parameters", JSON.stringify({ message_id: replyTo, allow_sending_without_reply: true }));
    form.append(asVoice ? "voice" : "audio", new Blob([sound.buffer], { type: sound.mime }), sound.filename);
    const response = await fetch(`${API}/bot${this.token}/${asVoice ? "sendVoice" : "sendAudio"}`, { method: "POST", body: form });
    const body = await response.json();
    if (!body.ok) throw new Error(`Telegram send voice: ${body.description}`);
    return body.result;
  }

  async download(fileId) {
    const file = await this.call("getFile", { file_id: fileId });
    const response = await fetch(`${API}/file/bot${this.token}/${file.file_path}`);
    if (!response.ok) throw new Error(`Telegram download: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
}

function reply(messageId) {
  return messageId ? { reply_parameters: { message_id: messageId, allow_sending_without_reply: true } } : {};
}

module.exports = { Telegram };
