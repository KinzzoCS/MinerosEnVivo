import { emptyRowHtml, errorText, notify, requireAdmin, rowHtml } from "./admin-common.js";
import { qs, sanitizeAttr, sanitizeText } from "../utils.js";
import { legacyStreams, normalizeStream, sortStreams } from "../streams.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "chatMessages");
  let currentStream = "all";
  let allMessages = [];
  let streamNames = {};

  // Filtro con todas las transmisiones existentes (spec 004, CA-06)
  const renderFilter = streams => {
    streamNames = Object.fromEntries(streams.map(s => [s.id, s.name]));
    if (currentStream !== "all" && !streamNames[currentStream]) currentStream = "all";
    qs("#streamFilter").innerHTML = [`<button type="button" data-stream-filter="all" aria-pressed="${currentStream === "all"}">Todas</button>`,
      ...streams.map(s => `<button type="button" data-stream-filter="${sanitizeAttr(s.id, 80)}" aria-pressed="${currentStream === s.id}">${sanitizeText(s.name, 60)}</button>`)].join("");
    renderMessages();
  };
  firestore.onSnapshot(firestore.collection(db, "streams"), async snap => {
    if (!snap.empty) return renderFilter(sortStreams(snap.docs.map(d => normalizeStream({ id: d.id, ...d.data() }))));
    const legacy = await firestore.getDoc(firestore.doc(db, "settings", "main"));
    renderFilter(legacyStreams(legacy.data()));
  });

  const visibleMessages = () => allMessages.filter(m =>
    m.status !== "deleted" && (currentStream === "all" || m.streamId === currentStream));

  function renderMessages() {
    const list = visibleMessages();
    qs("#messagesList").innerHTML = list.length ? list.map(item => rowHtml({
      id: item.id,
      title: item.displayName,
      subtitle: `${item.message} (${sanitizeText(streamNames[item.streamId] || `transmisión ${item.streamId}`, 60)})`,
      actions: `
        <button class="boton boton-peligro boton-chico" type="button" data-hide="${sanitizeAttr(item.id, 120)}">Ocultar</button>
        <button class="boton boton-borde boton-chico" type="button" data-mute="${sanitizeAttr(item.userId, 120)}" data-name="${sanitizeAttr(item.displayName, 40)}">Silenciar 30 min</button>`
    })).join("") : emptyRowHtml("No hay mensajes visibles en esta transmisión.");
  }

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("createdAt", "desc"), firestore.limit(100)), snap => {
    allMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMessages();
  });

  qs("#streamFilter").addEventListener("click", event => {
    const button = event.target.closest("[data-stream-filter]");
    if (!button) return;
    currentStream = button.dataset.streamFilter;
    qs("#streamFilter").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
    renderMessages();
  });

  firestore.onSnapshot(firestore.collection(db, "bannedWords"), snap => {
    qs("#wordsList").innerHTML = snap.empty ? emptyRowHtml("No hay palabras prohibidas.") : snap.docs.map(doc => rowHtml({
      id: doc.id,
      title: doc.data().word,
      actions: `<button class="boton boton-peligro boton-chico" type="button" data-delete-word="${sanitizeAttr(doc.id, 120)}">Quitar</button>`
    })).join("");
  });

  document.body.addEventListener("click", async event => {
    const hide = event.target.closest("[data-hide]")?.dataset.hide;
    const word = event.target.closest("[data-delete-word]")?.dataset.deleteWord;
    const muteBtn = event.target.closest("[data-mute]");
    try {
      if (hide) {
        await firestore.updateDoc(firestore.doc(db, "chatMessages", hide), { status: "deleted" });
        notify("#chatNote", "Mensaje ocultado.");
      }
      if (word) {
        await firestore.deleteDoc(firestore.doc(db, "bannedWords", word));
        notify("#wordNote", "Palabra quitada.");
      }
      if (muteBtn) {
        await firestore.setDoc(firestore.doc(db, "mutedUsers", muteBtn.dataset.mute), { mutedUntil: Date.now() + 1000 * 60 * 30 });
        notify("#chatNote", `${muteBtn.dataset.name || "El usuario"} no podrá escribir durante 30 minutos.`);
      }
    } catch (error) {
      notify(word ? "#wordNote" : "#chatNote", `No se pudo completar: ${errorText(error)}`, "error");
    }
  });

  qs("#wordForm").addEventListener("submit", async event => {
    event.preventDefault();
    const value = sanitizeText(qs("#word").value, 50).toLowerCase();
    if (!value) return;
    try {
      await firestore.addDoc(firestore.collection(db, "bannedWords"), { word: value });
      qs("#wordForm").reset();
      notify("#wordNote", `"${value}" ya no se podrá escribir en el chat.`);
    } catch (error) {
      notify("#wordNote", `No se pudo agregar: ${errorText(error)}`, "error");
    }
  });

  qs("#clearChat").addEventListener("click", async () => {
    const target = visibleMessages();
    if (!target.length) return;
    if (!confirm(`¿Ocultar los ${target.length} mensajes visibles${currentStream === "all" ? "" : ` de ${streamNames[currentStream] || "esta transmisión"}`}?`)) return;
    try {
      await Promise.all(target.map(m => firestore.updateDoc(firestore.doc(db, "chatMessages", m.id), { status: "deleted" })));
      notify("#chatNote", "Chat limpio.");
    } catch (error) {
      notify("#chatNote", `No se pudo limpiar: ${errorText(error)}`, "error");
    }
  });
}
