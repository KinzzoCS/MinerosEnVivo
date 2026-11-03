import { getFirebase } from "./firebase-service.js";
import { demoBasketballNews, demoChampionships, demoLiveGame, demoMatches, demoNews, demoResults, demoSeasons, demoSettings, demoSportsConfig, demoStreams } from "./demo-data.js";
import { docWithId, emptyHtml, isLiveGame, liveGameHtml, matchHtml, matchTitle, newsCardHtml, scoreboardHtml, toggleOffSeason, upcomingMatches } from "./components.js";
import { formatDate, formatTime, getGuestIdentity, matchStart, qs, sanitizeAttr, sanitizeText, setGuestName, youtubeEmbedUrl } from "./utils.js";
import { explicitSport, isSportActive, multiSport, newsSports, noSportsActive, readSelectedSport, SPORT_LABELS, sportOf, sportsConfig } from "./sports.js";
import { preferSport } from "./home.js";
import { buildSeasonIndex } from "./seasons.js";
import { isNearBottom, newMessagesLabel, planChatUpdate } from "./chat.js";
import { legacyStreams, liveStreams, noLiveHtml, noLiveSportHtml } from "./streams.js";

const state = {
  identity: getGuestIdentity(),
  lastMessageAt: 0,
  mutedUntil: 0,
  bannedWords: [],
  streamId: "",
  chatStreamId: "",
  chatLimit: 60,
  renderedIds: [],
  unseen: 0,
  streamDocs: demoStreams,
  matches: demoMatches,
  results: demoResults,
  news: [...demoNews, ...demoBasketballNews],
  config: sportsConfig(demoSportsConfig),
  streamSport: "",
  championships: demoChampionships,
  seasons: demoSeasons,
  seasonIndex: buildSeasonIndex(demoChampionships, demoSeasons),
  live: false
};
let legacySettings = demoSettings;
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
  bindChatScroll();
  bindRename();
  renderFallback();

  const firebase = await getFirebase();
  if (!firebase) return;
  firebaseApp = firebase;
  state.config = sportsConfig(null);
  state.streamDocs = [];
  legacySettings = null;
  state.championships = [];
  state.seasons = [];
  state.seasonIndex = buildSeasonIndex([], []);
  listenPublicData(firebase);
  listenLiveGame(firebase);
  listenModeration(firebase);
  initViewerPresence(firebase);
}

function renderFallback() {
  liveGame = demoLiveGame;
  renderStreams();
  renderMatches(demoMatches);
  renderResults(demoResults);
  renderNews(state.news);
}

function listenPublicData({ db, firestore }) {
  const { collection, doc, limit, onSnapshot, orderBy, query, where } = firestore;
  onSnapshot(doc(db, "settings", "deportes"), snap => {
    state.config = sportsConfig(snap.exists() ? snap.data() : null);
    renderStreams();
    renderMatches(state.matches);
    renderResults(state.results);
    renderNews(state.news);
  });
  // Medios de transmisión (spec 004). Si la colección está vacía, se usan los dos de settings/main.
  onSnapshot(collection(db, "streams"), snap => {
    state.streamDocs = snap.docs.map(docWithId);
    renderStreams();
  });
  onSnapshot(doc(db, "settings", "main"), snap => {
    legacySettings = snap.exists() ? snap.data() : null;
    renderStreams();
  });
  const rebuildSeasons = () => {
    state.seasonIndex = buildSeasonIndex(state.championships, state.seasons);
    renderMatches(state.matches);
  };
  onSnapshot(collection(db, "championships"), snap => {
    state.championships = snap.docs.map(docWithId);
    rebuildSeasons();
  });
  onSnapshot(collection(db, "seasons"), snap => {
    state.seasons = snap.docs.map(docWithId);
    rebuildSeasons();
  });
  onSnapshot(query(collection(db, "matches"), where("date", ">=", isoDaysFromToday(-1)), orderBy("date", "asc"), limit(8)),
    snap => renderMatches(snap.empty ? [] : snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "results"), orderBy("date", "desc"), limit(6)),
    snap => renderResults(snap.empty ? demoResults : snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "news"), where("featured", "==", true), orderBy("date", "desc"), limit(9)),
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

// La pizarra es solo de béisbol: se oculta con una transmisión de básquetbol o con el béisbol apagado.
// Sin ninguna transmisión en vivo se sigue mostrando (spec 004, CA-13).
function pizarraGameLive() {
  return isLiveGame(liveGame) && sportOf(liveGame) === "beisbol" && isSportActive(state.config, "beisbol")
    && (!state.live || state.streamSport === "beisbol");
}

