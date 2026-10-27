/* Home: the "enter the archive" screen. It covers the home the first time a visitor arrives in a session;
   one click (or Enter / Space) lifts it and turns the sound on, as on the first version of the site.
   /found (only reached from the QR on the printed cards) shows it every time, with a thank-you line. */
(() => {
  const gate = document.getElementById("gate");
  if (!gate) return;
  const found = gate.hasAttribute("data-found") || /^\/found(\.html)?\/?$/.test(location.pathname) || /[?&]found\b/.test(location.search);
  let seen = false;
  try { seen = sessionStorage.getItem("ac-entered") === "1"; } catch (e) {}
  if (seen && !found) { gate.remove(); return; }
  if (found) {
    gate.classList.add("found");
    gate.setAttribute("aria-label", "Thank you for scanning the code. You are in. Enter");
    gate.setAttribute("data-aria-it", "Grazie per aver scansionato il codice. Ci sei. Entra");
    const msg = document.createElement("div");
    msg.className = "gate-msg";
    msg.innerHTML = '<span class="gate-mark">* Archive Coulture</span>' +
      '<span data-l="en">Thank you for scanning the code.<br>You are in. Welcome to the archive.</span>' +
      '<span data-l="it" lang="it">Grazie per aver scansionato il codice.<br>Ci sei. Benvenuto nell’archivio.</span>';
    gate.firstElementChild.prepend(msg);
    const btn = gate.querySelector("p");
    if (btn) btn.innerHTML = '<span data-l="en">[ enter ]</span><span data-l="it" lang="it">[ entra ]</span>';
    // clean the address bar on the real /found link only
    const viaLink = /^\/found(\.html)?\/?$/.test(location.pathname) || /[?&]found\b/.test(location.search);
    try { if (viaLink) history.replaceState(null, "", "/" + location.hash); } catch (e) {}
  }
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
