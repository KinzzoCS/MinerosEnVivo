// Conexión de la pizarra con la app Mineros TV.
// - Solo administradores pueden operar el panel de control.
// - Publica el estado del juego en Firestore (liveGame/actual) para la pestaña En vivo.
// - "Finalizar juego" guarda el marcador completo en Resultados.
// La pantalla del estadio no depende de esto: sigue sincronizada por localStorage aunque falle internet.
import { getFirebase } from "../assets/js/firebase-service.js";

const STORAGE_KEY = "pizarra_estado_v3";      // el mismo que usa app.js
const PUBLISH_KEY = "pizarra_publicar_app";
const MIN_INTERVAL_MS = 3000;                 // agrupa cambios rápidos en una sola escritura
const POLL_MS = 700;

let firebase = null;
let lastRaw = "";
let lastPublishedJson = "";
let lastWriteAt = 0;
let pendingTimer = null;
let publishing = readFlag();
let ui = {};

injectStyles();
start();

async function start() {
  const gate = buildGate();
  firebase = await getFirebase();
  if (!firebase) {
    gate.message("La conexión con Firebase no está configurada en este sitio. No se puede verificar el acceso.");
    return;
  }
  const { auth, authMod, db, firestore } = firebase;
  authMod.onAuthStateChanged(auth, async user => {
    if (!user) {
      gate.showLogin();
      return;
    }
    gate.message("Verificando permisos…");
    try {
      const adminSnap = await firestore.getDoc(firestore.doc(db, "admins", user.uid));
      if (!adminSnap.exists()) {
        await authMod.signOut(auth);
        gate.showLogin("Esa cuenta no tiene permisos de administrador.");
        return;
      }
    } catch (error) {
      console.error("Pizarra: no se pudo verificar el acceso", error);
      gate.showLogin("No se pudo verificar el acceso. Revisa la conexión a internet e inténtalo de nuevo.");
      return;
    }
    gate.close();
    buildSyncPanel(user);
    lastRaw = localStorage.getItem(STORAGE_KEY) || "";
    if (publishing) schedulePublish(true);
    setInterval(watchLocalState, POLL_MS);
  });
}

// ── Acceso ─────────────────────────────────────────────────────────
function buildGate() {
  const overlay = document.createElement("div");
  overlay.className = "mtv-gate";
  overlay.innerHTML = `
    <form class="mtv-gate-card" novalidate>
      <h2>Pizarra Mineros TV</h2>
      <p class="mtv-gate-msg" role="status">Verificando acceso…</p>
      <div class="mtv-gate-fields" hidden>
        <label>Correo<input type="email" name="email" autocomplete="email" required></label>
        <label>Contraseña<input type="password" name="password" autocomplete="current-password" required></label>
        <button type="submit" class="accent">Entrar</button>
      </div>
    </form>`;
  document.body.append(overlay);
  const form = overlay.querySelector("form");
  const msg = overlay.querySelector(".mtv-gate-msg");
  const fields = overlay.querySelector(".mtv-gate-fields");

  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (!firebase) return;
    msg.textContent = "Entrando…";
    try {
      await firebase.authMod.signInWithEmailAndPassword(firebase.auth, form.email.value.trim(), form.password.value);
      form.password.value = "";
    } catch {
      msg.textContent = "No se pudo iniciar sesión. Revisa el correo y la contraseña.";
    }
  });

  return {
    message(text) { msg.textContent = text; fields.hidden = true; },
    showLogin(text = "Inicia sesión con tu cuenta de administrador para operar la pizarra.") {
      msg.textContent = text;
      fields.hidden = false;
      form.email.focus();
    },
    close() { overlay.remove(); }
  };
}

