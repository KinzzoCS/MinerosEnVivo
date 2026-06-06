import { requireAdmin } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  firestore.onSnapshot(firestore.query(firestore.collection(db, "chatMessages"), firestore.orderBy("createdAt", "desc"), firestore.limit(100)), snap => {
    qs("#messagesList").innerHTML = snap.docs.map(doc => {
      const item = { id: doc.id, ...doc.data() };
      return `<article class="admin-row"><div><strong>${sanitizeText(item.displayName, 30)}</strong><p class="meta">${sanitizeText(item.message, 180)}</p></div><div class="row-actions"><button class="danger-button" data-delete-message="${item.id}">Eliminar</button><button class="ghost-button" data-mute="${sanitizeText(item.userId, 80)}">Silenciar</button></div></article>`;
    }).join("");
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
}
