const { Deskpet } = require("./deskpet");

const pet = new Deskpet();
pet.start();
console.log(`[deskpet] ${pet.config.petName} is listening on Telegram`);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    pet.stop();
    process.exit(0);
  });
}
