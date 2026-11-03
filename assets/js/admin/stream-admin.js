// Transmisiones (spec 004): lista de medios de YouTube. En la app solo aparecen los que están en vivo.
import { confirmDelete, editingState, emptyRowHtml, errorText, formSport, notify, requireAdmin, rowHtml, setSport, showSportField, sportTag, toggleSportFields, watchSportsConfig } from "./admin-common.js";
import { qs, sanitizeAttr, sanitizeText, youtubeEmbedUrl } from "../utils.js";
import { isSportActive, sportsConfig } from "../sports.js";
import { legacyStreams, normalizeStream, sortStreams } from "../streams.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "streams");
  const form = qs("#streamForm");
  let streams = [];
  let config = sportsConfig(null);
  let imported = false;
  let orderTouched = false;

  const editing = editingState(form, { onCancel: resetForm });

  watchSportsConfig(firebase, next => {
    config = next;
    toggleSportFields(config);
    render();
  });

  // Valida al momento que el enlace sea de YouTube (CA-03)
  const checkUrl = () => {
    const value = qs("#streamUrl").value.trim();
    const hint = qs("#urlHint");
    if (!value) {
      hint.textContent = "Pega el enlace del video o del canal en vivo de YouTube.";
      hint.className = "";
    } else if (youtubeEmbedUrl(value)) {
      hint.textContent = "Enlace de YouTube válido.";
      hint.className = "ok";
    } else {
      hint.textContent = "Este enlace no es de un video de YouTube. Revisa que esté completo.";
      hint.className = "mal";
    }
  };
  qs("#streamUrl").addEventListener("input", checkUrl);
  qs("#streamOrder").addEventListener("input", () => { orderTouched = true; });
  // Propone el siguiente número de orden para un medio nuevo
  const proposeOrder = () => {
    if (!qs("#streamDocId").value && !orderTouched) qs("#streamOrder").value = String(Math.max(0, ...streams.map(s => s.order)) + 1);
  };
  checkUrl();

  firestore.onSnapshot(col, async snap => {
    streams = sortStreams(snap.docs.map(d => normalizeStream({ id: d.id, ...d.data() })));
    if (snap.empty && !imported) await importLegacy();
    render();
    proposeOrder();
  });

  // La primera vez copia las dos transmisiones de settings/main con sus ids "1" y "2" (CA-04)
  async function importLegacy() {
    imported = true;
    try {
      const legacy = legacyStreams((await firestore.getDoc(firestore.doc(db, "settings", "main"))).data());
      if (!legacy.length) return;
      await Promise.all(legacy.map(s => firestore.setDoc(firestore.doc(db, "streams", s.id), {
        name: s.name, title: s.title, url: s.url, live: s.live, sport: s.sport, order: s.order,
        updatedAt: firestore.serverTimestamp()
      })));
      notify("#formNote", `Se importaron las ${legacy.length} transmisiones que ya tenías. Ahora puedes agregar más.`);
    } catch (error) {
      notify("#formNote", `No se pudieron importar las transmisiones actuales: ${errorText(error)}`, "error");
    }
  }

  function render() {
    qs("#streamsList").innerHTML = streams.length ? streams.map(s => {
      const hidden = s.live && !isSportActive(config, s.sport);
      const state = s.live ? '<span class="pastilla pastilla-vivo">En vivo</span>' : '<span class="etiqueta">Apagada: no aparece en la app</span>';
      const warning = hidden ? '<span class="etiqueta">Su deporte está apagado</span>' : "";
      return rowHtml({
        id: s.id,
        title: s.name,
        subtitle: `${s.title || "Sin título"}. Orden ${s.order}${youtubeEmbedUrl(s.url) ? "" : ". Falta un enlace válido"}`,
        tags: [state, warning, ...(showSportField(config) ? [sportTag(s.sport)] : [])].filter(Boolean),
        actions: `
          <button class="boton ${s.live ? "boton-borde" : "boton-rojo"} boton-chico" type="button" data-toggle="${sanitizeAttr(s.id, 80)}">${s.live ? "Quitar del vivo" : "Poner en vivo"}</button>
          <button class="boton boton-borde boton-chico" type="button" data-edit="${sanitizeAttr(s.id, 80)}">Editar</button>
          <button class="boton boton-peligro boton-chico" type="button" data-delete="${sanitizeAttr(s.id, 80)}">Borrar</button>`
      });
    }).join("") : emptyRowHtml("Todavía no hay transmisiones. Agrega la primera con el formulario de arriba.");
  }

  qs("#streamsList").addEventListener("click", async event => {
    const toggleId = event.target.closest("[data-toggle]")?.dataset.toggle;
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
    const stream = streams.find(s => s.id === (toggleId || editId || deleteId));
    if (!stream) return;
    try {
      if (toggleId) {
        if (!stream.live && !youtubeEmbedUrl(stream.url)) {
          notify("#formNote", `${stream.name} no tiene un enlace de YouTube válido. Edítala antes de ponerla en vivo.`, "error");
          return;
        }
        await firestore.updateDoc(firestore.doc(db, "streams", stream.id), { live: !stream.live, updatedAt: firestore.serverTimestamp() });
        notify("#formNote", stream.live ? `${stream.name} ya no aparece en la app.` : `${stream.name} está en vivo en la app.`);
      }
      if (editId) fillForm(stream);
      if (deleteId) {
        if (!confirmDelete(`la transmisión ${stream.name}`)) return;
        await firestore.deleteDoc(firestore.doc(db, "streams", stream.id));
        notify("#formNote", "Transmisión borrada.");
      }
    } catch (error) {
      notify("#formNote", `No se pudo completar: ${errorText(error)}`, "error");
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const url = qs("#streamUrl").value.trim();
    if (!youtubeEmbedUrl(url)) {
      notify("#formNote", "El enlace no es de YouTube. Corrígelo para guardar.", "error");
      qs("#streamUrl").focus();
      return;
    }
    const existing = qs("#streamDocId").value;
    const name = sanitizeText(qs("#streamName").value, 60);
    const id = existing || slugify(name);
    try {
      await firestore.setDoc(firestore.doc(db, "streams", id), {
        name,
        title: sanitizeText(qs("#streamTitle").value, 100),
        url: sanitizeText(url, 400),
        live: qs("#streamLive").checked,
        sport: formSport(form, config),
        order: Math.trunc(Number(qs("#streamOrder").value) || 0),
        updatedAt: firestore.serverTimestamp()
      }, { merge: true });
      notify("#formNote", existing ? "Cambios guardados." : `${name} agregada.${qs("#streamLive").checked ? " Ya está en vivo en la app." : ""}`);
      resetForm();
    } catch (error) {
      notify("#formNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  function fillForm(stream) {
    qs("#streamDocId").value = stream.id;
    qs("#streamName").value = stream.name;
    qs("#streamTitle").value = stream.title;
    qs("#streamUrl").value = stream.url;
    qs("#streamOrder").value = stream.order;
    qs("#streamLive").checked = stream.live;
    setSport(form, stream.sport);
    checkUrl();
    qs("#submitBtn").textContent = "Guardar cambios";
    editing.start(`Editando: ${stream.name}`);
  }

  function resetForm() {
    form.reset();
    qs("#streamDocId").value = "";
    orderTouched = false;
    proposeOrder();
    toggleSportFields(config);
    checkUrl();
    qs("#submitBtn").textContent = "Agregar transmisión";
    editing.stop();
  }

  resetForm();
}

function slugify(value) {
  const base = sanitizeText(value, 60).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${base || "transmision"}-${Date.now().toString(36)}`;
}
