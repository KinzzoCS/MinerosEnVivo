import { requireAdmin, rowTemplate } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "news");
  const form = qs("#newsForm");
  let docs = [];

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("date", "desc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    qs("#itemsList").innerHTML = docs.map(item => rowTemplate(item.title, item.summary, item.id)).join("");
  });

  qs("#itemsList").addEventListener("click", async event => {
    const editId = event.target.dataset.edit;
    const deleteId = event.target.dataset.delete;
    if (editId) fillForm(docs.find(item => item.id === editId));
    if (deleteId && confirm("Eliminar noticia?")) await firestore.deleteDoc(firestore.doc(db, "news", deleteId));
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const id = qs("#docId").value || slugify(qs("#title").value);
    const payload = {
      title: sanitizeText(qs("#title").value, 120),
      summary: sanitizeText(qs("#summary").value, 240),
      content: sanitizeText(qs("#content").value, 5000),
      imageUrl: sanitizeText(qs("#imageUrl").value, 500),
      featured: qs("#featured").checked,
      date: firestore.serverTimestamp(),
      updatedAt: firestore.serverTimestamp()
    };
    await firestore.setDoc(firestore.doc(db, "news", id), payload, { merge: true });
    form.reset();
    qs("#docId").value = "";
  });
}

function fillForm(item) {
  qs("#docId").value = item.id;
  qs("#title").value = item.title || "";
  qs("#summary").value = item.summary || "";
  qs("#content").value = item.content || "";
  qs("#imageUrl").value = item.imageUrl || "";
  qs("#featured").checked = Boolean(item.featured);
}

function slugify(value) {
  return sanitizeText(value, 90).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || String(Date.now());
}
