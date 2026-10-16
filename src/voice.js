const fs = require("fs");
const path = require("path");

const MIME = { ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".oga": "audio/ogg", ".opus": "audio/ogg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".webm": "audio/webm" };

class Voice {
  constructor({ dir, config, env }) {
    this.dir = path.join(dir, "voice");
    this.voiceId = config.voice?.elevenlabsVoiceId || "";
    this.model = config.voice?.elevenlabsModel || "eleven_multilingual_v2";
    this.key = env.elevenlabsKey;
  }

  get canClone() {
    return Boolean(this.key && this.voiceId);
  }

  // Your own recording first, then your cloned voice, else no sound.
  async soundFor(line) {
    if (line.audio) {
      const file = path.join(this.dir, path.basename(line.audio));
      try {
        return { buffer: fs.readFileSync(file), mime: MIME[path.extname(file).toLowerCase()] || "audio/mpeg", filename: path.basename(file) };
      } catch {
        console.warn(`[voice] missing recording ${file}`);
      }
    }
    if (!this.canClone) return null;
    try {
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": this.key, "content-type": "application/json" },
        body: JSON.stringify({ text: line.text, model_id: this.model }),
      });
      if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
      return { buffer: Buffer.from(await response.arrayBuffer()), mime: "audio/mpeg", filename: "mochi.mp3" };
    } catch (error) {
      console.warn(`[voice] ElevenLabs failed: ${error.message}`);
      return null;
    }
  }
}

module.exports = { Voice };
