import { requireAdmin, rowTemplate } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";
import { compressImage } from "../compress-image.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "players");
  let docs = [];
  let compressedImage = null;

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("number", "asc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    qs("#itemsList").innerHTML = docs.map(item => rowTemplate(`#${item.number} ${item.name}`, item.position, item.id)).join("");
  });

  qs("#itemsList").addEventListener("click", async event => {
    const item = docs.find(row => row.id === event.target.dataset.edit);
    if (item) fillForm(item);
    if (event.target.dataset.delete && confirm("Eliminar jugador?")) await firestore.deleteDoc(firestore.doc(db, "players", event.target.dataset.delete));
  });

  qs("#photoFile").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    compressedImage = await compressImage(file);
    const preview = qs("#photoPreview");
    preview.src = compressedImage;
    preview.style.display = "block";
    qs("#photoUrl").value = "";
  });

  qs("#photoUrl").addEventListener("input", () => {
    if (qs("#photoUrl").value) {
      compressedImage = null;
      qs("#photoFile").value = "";
      qs("#photoPreview").style.display = "none";
    }
  });

  qs("#playerForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = qs("#docId").value || crypto.randomUUID();
    const payload = {
      name: sanitizeText(qs("#name").value, 80),
      position: sanitizeText(qs("#position").value, 40),
      number: Number(qs("#number").value),
      bio: sanitizeText(qs("#bio").value, 800),
      photoUrl: compressedImage || sanitizeText(qs("#photoUrl").value, 500) || "",
      active: true,
      updatedAt: firestore.serverTimestamp()
    };
    await firestore.setDoc(firestore.doc(db, "players", id), payload, { merge: true });
    qs("#playerForm").reset();
    qs("#docId").value = "";
    compressedImage = null;
    qs("#photoPreview").style.display = "none";
  });
}

function fillForm(item) {
  qs("#docId").value = item.id;
  qs("#name").value = item.name || "";
  qs("#position").value = item.position || "";
  qs("#number").value = item.number || "";
  qs("#bio").value = item.bio || "";
  qs("#photoUrl").value = item.photoUrl || "";
  qs("#photoFile").value = "";
  compressedImage = null;
  const preview = qs("#photoPreview");
  if (item.photoUrl && item.photoUrl.startsWith("data:")) {
    preview.src = item.photoUrl;
    preview.style.display = "block";
  } else {
    preview.style.display = "none";
  }
}
