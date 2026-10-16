function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "checking", "one sec", "brb"... as a short message on its own, not inside a long sentence.
function saidChecking(text, words) {
  if (!text || text.length > 60) return false;
  const lower = text.toLowerCase().replace(/[’']/g, "'");
  return words.some((word) => new RegExp(`(^|[^\\p{L}])${escape(word.toLowerCase())}($|[^\\p{L}])`, "u").test(lower));
}

module.exports = { saidChecking };
