import { confirmDelete, editingState, emptyRowHtml, errorText, imageField, mountListFilter, notify, requireAdmin, rowHtml, showSportField, sportTag, toggleSportFields, watchSportsConfig } from "./admin-common.js";
import { formatDate, qs, sanitizeText } from "../utils.js";
import { defaultSport, newsSports, SPORTS, sportsConfig } from "../sports.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "news");
  const form = qs("#newsForm");
  let docs = [];
  let config = sportsConfig(null);
  let filter = "todos";

  const image = imageField({ file: qs("#imageFile"), url: qs("#imageUrl"), preview: qs("#imagePreview"), clear: qs("#imageClear"), maxW: 1000 });
  const editing = editingState(form, { onCancel: resetForm });

  watchSportsConfig(firebase, next => {
    config = next;
    toggleSportFields(config);
    filter = mountListFilter(qs("#listFilter"), config, value => { filter = value; render(); });
    render();
  });

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("date", "desc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  function render() {
    const visible = docs.filter(d => filter === "todos" || newsSports(d).includes(filter));
    qs("#itemsList").innerHTML = visible.length ? visible.map(item => rowHtml({
      id: item.id,
      title: item.title,
      subtitle: `${formatDate(item.date, { dateStyle: "long" })}${item.featured ? ". Destacada" : ""}`,
      tags: showSportField(config) ? newsSports(item).map(sportTag) : []
    })).join("") : emptyRowHtml("No hay noticias publicadas.");
  }

  qs("#itemsList").addEventListener("click", async event => {
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
    if (editId) fillForm(docs.find(item => item.id === editId));
    if (deleteId) {
      const item = docs.find(row => row.id === deleteId);
      if (!confirmDelete(`la noticia "${item?.title || ""}"`)) return;
      try {
        await firestore.deleteDoc(firestore.doc(db, "news", deleteId));
        notify("#formNote", "Noticia borrada.");
      } catch (error) {
        notify("#formNote", `No se pudo borrar: ${errorText(error)}`, "error");
      }
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const sports = showSportField(config)
      ? SPORTS.filter(sport => qs(`#sport-${sport}`).checked)
      : [defaultSport(config)];
    if (!sports.length) {
      notify("#formNote", "Elige al menos un deporte para la noticia.", "error");
      return;
    }
    const existingId = qs("#docId").value;
    const id = existingId || slugify(qs("#title").value);
    const payload = {
      sports,
      title: sanitizeText(qs("#title").value, 120),
      summary: sanitizeText(qs("#summary").value, 240),
      content: String(qs("#content").value || "").replace(/[<>]/g, "").slice(0, 5000),
      imageUrl: image.value(),
      featured: qs("#featured").checked,
      updatedAt: firestore.serverTimestamp()
    };
    // La fecha de publicación solo se pone al crear; editar no la cambia
    if (!existingId) payload.date = firestore.serverTimestamp();
    try {
      await firestore.setDoc(firestore.doc(db, "news", id), payload, { merge: true });
      notify("#formNote", existingId ? "Cambios guardados." : "Noticia publicada.");
      resetForm();
    } catch (error) {
      notify("#formNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  function fillForm(item) {
    if (!item) return;
    qs("#docId").value = item.id;
    const sports = newsSports(item);
    SPORTS.forEach(sport => { qs(`#sport-${sport}`).checked = sports.includes(sport); });
    qs("#title").value = item.title || "";
    qs("#summary").value = item.summary || "";
    qs("#content").value = item.content || "";
    qs("#featured").checked = Boolean(item.featured);
    image.set(item.imageUrl || "");
    qs("#submitBtn").textContent = "Guardar cambios";
    editing.start(`Editando: ${item.title}`);
  }

  function resetForm() {
    form.reset();
    qs("#docId").value = "";
    image.reset();
    qs("#submitBtn").textContent = "Publicar noticia";
    editing.stop();
  }
}

function slugify(value) {
  return sanitizeText(value, 90).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || String(Date.now());
}
