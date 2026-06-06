import { requireAdmin, rowTemplate } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "players");
  let docs = [];
  firestore.onSnapshot(firestore.query(col, firestore.orderBy("number", "asc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    qs("#itemsList").innerHTML = docs.map(item => rowTemplate(`#${item.number} ${item.name}`, item.position, item.id)).join("");
  });
  qs("#itemsList").addEventListener("click", async event => {
    const item = docs.find(row => row.id === event.target.dataset.edit);
    if (item) fillForm(item);
    if (event.target.dataset.delete && confirm("Eliminar jugador?")) await firestore.deleteDoc(firestore.doc(db, "players", event.target.dataset.delete));
  });
  qs("#playerForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = qs("#docId").value || crypto.randomUUID();
    const payload = {
      name: sanitizeText(qs("#name").value, 80),
      position: sanitizeText(qs("#position").value, 40),
      number: Number(qs("#number").value),
      bio: sanitizeText(qs("#bio").value, 800),
      photoUrl: sanitizeText(qs("#photoUrl").value, 500),
      active: true,
      updatedAt: firestore.serverTimestamp()
    };
    await firestore.setDoc(firestore.doc(db, "players", id), payload, { merge: true });
    qs("#playerForm").reset();
    qs("#docId").value = "";
  });
}

function fillForm(item) {
  qs("#docId").value = item.id;
  qs("#name").value = item.name || "";
  qs("#position").value = item.position || "";
  qs("#number").value = item.number || "";
  qs("#bio").value = item.bio || "";
  qs("#photoUrl").value = item.photoUrl || "";
}