// ── Panel de publicación ──────────────────────────────────────────
function buildSyncPanel(user) {
  const panel = document.createElement("div");
  panel.className = "mtv-sync";
  panel.innerHTML = `
    <label class="mtv-switch">
      <input type="checkbox" id="mtvPublish">
      <span>Mostrar en la app</span>
    </label>
    <span class="mtv-status" id="mtvStatus" role="status"></span>
    <button type="button" class="accent2" id="mtvFinish">Finalizar juego y guardar resultado</button>
    <button type="button" id="mtvLogout" title="${escapeAttr(user.email || "")}">Salir</button>`;
  const topbar = document.querySelector(".topbar");
  (topbar || document.body).append(panel);

  ui = {
    toggle: panel.querySelector("#mtvPublish"),
    status: panel.querySelector("#mtvStatus"),
    finish: panel.querySelector("#mtvFinish")
  };
  ui.toggle.checked = publishing;
  updateStatus();

  ui.toggle.addEventListener("change", async () => {
    publishing = ui.toggle.checked;
    writeFlag(publishing);
    if (publishing) {
      lastPublishedJson = "";
      schedulePublish(true);
    } else {
      clearTimeout(pendingTimer);
      await writeLiveGame({ status: "inactivo" }, true);
    }
    updateStatus();
  });

  ui.finish.addEventListener("click", finishGame);
  panel.querySelector("#mtvLogout").addEventListener("click", async () => {
    await firebase.authMod.signOut(firebase.auth);
    location.reload();
  });
  window.addEventListener("online", updateStatus);
  window.addEventListener("offline", updateStatus);
}

function updateStatus(text) {
  if (!ui.status) return;
  if (text) {
    ui.status.textContent = text;
    return;
  }
  if (!publishing) {
    ui.status.textContent = "La app no muestra este juego.";
  } else if (!navigator.onLine) {
    ui.status.textContent = "Sin internet: los cambios se enviarán al volver la señal.";
  } else if (lastWriteAt) {
    ui.status.textContent = `En la app. Última actualización ${new Date(lastWriteAt).toLocaleTimeString("es-MX")}`;
  } else {
    ui.status.textContent = "Conectando con la app…";
  }
}

// ── Lectura del estado local de la pizarra ────────────────────────
function watchLocalState() {
  const raw = localStorage.getItem(STORAGE_KEY) || "";
  if (raw === lastRaw) return;
  lastRaw = raw;
  if (publishing) schedulePublish();
}