function renderLiveGame() {
  const box = qs("#liveScore");
  const show = state.live && pizarraGameLive();
  box.hidden = !show;
  box.innerHTML = show ? liveGameHtml(liveGame) : "";
  if (!state.live) renderNoLive();
}

function isoDaysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function currentStreams() {
  return state.streamDocs.length ? state.streamDocs : legacyStreams(legacySettings);
}

// Fuera de temporada (ningún deporte activo): sin video, chat ni presencia (spec 003, CA-04).
function applyOffSeason() {
  const off = noSportsActive(state.config);
  toggleOffSeason(off, "", state.config);
  if (off) stopPlayback();
  return off;
}

function stopPlayback() {
  const frame = qs("#streamFrame");
  frame.removeAttribute("src");
  frame.dataset.src = "";
  stopPresence();
  if (chatUnsubscribe) {
    chatUnsubscribe();
    chatUnsubscribe = null;
  }
  state.chatStreamId = "";
  state.live = false;
  state.streamId = "";
  state.streamSport = "";
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = null;
}

function stopPresence() {
  if (viewerIntervalId) clearInterval(viewerIntervalId);
  if (viewerCountIntervalId) clearInterval(viewerCountIntervalId);
  viewerIntervalId = null;
  viewerCountIntervalId = null;
  if (firebaseApp && viewerDocId) firebaseApp.firestore.deleteDoc(firebaseApp.firestore.doc(firebaseApp.db, "viewers", viewerDocId));
  viewerDocId = "";
}

// Solo se muestran las transmisiones en vivo (spec 004, CA-08). Sin ninguna, aviso con redes (CA-09).
function renderStreams() {
  if (applyOffSeason()) return;
  // Todas las transmisiones en vivo, con las del deporte elegido en Inicio primero (spec 005, CA-05)
  const preferred = multiSport(state.config) ? readSelectedSport(state.config) : null;
  const live = preferred ? preferSport(liveStreams(currentStreams(), state.config), preferred) : liveStreams(currentStreams(), state.config);
  const grid = qs(".envivo-grid");
  const noLiveBox = qs("#sinVivo");
  if (!live.length) {
    qs("#sinVivoDeporte").hidden = true;
    stopPlayback();
    grid.hidden = true;
    noLiveBox.hidden = false;
    renderNoLive();
    return;
  }
  grid.hidden = false;
  noLiveBox.hidden = true;
  noLiveBox.innerHTML = "";
  renderSportWithoutLive(live);
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = null;

  // Se respeta la elección de la persona mientras su transmisión siga en vivo
  if (!live.some(s => s.id === state.streamId)) state.streamId = live[0].id;
  const current = live.find(s => s.id === state.streamId);
  state.live = true;
  state.streamSport = current.sport;

  const selector = qs("#streamSelector");
  selector.hidden = live.length < 2;
  selector.innerHTML = live.length < 2 ? "" : live.map(s =>
    `<button type="button" data-stream-option="${sanitizeAttr(s.id, 80)}" aria-pressed="${s.id === state.streamId}">${sanitizeText(s.name, 60)}</button>`).join("");

  // El deporte de la transmisión se dice en texto, solo si hay más de un deporte (spec 001, CA-09)
  const sportPill = qs("#liveSport");
  sportPill.hidden = !multiSport(state.config);
  sportPill.textContent = SPORT_LABELS[current.sport];
  qs("#liveTitle").textContent = current.title || `${current.name} en vivo`;
  const status = qs("#liveStatus");
  status.textContent = "En vivo";
  status.className = "pastilla pastilla-vivo";

  const embed = youtubeEmbedUrl(current.url);
  const frame = qs("#streamFrame");
  frame.title = `Transmisión en vivo: ${current.name}`;
  // Solo recarga el video si cambió la URL, para no cortar la transmisión en cada actualización
  if (frame.dataset.src !== embed) {
    frame.dataset.src = embed;
    frame.src = embed;
  }
  qs("#playerFrame").classList.remove("cargando");

  if (firebaseApp && state.chatStreamId !== state.streamId) subscribeChat(firebaseApp);
  renderLiveGame();
  updateViewerPresence();
}

