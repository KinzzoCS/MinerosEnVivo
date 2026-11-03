import { fillSeasonSelect, watchSeasons, confirmDelete, editingState, emptyRowHtml, errorText, formSport, mountListFilter, notify, readSport, requireAdmin, rowHtml, setSport, showSportField, sportTag, toggleSportFields, watchSportsConfig } from "./admin-common.js";
import { formatDate, formatTime, qs, sanitizeText } from "../utils.js";
import { matchTitle } from "../components.js";
import { sportOf, sportsConfig } from "../sports.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "matches");
  const form = qs("#matchForm");
  let docs = [];
  let config = sportsConfig(null);
  let filter = "todos";
  let seasonIndex = new Map();

  const editing = editingState(form, { onCancel: resetForm });

  watchSportsConfig(firebase, next => {
    config = next;
    toggleSportFields(config);
    if (!qs("#docId").value) fillSeasonSelect(qs("#seasonId"), seasonIndex, formSport(form, config));
    filter = mountListFilter(qs("#listFilter"), config, value => { filter = value; render(); });
    render();
  });

  watchSeasons(firebase, index => {
    seasonIndex = index;
    if (!qs("#docId").value) fillSeasonSelect(qs("#seasonId"), seasonIndex, formSport(form, config));
    render();
  });
  form.addEventListener("change", event => {
    if (event.target.name === "sport") fillSeasonSelect(qs("#seasonId"), seasonIndex, formSport(form, config));
  });

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("date", "asc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  function render() {
    const visible = docs.filter(d => filter === "todos" || sportOf(d) === filter);
    qs("#itemsList").innerHTML = visible.length ? visible.map(item => rowHtml({
      id: item.id,
      title: matchTitle(item, config),
      subtitle: `${formatDate(item.date, { dateStyle: "full" })}, ${formatTime(item.time)}. ${sanitizeText(item.stadium || "Lugar por definir", 60)}. ${seasonIndex.get(item.seasonId)?.label || sanitizeText(item.tournament, 60) || "Sin temporada"}`,
      tags: showSportField(config) ? [sportTag(sportOf(item))] : []
    })).join("") : emptyRowHtml("No hay juegos en el calendario. Agrega el primero con el formulario de arriba.");
  }

  qs("#itemsList").addEventListener("click", async event => {
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
    if (editId) fillForm(docs.find(item => item.id === editId));
    if (deleteId) {
      const item = docs.find(row => row.id === deleteId);
      if (!confirmDelete(`el juego ${matchTitle(item || {}, config)}`)) return;
      try {
        await firestore.deleteDoc(firestore.doc(db, "matches", deleteId));
        notify("#formNote", "Juego borrado.");
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
      await firestore.setDoc(firestore.doc(db, "matches", id), {
        sport: formSport(form, config),
        rival: sanitizeText(qs("#rival").value, 60),
        date: qs("#date").value,
        time: qs("#time").value,
        stadium: sanitizeText(qs("#stadium").value, 80),
        seasonId: qs("#seasonId").value || firestore.deleteField(),
        minerIsAway: qs("#isAway").checked,
        updatedAt: firestore.serverTimestamp()
      }, { merge: true });
      notify("#formNote", isNew ? "Juego agregado al calendario." : "Cambios guardados.");
      resetForm();
    } catch (error) {
      notify("#formNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  function fillForm(item) {
    if (!item) return;
    qs("#docId").value = item.id;
    setSport(form, sportOf(item));
    qs("#rival").value = item.rival || "";
    qs("#date").value = item.date || "";
    qs("#time").value = item.time || "";
    qs("#stadium").value = item.stadium || "";
    fillSeasonSelect(qs("#seasonId"), seasonIndex, sportOf(item), item.seasonId || "");
    qs("#isAway").checked = Boolean(item.minerIsAway);
    qs("#submitBtn").textContent = "Guardar cambios";
    editing.start(`Editando: ${matchTitle(item, config)}`);
  }

  function resetForm() {
    form.reset();
    qs("#docId").value = "";
    toggleSportFields(config);
    fillSeasonSelect(qs("#seasonId"), seasonIndex, formSport(form, config), undefined);
    qs("#submitBtn").textContent = "Agregar juego";
    editing.stop();
  }
}
