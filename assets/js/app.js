import { getFirebase } from "./firebase-service.js";
import { demoMatches, demoNews, demoResults, demoSettings } from "./demo-data.js";
import { formatDate, getGuestIdentity, qs, sanitizeText, setGuestName, youtubeEmbedUrl } from "./utils.js";

const state = { identity: getGuestIdentity(), lastMessageAt: 0, mutedUntil: 0, bannedWords: [], streamId: "" };
let currentSettings = demoSettings;
let chatUnsubscribe = null;
let firebaseApp = null;

init();

async function init() {
  qs("#displayName").textContent = state.identity.name;
  bindChatUi();
  renderFallback();

  const firebase = await getFirebase();
  if (!firebase) return;
  firebaseApp = firebase;
  listenPublicData(firebase);
  listenChat(firebase);
  listenModeration(firebase);
}

function renderFallback() {
  currentSettings = demoSettings;
  renderSettings(demoSettings);
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
  onSnapshot(query(collection(db, "matches"), orderBy("date", "asc"), limit(6)), snap => renderMatches(snap.empty ? demoMatches : snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "results"), orderBy("date", "desc"), limit(6)), snap => renderResults(snap.empty ? demoResults : snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "news"), where("featured", "==", true), orderBy("date", "desc"), limit(6)), snap => renderNews(snap.empty ? demoNews : snap.docs.map(docWithId)));
}

function renderSettings(settings) {
  const streamSelect = qs("#streamSelect");
  const streamId = state.streamId || settings.activeStream || "1";
  state.streamId = streamId;
  const currentStream = streamId === "2"
    ? { title: settings.liveTitle2, url: settings.liveStreamUrl2, status: settings.liveStatus2 }
    : { title: settings.liveTitle1, url: settings.liveStreamUrl1, status: settings.liveStatus1 };
  const title = sanitizeText(currentStream.title || settings.liveTitle || "Mineros TV en vivo", 90);
  qs("#liveTitle").textContent = title;
  qs("#liveStatusLabel").textContent = currentStream.status ? "En vivo ahora" : "Transmision programada";
  if (streamSelect && streamSelect.value !== streamId) streamSelect.value = streamId;
  const frame = qs("#streamFrame");
  frame.src = youtubeEmbedUrl(currentStream.url || settings.liveStreamUrl || "");
  qs("#playerFrame").classList.remove("skeleton");
}

function renderMatches(matches) {
  qs("#matchesGrid").innerHTML = matches.map(item => `
    <article class="sports-card">
      <span class="badge">${sanitizeText(item.tournament || "Temporada", 40)}</span>
      <h3>Mineros vs ${sanitizeText(item.rival, 42)}</h3>
      <p class="meta">${formatDate(item.date)} · ${sanitizeText(item.time || "Hora por definir", 20)}</p>
      <p class="meta">${sanitizeText(item.stadium || "Estadio por definir", 60)}</p>
    </article>`).join("");
}

function renderResults(results) {
  qs("#resultsList").innerHTML = results.map(item => `
    <article class="result-row">
      <strong>${sanitizeText(item.home, 32)}</strong>
      <span class="score">${Number(item.homeScore || 0)} - ${Number(item.awayScore || 0)}</span>
      <strong>${sanitizeText(item.away, 32)}</strong>
    </article>`).join("");
}

function renderNews(news) {
  qs("#newsGrid").innerHTML = news.map(item => `
    <a class="news-card" href="noticia.html?id=${encodeURIComponent(item.id)}">
      <img src="${item.imageUrl || "assets/img/news-1.svg"}" alt="">
      <div>
        <span class="badge">${formatDate(item.date)}</span>
        <h3>${sanitizeText(item.title, 90)}</h3>
        <p class="meta">${sanitizeText(item.summary, 140)}</p>
      </div>
    </a>`).join("");
}

function bindChatUi() {
  const streamSelect = qs("#streamSelect");
  if (streamSelect) {
    streamSelect.addEventListener("change", () => {
      state.streamId = streamSelect.value;
      renderSettings(currentSettings);
      if (firebaseApp) subscribeChat(firebaseApp);
    });
  }

  qs("#renameBtn").addEventListener("click", () => {
    const name = prompt("Nuevo nombre temporal", state.identity.name);
    if (!name) return;
    state.identity = setGuestName(name);
    qs("#displayName").textContent = state.identity.name;
  });

  qs("#chatForm").addEventListener("submit", async event => {
    event.preventDefault();
    const input = qs("#chatInput");
    const message = sanitizeText(input.value, 180);
    if (!message) return;
    if (Date.now() - state.lastMessageAt < 3500) {
      qs("#chatNote").textContent = "Espera unos segundos antes de enviar otro mensaje.";
      return;
    }
    if (Date.now() < state.mutedUntil) {
      qs("#chatNote").textContent = "Tu usuario temporal esta silenciado por moderacion.";
      return;
    }
    if (state.bannedWords.some(word => message.toLowerCase().includes(word))) {
      qs("#chatNote").textContent = "El mensaje contiene una palabra no permitida.";
      return;
    }
    const firebase = await getFirebase();
    if (!firebase) {
      appendLocalMessage(state.identity.name, message);
      input.value = "";
      return;
    }
    const { db, firestore } = firebase;
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
    qs("#chatNote").textContent = "Mensaje enviado.";
  });
}

function listenChat({ db, firestore }) {
  subscribeChat({ db, firestore });
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
    qs("#chatFeed").innerHTML = "";
    snap.docs.reverse().map(docWithId).filter(m => m.status !== "deleted").forEach(m => appendLocalMessage(m.displayName, m.message));
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

function appendLocalMessage(name, message) {
  const row = document.createElement("div");
  row.className = "chat-message";
  row.innerHTML = `<strong>${sanitizeText(name, 28)}</strong><span>${sanitizeText(message, 180)}</span>`;
  qs("#chatFeed").append(row);
  qs("#chatFeed").scrollTop = qs("#chatFeed").scrollHeight;
}

function docWithId(doc) {
  return { id: doc.id, ...doc.data() };
}