// El deporte que la persona eligió no tiene transmisión, pero otro sí: se avisa arriba (spec 005, CA-11).
function renderSportWithoutLive(live) {
  const box = qs("#sinVivoDeporte");
  const chosen = multiSport(state.config) ? explicitSport(state.config) : null;
  const show = Boolean(chosen) && !live.some(s => s.sport === chosen);
  box.hidden = !show;
  if (!show) {
    box.innerHTML = "";
    return;
  }
  const next = upcomingMatches(state.matches.filter(m => sportOf(m) === chosen)).find(match => matchStart(match) > new Date());
  const nextHtml = next
    ? `<p class="deporte-proximo"><span class="tenue">Próximo juego</span><strong>${matchTitle(next, state.config)}</strong><span>${formatDate(next.date, { weekday: "long", day: "numeric", month: "long" })}, ${formatTime(next.time)}${next.stadium ? `. ${sanitizeText(next.stadium, 60)}` : ""}</span></p>`
    : "";
  box.innerHTML = noLiveSportHtml(state.config, chosen, nextHtml);
}

// Aviso sin transmisión: redes de cada equipo, marcador de la pizarra y próximo juego con cuenta regresiva.
function renderNoLive() {
  const box = qs("#sinVivo");
  if (!box || box.hidden || noSportsActive(state.config)) return;
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = null;
  const next = upcomingMatches(state.matches.filter(activeSport)).find(match => matchStart(match) > new Date());
  const score = pizarraGameLive() ? `<div class="sin-vivo-marcador">${liveGameHtml(liveGame)}</div>` : "";
  const nextHtml = next ? `
    <div class="proximo">
      <h2 class="proximo-titulo">Próximo juego</h2>
      <p class="tenue">${showSports() ? `${SPORT_LABELS[sportOf(next)]}. ` : ""}${matchTitle(next, state.config)}: ${formatDate(next.date, { weekday: "long", day: "numeric", month: "long" })}, ${formatTime(next.time)}, ${sanitizeText(next.stadium || "Lugar por definir", 60)}.</p>
      <div class="cuenta" role="timer" aria-live="off" aria-label="Tiempo para el próximo juego">
        <div><strong data-cuenta="dias">0</strong><span>días</span></div>
        <div><strong data-cuenta="horas">0</strong><span>horas</span></div>
        <div><strong data-cuenta="minutos">0</strong><span>minutos</span></div>
      </div>
    </div>` : "";
  box.innerHTML = noLiveHtml(state.config, score + nextHtml);
  if (!next) return;
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
  qs("#streamSelector").addEventListener("click", event => {
    const button = event.target.closest("[data-stream-option]");
    if (!button || state.streamId === button.dataset.streamOption) return;
    state.streamId = button.dataset.streamOption;
    renderStreams();
  });
}

function initViewerPresence({ db, firestore }) {
  window.addEventListener("pagehide", () => {
    if (!viewerDocId) return;
    firestore.deleteDoc(firestore.doc(db, "viewers", viewerDocId));
  });
}

