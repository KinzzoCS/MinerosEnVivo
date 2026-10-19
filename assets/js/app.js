import { getFirebase } from "./firebase-service.js";
import { demoLiveGame, demoMatches, demoNews, demoResults, demoSettings } from "./demo-data.js";
import { docWithId, emptyHtml, isLiveGame, liveGameHtml, matchHtml, matchTitle, newsCardHtml, scoreboardHtml, upcomingMatches } from "./components.js";
import { formatDate, formatTime, getGuestIdentity, matchStart, qs, sanitizeText, setGuestName, youtubeEmbedUrl } from "./utils.js";

const state = {
  identity: getGuestIdentity(),
  lastMessageAt: 0,
  mutedUntil: 0,
  bannedWords: [],
  streamId: "",
  userPickedStream: false,
  matches: demoMatches,
  live: false
};
let currentSettings = demoSettings;
let chatUnsubscribe = null;
let firebaseApp = null;
let viewerDocId = "";
let viewerIntervalId = null;
let viewerCountIntervalId = null;
let countdownIntervalId = null;
let liveGameUnsubscribe = null;
let liveGame = null;
const VIEWER_STALE_SECONDS = 60;

init();

async function init() {
  qs("#displayName").textContent = state.identity.name;
  bindStreamSelector();
  bindChatUi();
  bindRename();
  renderFallback();

  const firebase = await getFirebase();
  if (!firebase) return;
  firebaseApp = firebase;
  listenPublicData(firebase);
  listenLiveGame(firebase);
  subscribeChat(firebase);
  listenModeration(firebase);
  initViewerPresence(firebase);
  if (state.streamId) updateViewerPresence();
}

function renderFallback() {
  currentSettings = demoSettings;
  liveGame = demoLiveGame;
  renderSettings(demoSettings);
  renderLiveGame();
  renderMatches(demoMatches);
  renderResults(demoResults);
  renderNews(demoNews);
}

function listenPublicData({ db, firestore }) {
  const { collection, doc, limit, onSnapshot, orderBy, query, where } = firestore;
  onSnapshot(doc(db, "settings", "main"), snap => {
    currentSettings = snap.exists() ? { ...demoSettings, ...snap.data() } : demoSettings;
    renderSettings(currentSettings);
  });
  onSnapshot(query(collection(db, "matches"), where("date", ">=", isoDaysFromToday(-1)), orderBy("date", "asc"), limit(8)),
    snap => renderMatches(snap.empty ? [] : snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "results"), orderBy("date", "desc"), limit(1)),
    snap => renderResults(snap.empty ? demoResults : snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "news"), where("featured", "==", true), orderBy("date", "desc"), limit(3)),
    snap => renderNews(snap.empty ? demoNews : snap.docs.map(docWithId)));
}

// Marcador en vivo de la pizarra del estadio. Cada cambio cuesta una lectura por espectador,
// así que solo se escucha mientras la pantalla está visible.
function listenLiveGame({ db, firestore }) {
  const subscribe = () => {
    if (liveGameUnsubscribe || document.hidden) return;
    liveGameUnsubscribe = firestore.onSnapshot(firestore.doc(db, "liveGame", "actual"), snap => {
      liveGame = snap.exists() ? snap.data() : null;
      renderLiveGame();
    }, error => console.error("Live game error:", error));
  };
  const unsubscribe = () => {
    if (!liveGameUnsubscribe) return;
    liveGameUnsubscribe();
    liveGameUnsubscribe = null;
  };
  liveGame = null;
  renderLiveGame();
  subscribe();
  document.addEventListener("visibilitychange", () => (document.hidden ? unsubscribe() : subscribe()));
}

function renderLiveGame() {
  const box = qs("#liveScore");
  const show = isLiveGame(liveGame);
  box.hidden = !show;
  box.innerHTML = show ? liveGameHtml(liveGame) : "";
  renderNoGame();
}

function isoDaysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function streamsFrom(settings) {
  return {
    "1": { title: settings.liveTitle1, url: settings.liveStreamUrl1, live: Boolean(settings.liveStatus1) },
    "2": { title: settings.liveTitle2, url: settings.liveStreamUrl2, live: Boolean(settings.liveStatus2) }
  };
}

