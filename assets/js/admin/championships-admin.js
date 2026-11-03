// Campeonatos y temporadas (spec 003, CA-14). Un campeonato tiene nombre, deporte y logo;
// sus temporadas tienen nombre, fechas y logo opcional (sin logo usan el del campeonato).
import { confirmDelete, editingState, emptyRowHtml, errorText, formSport, imageField, notify, readSport, requireAdmin, rowHtml, setSport, showSportField, sportTag, toggleSportFields, watchSeasons, watchSportsConfig } from "./admin-common.js";
import { formatDate, qs, sanitizeAttr, sanitizeText } from "../utils.js";
import { SPORT_LABELS, sportOf, sportsConfig } from "../sports.js";
import { currentSeasonId } from "../seasons.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const champForm = qs("#championshipForm");
  const seasonForm = qs("#seasonForm");
  let config = sportsConfig(null);
  let championships = [];
  let seasons = [];
  let index = new Map();

  const champLogo = imageField({ file: qs("#champLogoFile"), url: qs("#champLogoUrl"), preview: qs("#champLogoPreview"), clear: qs("#champLogoClear"), maxW: 256, mime: "image/png", quality: 0.92 });
  const seasonLogo = imageField({ file: qs("#seasonLogoFile"), url: qs("#seasonLogoUrl"), preview: qs("#seasonLogoPreview"), clear: qs("#seasonLogoClear"), maxW: 256, mime: "image/png", quality: 0.92 });
  const champEditing = editingState(champForm, { onCancel: resetChampionship });
  const seasonEditing = editingState(seasonForm, { onCancel: resetSeason });

  watchSportsConfig(firebase, next => {
    config = next;
    toggleSportFields(config);
    render();
  });

  watchSeasons(firebase, (nextIndex, nextChampionships, nextSeasons) => {
    index = nextIndex;
    championships = nextChampionships;
    seasons = nextSeasons;
    fillChampionshipSelect();
    render();
  });

  function fillChampionshipSelect() {
    const select = qs("#seasonChampionship");
    const current = select.value;
    select.innerHTML = championships.length
      ? championships.map(c => `<option value="${sanitizeAttr(c.id, 80)}">${sanitizeText(c.name, 80)} (${SPORT_LABELS[sportOf(c)]})</option>`).join("")
      : `<option value="">Primero agrega un campeonato</option>`;
    if (championships.some(c => c.id === current)) select.value = current;
  }

  function render() {
    qs("#championshipsList").innerHTML = championships.length ? championships.map(c => {
      const count = seasons.filter(s => s.championshipId === c.id).length;
      return rowHtml({
        id: c.id,
        title: c.name,
        subtitle: count === 1 ? "1 temporada" : `${count} temporadas`,
        tags: showSportField(config) ? [sportTag(sportOf(c))] : []
      });
    }).join("") : emptyRowHtml("Todavía no hay campeonatos. Agrega el primero, por ejemplo: Estatal Chihuahua.");

    const currentIds = new Set(["beisbol", "basquetbol"].map(sport => currentSeasonId(index, sport)).filter(Boolean));
    const sorted = [...seasons].sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));
    qs("#seasonsList").innerHTML = sorted.length ? sorted.map(s => rowHtml({
      id: s.id,
      title: index.get(s.id)?.label || s.name,
      subtitle: `${formatDate(s.startDate, { dateStyle: "medium" })} al ${formatDate(s.endDate, { dateStyle: "medium" })}`,
      tags: [
        ...(currentIds.has(s.id) ? ['<span class="etiqueta etiqueta-local">Temporada actual</span>'] : []),
        ...(showSportField(config) ? [sportTag(sportOf(s))] : [])
      ]
    }).replace(/data-edit=/g, "data-edit-season=").replace(/data-delete=/g, "data-delete-season=")).join("")
      : emptyRowHtml("Todavía no hay temporadas.");
  }

  // ── Campeonatos ─────────────────────────────────────────────
  champForm.addEventListener("submit", async event => {
    event.preventDefault();
    const existing = qs("#champId").value;
    const sport = formSport(champForm, config);
    const id = existing || slugify(`${qs("#champName").value}-${sport}`);
    try {
      await firestore.setDoc(firestore.doc(db, "championships", id), {
        name: sanitizeText(qs("#champName").value, 80),
        sport,
        logo: champLogo.value(),
        updatedAt: firestore.serverTimestamp()
      }, { merge: true });
      // Las temporadas copian el deporte del campeonato: si cambió, se actualizan
      if (existing) {
        await Promise.all(seasons.filter(s => s.championshipId === id && s.sport !== sport)
          .map(s => firestore.updateDoc(firestore.doc(db, "seasons", s.id), { sport })));
      }
      notify("#champNote", existing ? "Campeonato actualizado." : "Campeonato agregado. Ahora agrégale una temporada.");
      resetChampionship();
    } catch (error) {
      notify("#champNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  qs("#championshipsList").addEventListener("click", async event => {
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
    if (editId) {
      const c = championships.find(item => item.id === editId);
      if (!c) return;
      qs("#champId").value = c.id;
      setSport(champForm, sportOf(c));
      qs("#champName").value = c.name || "";
      champLogo.set(c.logo || "");
      qs("#champSubmit").textContent = "Guardar cambios";
      champEditing.start(`Editando: ${c.name}`);
    }
    if (deleteId) {
      const c = championships.find(item => item.id === deleteId);
      const count = seasons.filter(s => s.championshipId === deleteId).length;
      if (count) {
        notify("#champNote", `Primero borra las ${count === 1 ? "temporada" : `${count} temporadas`} de ${c?.name || "este campeonato"}.`, "error");
        return;
      }
      if (!confirmDelete(`el campeonato ${c?.name || ""}`)) return;
      try {
        await firestore.deleteDoc(firestore.doc(db, "championships", deleteId));
        notify("#champNote", "Campeonato borrado.");
      } catch (error) {
        notify("#champNote", `No se pudo borrar: ${errorText(error)}`, "error");
      }
    }
  });

  function resetChampionship() {
    champForm.reset();
    qs("#champId").value = "";
    toggleSportFields(config);
    champLogo.reset();
    qs("#champSubmit").textContent = "Agregar campeonato";
    champEditing.stop();
  }

  // ── Temporadas ──────────────────────────────────────────────
  seasonForm.addEventListener("submit", async event => {
    event.preventDefault();
    const championship = championships.find(c => c.id === qs("#seasonChampionship").value);
    if (!championship) {
      notify("#seasonNote", "Elige el campeonato de la temporada. Si no hay, agrégalo arriba.", "error");
      return;
    }
    const start = qs("#seasonStart").value;
    const end = qs("#seasonEnd").value;
    if (start && end && end < start) {
      notify("#seasonNote", "La fecha de fin debe ser igual o posterior a la de inicio.", "error");
      return;
    }
    const existing = qs("#seasonDocId").value;
    const name = sanitizeText(qs("#seasonName").value, 40);
    const id = existing || slugify(`${championship.id}-${name}`);
    try {
      await firestore.setDoc(firestore.doc(db, "seasons", id), {
        championshipId: championship.id,
        sport: sportOf(championship),
        name,
        startDate: start,
        endDate: end,
        logo: seasonLogo.value(),
        updatedAt: firestore.serverTimestamp()
      }, { merge: true });
      notify("#seasonNote", existing ? "Temporada actualizada." : "Temporada agregada. Ya puedes ligarle juegos y resultados.");
      resetSeason();
    } catch (error) {
      notify("#seasonNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  qs("#seasonsList").addEventListener("click", async event => {
    const editId = event.target.closest("[data-edit-season]")?.dataset.editSeason;
    const deleteId = event.target.closest("[data-delete-season]")?.dataset.deleteSeason;
    if (editId) {
      const s = seasons.find(item => item.id === editId);
      if (!s) return;
      qs("#seasonDocId").value = s.id;
      qs("#seasonChampionship").value = s.championshipId;
      qs("#seasonName").value = s.name || "";
      qs("#seasonStart").value = s.startDate || "";
      qs("#seasonEnd").value = s.endDate || "";
      seasonLogo.set(s.logo || "");
      qs("#seasonSubmit").textContent = "Guardar cambios";
      seasonEditing.start(`Editando: ${index.get(s.id)?.label || s.name}`);
    }
    if (deleteId) {
      const label = index.get(deleteId)?.label || "esta temporada";
      if (!confirm(`¿Borrar la temporada ${label}? Sus juegos y resultados quedarán como "Sin temporada". Esto no se puede deshacer.`)) return;
      try {
        await firestore.deleteDoc(firestore.doc(db, "seasons", deleteId));
        notify("#seasonNote", "Temporada borrada.");
      } catch (error) {
        notify("#seasonNote", `No se pudo borrar: ${errorText(error)}`, "error");
      }
    }
  });

  function resetSeason() {
    seasonForm.reset();
    qs("#seasonDocId").value = "";
    seasonLogo.reset();
    fillChampionshipSelect();
    qs("#seasonSubmit").textContent = "Agregar temporada";
    seasonEditing.stop();
  }
}

function slugify(value) {
  return sanitizeText(value, 90).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || String(Date.now());
}
