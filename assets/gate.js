/* Home: the "enter the archive" screen. It covers the home the first time a visitor arrives in a session;
   one click (or Enter / Space) lifts it and turns the sound on, as on the first version of the site. */
(() => {
  const gate = document.getElementById("gate");
  if (!gate) return;
  let seen = false;
  try { seen = sessionStorage.getItem("ac-entered") === "1"; } catch (e) {}
  if (seen) { gate.remove(); return; }
  gate.hidden = false;
  document.documentElement.classList.add("gated");
  const enter = () => {
    try { sessionStorage.setItem("ac-entered", "1"); } catch (e) {}
    const pulse = document.querySelector(".pulse");
    if (pulse && pulse.getAttribute("aria-pressed") !== "true") pulse.click();   // sound on, through the same switch
    if (window.ACSound) window.ACSound.burst(1);
    gate.classList.add("gone");
    document.documentElement.classList.remove("gated");
    setTimeout(() => gate.remove(), 1000);
  };
  gate.addEventListener("click", enter);
  gate.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enter(); } });
  gate.focus();
})();
