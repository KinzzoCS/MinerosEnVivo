// Comportamiento común de la app: ajustes de modo y letra, instalación y modo sin conexión.
const PREFS_KEY = "mineros_prefs";
const root = document.documentElement;
let installEvent = null;

function readPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Sin almacenamiento: el ajuste dura solo esta visita
  }
}

function applyPrefs({ theme = "auto", text = "normal" }) {
  if (theme === "light" || theme === "dark") root.dataset.theme = theme;
  else delete root.dataset.theme;
  if (text === "grande" || text === "enorme") root.dataset.text = text;
  else delete root.dataset.text;
  syncThemeColor();
}

function isDark() {
  if (root.dataset.theme) return root.dataset.theme === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function syncThemeColor() {
  const color = isDark() ? "#19191B" : "#FFFFFF";
  document.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.setAttribute("content", color));
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function buildSettingsDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "hoja";
  dialog.id = "ajustes";
  dialog.setAttribute("aria-labelledby", "ajustes-titulo");
  dialog.innerHTML = `
    <form method="dialog" class="hoja-cuerpo">
      <div class="hoja-cabeza">
        <h2 id="ajustes-titulo">Ajustes</h2>
        <button class="cerrar" value="cerrar" aria-label="Cerrar ajustes">×</button>
      </div>
      <fieldset class="grupo">
        <legend>Tamaño de letra</legend>
        <div class="opciones">
          <label><input type="radio" name="text" value="normal"><span style="font-size:1rem">Normal</span></label>
          <label><input type="radio" name="text" value="grande"><span style="font-size:1.15rem">Grande</span></label>
          <label><input type="radio" name="text" value="enorme"><span style="font-size:1.3rem">Enorme</span></label>
        </div>
      </fieldset>
      <fieldset class="grupo">
        <legend>Modo de color</legend>
        <div class="opciones">
          <label><input type="radio" name="theme" value="auto"><span>Como el teléfono</span></label>
          <label><input type="radio" name="theme" value="light"><span>Claro</span></label>
          <label><input type="radio" name="theme" value="dark"><span>Oscuro</span></label>
        </div>
      </fieldset>
      <div class="instalar" id="instalar" hidden>
        <strong>Instalar la app</strong>
        <p id="instalar-texto">Agrega Mineros TV a tu pantalla de inicio para abrirla como cualquier app.</p>
        <button type="button" class="boton boton-rojo boton-ancho" id="instalar-boton">Instalar Mineros TV</button>
      </div>
    </form>`;
  document.body.append(dialog);

  const prefs = readPrefs();
  dialog.querySelector(`input[name="text"][value="${prefs.text || "normal"}"]`).checked = true;
  dialog.querySelector(`input[name="theme"][value="${prefs.theme || "auto"}"]`).checked = true;

  dialog.addEventListener("change", event => {
    if (!event.target.matches("input[type=radio]")) return;
    const next = { ...readPrefs(), [event.target.name]: event.target.value };
    savePrefs(next);
    applyPrefs(next);
  });
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.querySelector("#instalar-boton").addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice;
    installEvent = null;
    updateInstallSection();
  });
  return dialog;
}

function updateInstallSection() {
  const section = document.getElementById("instalar");
  if (!section) return;
  const button = document.getElementById("instalar-boton");
  const text = document.getElementById("instalar-texto");
  if (isStandalone()) {
    section.hidden = true;
  } else if (installEvent) {
    section.hidden = false;
    button.hidden = false;
    text.textContent = "Agrega Mineros TV a tu pantalla de inicio para abrirla como cualquier app.";
  } else if (isIos()) {
    section.hidden = false;
    button.hidden = true;
    text.textContent = "En Safari toca el botón Compartir y luego \"Agregar a inicio\".";
  } else {
    section.hidden = true;
  }
}

function initSettings() {
  const dialog = buildSettingsDialog();
  document.querySelectorAll("[data-abrir-ajustes]").forEach(button => {
    button.addEventListener("click", () => {
      updateInstallSection();
      dialog.showModal();
    });
  });
}

function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!["https:", "http:"].includes(location.protocol)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => console.warn("Service worker no registrado:", error));
  });
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installEvent = event;
  updateInstallSection();
});
window.addEventListener("appinstalled", () => {
  installEvent = null;
  updateInstallSection();
});
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor);

applyPrefs(readPrefs());
initSettings();
initServiceWorker();