function readGame() {
  let state = {};
  try {
    state = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch {
    state = {};
  }
  const innings = list => {
    const values = Array.isArray(list) ? list.map(v => (Number.isInteger(v) ? clampInt(v, 0, 99) : null)) : [];
    let last = values.length - 1;
    while (last >= 0 && values[last] === null) last -= 1;
    return values.slice(0, Math.max(last + 1, 0)).slice(0, 30);
  };
  const awayInnings = innings(state.inningsA);
  const homeInnings = innings(state.inningsB);
  const sum = list => list.reduce((total, v) => total + (v || 0), 0);
  const bases = state.bases || {};
  return {
    away: teamName(state.teamA, "Visitante"),
    home: teamName(state.teamB, "Local"),
    awayInnings,
    homeInnings,
    awayScore: sum(awayInnings),
    homeScore: sum(homeInnings),
    awayHits: clampInt(state?.h?.a, 0, 999),
    homeHits: clampInt(state?.h?.b, 0, 999),
    awayErrors: clampInt(state?.e?.a, 0, 999),
    homeErrors: clampInt(state?.e?.b, 0, 999),
    inning: clampInt(state.inning, 1, 30) || 1,
    half: state.half === "BAJA" ? "baja" : "alta",
    balls: clampInt(state.balls, 0, 3),
    strikes: clampInt(state.strikes, 0, 2),
    outs: clampInt(state.outs, 0, 2),
    bases: [Boolean(bases[1]), Boolean(bases[2]), Boolean(bases[3])]
  };
}

// ── Escritura en Firestore ────────────────────────────────────────
function schedulePublish(immediate = false) {
  clearTimeout(pendingTimer);
  const wait = immediate ? 0 : Math.max(0, MIN_INTERVAL_MS - (Date.now() - lastWriteAt));
  pendingTimer = setTimeout(publishNow, wait);
}

async function publishNow() {
  if (!publishing) return;
  const game = readGame();
  const json = JSON.stringify(game);
  if (json === lastPublishedJson) return;
  lastPublishedJson = json;
  await writeLiveGame({ ...game, status: "en_vivo" });
}

async function writeLiveGame(data, merge = false) {
  const { db, firestore, auth } = firebase;
  lastWriteAt = Date.now();
  updateStatus("Enviando…");
  try {
    await firestore.setDoc(firestore.doc(db, "liveGame", "actual"), {
      ...data,
      updatedAt: firestore.serverTimestamp(),
      updatedBy: auth.currentUser?.uid || ""
    }, { merge });
    lastWriteAt = Date.now();
    updateStatus();
  } catch (error) {
    console.error("Pizarra: no se pudo publicar", error);
    lastPublishedJson = "";
    updateStatus(error?.code === "permission-denied"
      ? "Firestore rechazó la escritura: faltan publicar las reglas nuevas (liveGame)."
      : "No se pudo enviar a la app. Se reintentará con el siguiente cambio.");
  }
}

async function finishGame() {
  const game = readGame();
  const summary = `${game.away} ${game.awayScore}, ${game.home} ${game.homeScore}`;
  if (!confirm(`¿Finalizar el juego y guardarlo en Resultados?\n\n${summary}`)) return;
  const { db, firestore } = firebase;
  ui.finish.disabled = true;
  updateStatus("Guardando resultado…");
  try {
    await firestore.addDoc(firestore.collection(db, "results"), {
      home: game.home,
      away: game.away,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      awayInnings: game.awayInnings,
      homeInnings: game.homeInnings,
      awayHits: game.awayHits,
      homeHits: game.homeHits,
      awayErrors: game.awayErrors,
      homeErrors: game.homeErrors,
      date: todayInParral(),
      source: "pizarra",
      updatedAt: firestore.serverTimestamp()
    });
    publishing = false;
    writeFlag(false);
    ui.toggle.checked = false;
    clearTimeout(pendingTimer);
    await writeLiveGame({ ...game, status: "final" });
    updateStatus(`Resultado guardado: ${summary}. Usa "Nuevo Juego" para reiniciar la pizarra.`);
  } catch (error) {
    console.error("Pizarra: no se pudo guardar el resultado", error);
    updateStatus("No se pudo guardar el resultado. Revisa la conexión e inténtalo de nuevo.");
  } finally {
    ui.finish.disabled = false;
  }
}

// ── Utilidades ────────────────────────────────────────────────────
function teamName(value, fallback) {
  const clean = String(value || "").replace(/[<>"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (!clean) return fallback;
  // La pizarra usa mayúsculas; en la app se leen mejor con mayúscula inicial
  return clean.toLocaleLowerCase("es-MX").replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase("es-MX"));
}

function clampInt(value, min, max) {
  const n = Math.trunc(Number(value));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
}

function todayInParral() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chihuahua", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return parts; // AAAA-MM-DD
}

function escapeAttr(value) {
  return String(value).replace(/[<>"'`&]/g, "");
}

function readFlag() {
  try {
    return localStorage.getItem(PUBLISH_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(on) {
  try {
    localStorage.setItem(PUBLISH_KEY, on ? "1" : "0");
  } catch {
    // Sin almacenamiento: el interruptor dura solo esta sesión
  }
}

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .mtv-gate { position: fixed; inset: 0; z-index: 9999; display: grid; place-items: center; padding: 16px; background: rgba(8, 9, 12, .94); }
    .mtv-gate-card { width: min(100%, 420px); display: grid; gap: 14px; padding: 24px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); }
    .mtv-gate-card h2 { font-size: 28px; letter-spacing: 1px; color: var(--accent); }
    .mtv-gate-msg { color: var(--text); font-size: 18px; }
    .mtv-gate-fields { display: grid; gap: 12px; }
    .mtv-gate-fields label { display: grid; gap: 6px; color: var(--muted); font-size: 15px; }
    .mtv-gate-fields input { font: inherit; font-size: 18px; padding: 10px 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text); }
    .mtv-sync { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin-left: auto; }
    .mtv-switch { display: inline-flex; align-items: center; gap: 8px; font-size: 18px; font-weight: 700; cursor: pointer; }
    .mtv-switch input { width: 22px; height: 22px; accent-color: var(--success); }
    .mtv-status { color: var(--muted); font-size: 15px; min-width: 16ch; }
    .topbar { flex-wrap: wrap; }
  `;
  document.head.append(style);
}