function renderSettings(settings) {
  const streams = streamsFrom(settings);
  const hasSecond = Boolean(youtubeEmbedUrl(streams["2"].url || ""));
  qs(".selector").hidden = !hasSecond;

  // Si la persona no ha elegido, se muestra la transmisión activa (o la que esté en vivo)
  if (!state.userPickedStream || !hasSecond) {
    const active = settings.activeStream === "2" && hasSecond ? "2" : "1";
    state.streamId = !streams[active].live && hasSecond && streams[active === "1" ? "2" : "1"].live
      ? (active === "1" ? "2" : "1")
      : active;
  }

  const current = streams[state.streamId];
  state.live = current.live;
  document.querySelectorAll("[data-stream-option]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.streamOption === state.streamId));
  });

  qs("#liveTitle").textContent = sanitizeText(current.title || settings.liveTitle || "Mineros TV en vivo", 90);
  const status = qs("#liveStatus");
  status.textContent = current.live ? "En vivo" : "Sin transmisión en vivo";
  status.className = `pastilla ${current.live ? "pastilla-vivo" : "pastilla-espera"}`;

  const embed = youtubeEmbedUrl(current.url || settings.liveStreamUrl || "");
  const frame = qs("#streamFrame");
  // Solo recarga el video si cambió la URL, para no cortar la transmisión en cada actualización
  if (frame.dataset.src !== embed) {
    frame.dataset.src = embed;
    if (embed) frame.src = embed;
    else frame.removeAttribute("src");
  }
  qs("#playerFrame").classList.toggle("cargando", !embed);

  renderNoGame();
  updateViewerPresence();
}

// Cuando no hay juego en vivo: cuánto falta para el siguiente.
function renderNoGame() {
  const box = qs("#sinJuego");
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = null;
  const next = upcomingMatches(state.matches).find(match => matchStart(match) > new Date());
  if (state.live || isLiveGame(liveGame) || !next) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  box.hidden = false;
  box.className = "proximo tarjeta";
  box.innerHTML = `
    <h2 class="proximo-titulo">Hoy no hay juego en vivo</h2>
    <p class="tenue">${matchTitle(next)}: ${formatDate(next.date, { weekday: "long", day: "numeric", month: "long" })}, ${formatTime(next.time)}, ${sanitizeText(next.stadium || "Estadio por definir", 60)}.</p>
    <div class="cuenta" role="timer" aria-live="off" aria-label="Tiempo para el siguiente juego">
      <div><strong data-cuenta="dias">0</strong><span>días</span></div>
      <div><strong data-cuenta="horas">0</strong><span>horas</span></div>
      <div><strong data-cuenta="minutos">0</strong><span>minutos</span></div>
    </div>`;
  const tick = () => {
    const ms = Math.max(0, matchStart(next) - new Date());
    const minutes = Math.floor(ms / 60000);
    box.querySelector('[data-cuenta="dias"]').textContent = String(Math.floor(minutes / 1440)).padStart(2, "0");
    box.querySelector('[data-cuenta="horas"]').textContent = String(Math.floor(minutes / 60) % 24).padStart(2, "0");
    box.querySelector('[data-cuenta="minutos"]').textContent = String(minutes % 60).padStart(2, "0");
  };
  tick();
  countdownIntervalId = setInterval(tick, 30000);
}

function bindStreamSelector() {
  document.querySelectorAll("[data-stream-option]").forEach(button => {
    button.addEventListener("click", () => {
      if (state.streamId === button.dataset.streamOption) return;
      state.userPickedStream = true;
      state.streamId = button.dataset.streamOption;
      renderSettings(currentSettings);
      if (firebaseApp) subscribeChat(firebaseApp);
    });
  });
}

function initViewerPresence({ db, firestore }) {
  window.addEventListener("pagehide", () => {
    if (!viewerDocId) return;
    firestore.deleteDoc(firestore.doc(db, "viewers", viewerDocId));
  });
}

function updateViewerPresence() {
  if (!firebaseApp || !state.streamId) return;
  const { db, firestore } = firebaseApp;
  const nextDocId = `${state.identity.id}-${state.streamId}`;
  if (nextDocId === viewerDocId && viewerIntervalId) return;
  const previousDocId = viewerDocId;
  viewerDocId = nextDocId;

  if (previousDocId && previousDocId !== nextDocId) {
    firestore.deleteDoc(firestore.doc(db, "viewers", previousDocId));
  }

  const writePresence = () => firestore.setDoc(firestore.doc(db, "viewers", viewerDocId), {
    streamId: state.streamId,
    displayName: state.identity.name,
    lastSeen: new Date()
  });
  writePresence();
  if (!viewerIntervalId) viewerIntervalId = setInterval(writePresence, 15000);

  subscribeViewerCount();
}

async function fetchViewerCount() {
  if (!firebaseApp || !state.streamId) return;
  const { db, firestore } = firebaseApp;
  try {
    const cutoff = firestore.Timestamp.fromDate(new Date(Date.now() - VIEWER_STALE_SECONDS * 1000));
    const q = firestore.query(
      firestore.collection(db, "viewers"),
      firestore.where("streamId", "==", state.streamId),
      firestore.where("lastSeen", ">=", cutoff)
    );
    const snap = await firestore.getDocs(q);
    qs("#viewers").hidden = snap.size === 0;
    qs("#viewersCount").textContent = String(snap.size);
  } catch (error) {
    console.error("Viewer count error:", error);
  }
}

