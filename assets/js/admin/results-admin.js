import { requireAdmin, rowTemplate } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "results");
  let docs = [];

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("date", "desc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    qs("#resultsList").innerHTML = docs.map(item => {
      const title = `${sanitizeText(item.home, 40)} ${Number(item.homeScore || 0)} - ${Number(item.awayScore || 0)} ${sanitizeText(item.away, 40)}`;
      return rowTemplate(title, `${item.date}`, item.id);
    }).join("");
  });

  qs("#resultsList").addEventListener("click", async event => {
    const item = docs.find(row => row.id === event.target.dataset.edit);
    if (item) fillResult(item);
    if (event.target.dataset.delete && confirm("Eliminar resultado?")) {
      await firestore.deleteDoc(firestore.doc(db, "results", event.target.dataset.delete));
    }
  });

  qs("#resultForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = qs("#resultDocId").value || crypto.randomUUID();
    await firestore.setDoc(firestore.doc(db, "results", id), {
      home: sanitizeText(qs("#home").value, 40),
      away: sanitizeText(qs("#away").value, 40),
      homeScore: Number(qs("#homeScore").value),
      awayScore: Number(qs("#awayScore").value),
      date: qs("#resultDate").value,
      updatedAt: firestore.serverTimestamp()
    }, { merge: true });
    qs("#resultForm").reset();
    qs("#resultDocId").value = "";
  });
}

function fillResult(item) {
  qs("#resultDocId").value = item.id;
  qs("#home").value = item.home || "Mineros";
  qs("#away").value = item.away || "";
  qs("#homeScore").value = item.homeScore ?? 0;
  qs("#awayScore").value = item.awayScore ?? 0;
  qs("#resultDate").value = item.date || "";
}
