import { requireAdmin } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "chatMessages");
  let currentStream = "all";
  let allMessages = [];

  function renderMessages() {
    const filtered = allMessages.filter(m => {
      if (m.status === "deleted") return false;
      if (currentStream !== "all" && m.streamId !== currentStream) return false;
      return true;
    });
    qs("#messagesList").innerHTML = filtered.map(item =>
      `<article class="admin-row"><div><strong>${sanitizeText(item.displayName, 30)}</strong><p class="meta">${sanitizeText(item.message, 180)}</p></div><div class="row-actions"><button class="danger-button" data-delete-message="${item.id}">Eliminar</button><button class="ghost-button" data-mute="${sanitizeText(item.userId, 80)}">Silenciar</button></div></article>`
    ).join("");
  }

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("createdAt", "desc"), firestore.limit(100)), snap => {
    allMessages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMessages();
  });

  document.querySelectorAll("[data-stream-filter]").forEach(btn => {
    btn.addEventListener("click", () => {
      currentStream = btn.dataset.streamFilter;
      document.querySelectorAll("[data-stream-filter]").forEach(b => { b.style.background = ""; b.style.color = ""; });
      btn.style.background = "var(--accent)"; btn.style.color = "#fff";
      renderMessages();
    });
  });

  firestore.onSnapshot(firestore.collection(db, "bannedWords"), snap => {
    qs("#wordsList").innerHTML = snap.docs.map(doc => `<article class="admin-row"><strong>${sanitizeText(doc.data().word, 50)}</strong><button class="danger-button" data-delete-word="${doc.id}">Eliminar</button></article>`).join("");
  });

  document.body.addEventListener("click", async event => {
    if (event.target.dataset.deleteMessage) await firestore.updateDoc(firestore.doc(db, "chatMessages", event.target.dataset.deleteMessage), { status: "deleted" });
    if (event.target.dataset.deleteWord) await firestore.deleteDoc(firestore.doc(db, "bannedWords", event.target.dataset.deleteWord));
    if (event.target.dataset.mute) await firestore.setDoc(firestore.doc(db, "mutedUsers", event.target.dataset.mute), { mutedUntil: Date.now() + 1000 * 60 * 30 });
  });

  qs("#wordForm").addEventListener("submit", async event => {
    event.preventDefault();
    await firestore.addDoc(firestore.collection(db, "bannedWords"), { word: sanitizeText(qs("#word").value, 50).toLowerCase() });
    qs("#wordForm").reset();
  });

  qs("[data-clear-chat]").addEventListener("click", async () => {
    if (!confirm("Eliminar todos los mensajes visibles?")) return;
    const target = allMessages.filter(m => {
      if (m.status === "deleted") return false;
      if (currentStream !== "all" && m.streamId !== currentStream) return false;
      return true;
    });
    await Promise.all(target.map(m => firestore.updateDoc(firestore.doc(db, "chatMessages", m.id), { status: "deleted" })));
  });
}
