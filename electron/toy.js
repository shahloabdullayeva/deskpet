let down = null;

window.addEventListener("mousedown", (event) => {
  if (event.button !== 0) return;
  down = { x: event.screenX, y: event.screenY };
  document.body.classList.add("held");
  window.toy.grab();
});

window.addEventListener("mousemove", (event) => {
  if (!down) return;
  window.toy.drag(event.screenX - down.x, event.screenY - down.y);
  down = { x: event.screenX, y: event.screenY };
});

window.addEventListener("mouseup", () => {
  if (!down) return;
  down = null;
  document.body.classList.remove("held");
  window.toy.drop();
});

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  window.toy.close();
});
