import { requireAdmin, rowTemplate } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "matches");
  let docs = [];
  firestore.onSnapshot(firestore.query(col, firestore.orderBy("date", "asc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    qs("#itemsList").innerHTML = docs.map(item => rowTemplate(`Mineros vs ${item.rival}`, `${item.date} · ${item.time} · ${item.stadium}`, item.id)).join("");
  });
  qs("#itemsList").addEventListener("click", async event => {
    const item = docs.find(row => row.id === event.target.dataset.edit);
    if (item) fillMatch(item);
    if (event.target.dataset.delete && confirm("Eliminar partido?")) await firestore.deleteDoc(firestore.doc(db, "matches", event.target.dataset.delete));
  });
  qs("#matchForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = qs("#docId").value || crypto.randomUUID();
    await firestore.setDoc(firestore.doc(db, "matches", id), {
      rival: sanitizeText(qs("#rival").value, 60),
      date: qs("#date").value,
      time: qs("#time").value,
      stadium: sanitizeText(qs("#stadium").value, 80),
      tournament: sanitizeText(qs("#tournament").value, 80),
      updatedAt: firestore.serverTimestamp()
    }, { merge: true });
    qs("#matchForm").reset();
    qs("#docId").value = "";
  });
  qs("#resultForm").addEventListener("submit", async event => {
    event.preventDefault();
    await firestore.addDoc(firestore.collection(db, "results"), {
      home: sanitizeText(qs("#home").value, 40),
      away: sanitizeText(qs("#away").value, 40),
      homeScore: Number(qs("#homeScore").value),
      awayScore: Number(qs("#awayScore").value),
      date: qs("#resultDate").value,
      createdAt: firestore.serverTimestamp()
    });
    qs("#resultForm").reset();
  });
}

function fillMatch(item) {
  qs("#docId").value = item.id;
  qs("#rival").value = item.rival || "";
  qs("#date").value = item.date || "";
  qs("#time").value = item.time || "";
  qs("#stadium").value = item.stadium || "";
  qs("#tournament").value = item.tournament || "";
}
