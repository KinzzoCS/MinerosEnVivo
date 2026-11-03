import { confirmDelete, editingState, emptyRowHtml, errorText, formSport, imageField, mountListFilter, notify, readSport, requireAdmin, rowHtml, setSport, showSportField, sportTag, toggleSportFields, watchSportsConfig } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";
import { sportOf, sportsConfig } from "../sports.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "players");
  const form = qs("#playerForm");
  let docs = [];
  let config = sportsConfig(null);
  let filter = "todos";

  const photo = imageField({ file: qs("#photoFile"), url: qs("#photoUrl"), preview: qs("#photoPreview"), clear: qs("#photoClear"), maxW: 600 });
  const editing = editingState(form, { onCancel: resetForm });

  watchSportsConfig(firebase, next => {
    config = next;
    toggleSportFields(config);
    filter = mountListFilter(qs("#listFilter"), config, value => { filter = value; render(); });
    render();
  });

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("number", "asc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  function render() {
    const visible = docs.filter(d => filter === "todos" || sportOf(d) === filter);
    qs("#itemsList").innerHTML = visible.length ? visible.map(item => rowHtml({
      id: item.id,
      title: `#${Number(item.number || 0)} ${item.name || ""}`,
      subtitle: item.position,
      tags: showSportField(config) ? [sportTag(sportOf(item))] : []
    })).join("") : emptyRowHtml("No hay jugadores registrados.");
  }

  qs("#itemsList").addEventListener("click", async event => {
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
    if (editId) fillForm(docs.find(item => item.id === editId));
    if (deleteId) {
      const item = docs.find(row => row.id === deleteId);
      if (!confirmDelete(`a ${item?.name || "este jugador"}`)) return;
      try {
        await firestore.deleteDoc(firestore.doc(db, "players", deleteId));
        notify("#formNote", "Jugador borrado.");
      } catch (error) {
        notify("#formNote", `No se pudo borrar: ${errorText(error)}`, "error");
      }
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const id = qs("#docId").value || crypto.randomUUID();
    const isNew = !qs("#docId").value;
    try {
      await firestore.setDoc(firestore.doc(db, "players", id), {
        sport: formSport(form, config),
        name: sanitizeText(qs("#name").value, 80),
        position: sanitizeText(qs("#position").value, 40),
        number: Math.max(0, Math.trunc(Number(qs("#number").value))),
        bio: sanitizeText(qs("#bio").value, 800),
        photoUrl: photo.value(),
        active: true,
        updatedAt: firestore.serverTimestamp()
      }, { merge: true });
      notify("#formNote", isNew ? "Jugador agregado." : "Cambios guardados.");
      resetForm();
    } catch (error) {
      notify("#formNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  function fillForm(item) {
    if (!item) return;
    qs("#docId").value = item.id;
    setSport(form, sportOf(item));
    qs("#name").value = item.name || "";
    qs("#position").value = item.position || "";
    qs("#number").value = item.number ?? "";
    qs("#bio").value = item.bio || "";
    photo.set(item.photoUrl || "");
    qs("#submitBtn").textContent = "Guardar cambios";
    editing.start(`Editando: ${item.name}`);
  }

  function resetForm() {
    form.reset();
    qs("#docId").value = "";
    photo.reset();
    qs("#submitBtn").textContent = "Agregar jugador";
    editing.stop();
  }
}
