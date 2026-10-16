// Telegram only, no desk window — for running on a server that is always on.
const { Deskpet } = require("./deskpet");

const pet = new Deskpet();
pet.start();
console.log(`[deskpet] ${pet.config.petName} is listening on Telegram`);
process.on("SIGINT", () => {
  pet.stop();
  process.exit(0);
});