function subscribeViewerCount() {
  if (!firebaseApp || !state.streamId) return;
  if (viewerCountIntervalId) clearInterval(viewerCountIntervalId);
  fetchViewerCount();
  viewerCountIntervalId = setInterval(fetchViewerCount, 10000);
}

function renderMatches(matches) {
  state.matches = matches;
  const upcoming = upcomingMatches(matches).slice(0, 3);
  qs("#matchesGrid").innerHTML = upcoming.length
    ? upcoming.map(matchHtml).join("")
    : emptyHtml("Todavía no hay juegos programados", "Cuando se anuncie el siguiente juego aparecerá aquí.");
  renderNoGame();
}

function renderResults(results) {
  qs("#lastResult").innerHTML = results.length
    ? scoreboardHtml(results[0])
    : emptyHtml("Aún no hay resultados", "El marcador del último juego aparecerá aquí.");
}

function renderNews(news) {
  qs("#newsGrid").innerHTML = news.length
    ? news.slice(0, 3).map(newsCardHtml).join("")
    : emptyHtml("Sin noticias por ahora", "Las noticias del equipo aparecerán aquí.");
}

function setNote(text) {
  qs("#chatNote").textContent = text;
}

function bindChatUi() {
  qs("#chatForm").addEventListener("submit", async event => {
    event.preventDefault();
    const input = qs("#chatInput");
    const message = sanitizeText(input.value, 180);
    if (!message) return;
    if (Date.now() - state.lastMessageAt < 3500) {
      setNote("Espera unos segundos antes de enviar otro mensaje.");
      return;
    }
    if (Date.now() < state.mutedUntil) {
      setNote("Un moderador te silenció por un rato. Podrás escribir de nuevo más tarde.");
      return;
    }
    if (state.bannedWords.some(word => message.toLowerCase().includes(word))) {
      setNote("El mensaje tiene una palabra no permitida. Cámbiala para enviarlo.");
      return;
    }
    const firebase = await getFirebase();
    if (!firebase) {
      appendMessage(state.identity.name, message, true);
      input.value = "";
      return;
    }
    const { db, firestore } = firebase;
    try {
      await firestore.addDoc(firestore.collection(db, "chatMessages"), {
        userId: state.identity.id,
        displayName: state.identity.name,
        message,
        streamId: state.streamId,
        status: "visible",
        createdAt: firestore.serverTimestamp()
      });
      state.lastMessageAt = Date.now();
      input.value = "";
      setNote("Sin registro. Respeta a la comunidad minera.");
    } catch (error) {
      console.error("Chat error:", error);
      setNote("No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.");
    }
  });
}

function bindRename() {
  const dialog = qs("#nameDialog");
  const input = qs("#nameInput");
  qs("#renameBtn").addEventListener("click", () => {
    input.value = state.identity.name;
    dialog.showModal();
    input.select();
  });
  dialog.addEventListener("close", () => {
    if (dialog.returnValue !== "guardar") return;
    state.identity = setGuestName(input.value);
    qs("#displayName").textContent = state.identity.name;
    viewerDocId = "";
    updateViewerPresence();
  });
}

function subscribeChat({ db, firestore }) {
  if (chatUnsubscribe) chatUnsubscribe();
  const q = firestore.query(
    firestore.collection(db, "chatMessages"),
    firestore.where("streamId", "==", state.streamId),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(60)
  );
  chatUnsubscribe = firestore.onSnapshot(q, snap => {
    const feed = qs("#chatFeed");
    const messages = snap.docs.reverse().map(docWithId).filter(m => m.status !== "deleted");
    feed.innerHTML = messages.length ? "" : `<p class="chat-vacio">Todavía no hay mensajes. Escribe el primero.</p>`;
    messages.forEach(m => appendMessage(m.displayName, m.message, m.userId === state.identity.id));
  });
}

function listenModeration({ db, firestore }) {
  firestore.onSnapshot(firestore.doc(db, "mutedUsers", state.identity.id), snap => {
    state.mutedUntil = snap.exists() ? Number(snap.data().mutedUntil || 0) : 0;
  });
  firestore.onSnapshot(firestore.collection(db, "bannedWords"), snap => {
    state.bannedWords = snap.docs.map(doc => sanitizeText(doc.data().word, 50).toLowerCase()).filter(Boolean);
  });
}

function appendMessage(name, message, own) {
  const feed = qs("#chatFeed");
  feed.querySelector(".chat-vacio")?.remove();
  const nearBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 80;
  const row = document.createElement("div");
  row.className = own ? "msg propio" : "msg";
  const author = document.createElement("b");
  author.textContent = own ? "Tú" : sanitizeText(name, 28);
  const text = document.createElement("span");
  text.textContent = sanitizeText(message, 180);
  row.append(author, text);
  feed.append(row);
  // No se brinca al final si la persona está leyendo mensajes anteriores
  if (own || nearBottom) feed.scrollTop = feed.scrollHeight;
}