function updateViewerPresence() {
  if (!firebaseApp || !state.streamId || !state.live || noSportsActive(state.config)) return;
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

// El contenido de un deporte apagado no aparece en la app (spec 001 CA-04, spec 003 CA-02).
function activeSport(doc) {
  return isSportActive(state.config, sportOf(doc));
}

function showSports() {
  return multiSport(state.config);
}

function renderMatches(matches) {
  state.matches = matches;
  const upcoming = upcomingMatches(matches.filter(activeSport)).slice(0, 3);
  qs("#matchesGrid").innerHTML = upcoming.length
    ? upcoming.map(match => matchHtml(match, { config: state.config, showSport: showSports(), seasons: state.seasonIndex })).join("")
    : emptyHtml("Todavía no hay juegos programados", "Cuando se anuncie el siguiente juego aparecerá aquí.");
  if (!state.live) renderNoLive();
  else renderSportWithoutLive(liveStreams(currentStreams(), state.config));
}

function renderResults(results) {
  state.results = results;
  const latest = results.find(activeSport);
  qs("#lastResult").innerHTML = latest
    ? scoreboardHtml(latest, { showSport: showSports() })
    : emptyHtml("Aún no hay resultados", "El marcador del último juego aparecerá aquí.");
}

function renderNews(news) {
  state.news = news;
  // Fuera de temporada se muestran todas; si no, solo las de deportes activos
  const visible = noSportsActive(state.config) ? news : news.filter(item => newsSports(item).some(sport => isSportActive(state.config, sport)));
  qs("#newsGrid").innerHTML = visible.length
    ? visible.slice(0, 3).map(newsCardHtml).join("")
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
    if (!message || !state.streamId) return;
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
      appendMessage(state.identity.name, message);
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

// Chat de la transmisión elegida: cada medio tiene el suyo (streamId = id de la transmisión).
// Se actualiza por partes (spec 006): no se redibuja la lista ni se mueve si la persona está leyendo arriba.
function subscribeChat({ db, firestore }, { keep = false } = {}) {
  if (chatUnsubscribe) chatUnsubscribe();
  if (!keep) {
    state.chatLimit = 60;
    state.renderedIds = [];
    state.unseen = 0;
    qs("#chatList").innerHTML = `<p class="chat-vacio">Todavía no hay mensajes. Escribe el primero.</p>`;
    updateNewButton();
  }
  state.chatStreamId = state.streamId;
  const q = firestore.query(
    firestore.collection(db, "chatMessages"),
    firestore.where("streamId", "==", state.streamId),
    firestore.orderBy("createdAt", "desc"),
    firestore.limit(state.chatLimit)
  );
  chatUnsubscribe = firestore.onSnapshot(q, snap => {
    const messages = snap.docs.reverse().map(docWithId).filter(m => m.status !== "deleted");
    renderChat(messages);
    qs("#chatOlder").hidden = snap.size < state.chatLimit;
  });
}

function renderChat(messages) {
  const feed = qs("#chatFeed");
  const list = qs("#chatList");
  const wasNear = isNearBottom(feed);
  const heightBefore = feed.scrollHeight;
  const plan = planChatUpdate(state.renderedIds, messages);
  if (plan.rebuild) list.innerHTML = "";
  list.querySelector(".chat-vacio")?.remove();
  plan.remove.forEach(id => list.querySelector(`[data-id="${CSS.escape(id)}"]`)?.remove());
  if (plan.prepend.length) {
    const first = list.firstChild;
    plan.prepend.forEach(m => list.insertBefore(messageNode(m), first));
    // Mantiene el punto de lectura al cargar mensajes anteriores
    feed.scrollTop += feed.scrollHeight - heightBefore;
  }
  const added = plan.rebuild ? messages : plan.append;
  added.forEach(m => list.append(messageNode(m)));
  state.renderedIds = messages.map(m => m.id);
  if (!messages.length) list.innerHTML = `<p class="chat-vacio">Todavía no hay mensajes. Escribe el primero.</p>`;

  const ownNew = added.some(m => m.userId === state.identity.id);
  if (wasNear || ownNew || plan.rebuild) {
    scrollChatToBottom();
  } else {
    state.unseen += added.filter(m => m.userId !== state.identity.id).length;
    updateNewButton();
  }
}

function messageNode(m) {
  const own = m.userId === state.identity.id;
  const row = document.createElement("div");
  row.className = own ? "msg propio" : "msg";
  if (m.id) row.dataset.id = m.id;
  const author = document.createElement("b");
  author.textContent = own ? "Tú" : sanitizeText(m.displayName, 28);
  const text = document.createElement("span");
  text.textContent = sanitizeText(m.message, 180);
  row.append(author, text);
  return row;
}

function scrollChatToBottom(smooth = false) {
  const feed = qs("#chatFeed");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  feed.scrollTo({ top: feed.scrollHeight, behavior: smooth && !reduce ? "smooth" : "auto" });
  state.unseen = 0;
  updateNewButton();
}

function updateNewButton() {
  const button = qs("#chatNew");
  button.hidden = state.unseen === 0;
  button.textContent = state.unseen ? `${newMessagesLabel(state.unseen)}. Ir al final` : "";
}

function bindChatScroll() {
  const feed = qs("#chatFeed");
  feed.addEventListener("scroll", () => {
    if (state.unseen && isNearBottom(feed)) {
      state.unseen = 0;
      updateNewButton();
    }
  }, { passive: true });
  qs("#chatNew").addEventListener("click", () => {
    scrollChatToBottom(true);
    feed.focus({ preventScroll: true });
  });
  qs("#chatOlder").addEventListener("click", () => {
    if (!firebaseApp) return;
    state.chatLimit += 60;
    subscribeChat(firebaseApp, { keep: true });
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

// Modo demo (sin Firebase): los mensajes se muestran solo en este teléfono
const localMessages = [];
function appendMessage(name, message) {
  localMessages.push({ id: `local-${Date.now()}-${localMessages.length}`, displayName: name, message, userId: state.identity.id });
  renderChat(localMessages);
}
