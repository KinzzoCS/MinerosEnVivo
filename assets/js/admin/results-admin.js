// Resultados. Béisbol: carreras (la línea por entrada llega desde la pizarra).
// Básquetbol: puntos por cuarto con tiempos extra; el total se calcula solo (spec 001, CA-14).
import { fillSeasonSelect, watchSeasons, confirmDelete, editingState, emptyRowHtml, errorText, formSport, mountListFilter, notify, readSport, requireAdmin, rowHtml, setSport, showSportField, sportTag, todayIso, toggleSportFields, watchSportsConfig } from "./admin-common.js";
import { formatDate, qs, sanitizeText } from "../utils.js";
import { sportOf, sportsConfig } from "../sports.js";

const firebase = await requireAdmin();
if (firebase) init(firebase);

function init(firebase) {
  const { db, firestore } = firebase;
  const col = firestore.collection(db, "results");
  const form = qs("#resultForm");
  let docs = [];
  let config = sportsConfig(null);
  let filter = "todos";
  let periods = 4;
  let seasonIndex = new Map();

  const editing = editingState(form, { onCancel: resetForm });

  watchSportsConfig(firebase, next => {
    config = next;
    toggleSportFields(config);
    filter = mountListFilter(qs("#listFilter"), config, value => { filter = value; render(); });
    if (!qs("#resultDocId").value) {
      applySport(readSport(form), true);
      fillSeasonSelect(qs("#seasonId"), seasonIndex, readSport(form));
    }
    render();
  });

  watchSeasons(firebase, index => {
    seasonIndex = index;
    if (!qs("#resultDocId").value) fillSeasonSelect(qs("#seasonId"), seasonIndex, formSport(form, config));
    render();
  });

  firestore.onSnapshot(firestore.query(col, firestore.orderBy("date", "desc")), snap => {
    docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });

  form.addEventListener("change", event => {
    if (event.target.name === "sport") {
      applySport(readSport(form), true);
      fillSeasonSelect(qs("#seasonId"), seasonIndex, readSport(form));
    }
  });
  qs("#cuartos").addEventListener("input", updateTotals);
  qs("#addOvertime").addEventListener("click", () => { periods += 1; buildPeriods(); });
  qs("#removeOvertime").addEventListener("click", () => { periods = Math.max(4, periods - 1); buildPeriods(); });

  function applySport(sport, fillTeams) {
    const basket = sport === "basquetbol";
    qs("#camposBeisbol").hidden = basket;
    qs("#camposBasquet").hidden = !basket;
    qs("#homeScore").required = !basket;
    qs("#awayScore").required = !basket;
    if (fillTeams && !qs("#home").value) qs("#home").value = config[sport].equipo;
    buildPeriods();
  }

  function buildPeriods(values = null) {
    const away = values?.away ?? readPeriods("away");
    const home = values?.home ?? readPeriods("home");
    const head = Array.from({ length: periods }, (_, i) => `<th scope="col">${i < 4 ? `${i + 1}.º` : periods === 5 ? "TE" : `TE${i - 3}`}</th>`).join("");
    const inputs = (team, list) => Array.from({ length: periods }, (_, i) =>
      `<td><input type="number" inputmode="numeric" min="0" max="200" data-team="${team}" data-period="${i}" value="${Number.isFinite(list[i]) ? list[i] : ""}" aria-label="${team === "home" ? "Local" : "Visitante"}, ${i < 4 ? `cuarto ${i + 1}` : `tiempo extra ${i - 3}`}"></td>`).join("");
    qs("#cuartos").innerHTML = `
      <table>
        <thead><tr><th scope="col">Equipo</th>${head}<th scope="col">Total</th></tr></thead>
        <tbody>
          <tr><th scope="row" data-nombre="away">Visitante</th>${inputs("away", away)}<td class="total-cuartos" data-total="away">0</td></tr>
          <tr><th scope="row" data-nombre="home">Local</th>${inputs("home", home)}<td class="total-cuartos" data-total="home">0</td></tr>
        </tbody>
      </table>`;
    qs("#removeOvertime").hidden = periods <= 4;
    updateTotals();
  }

  function readPeriods(team) {
    return [...document.querySelectorAll(`#cuartos input[data-team="${team}"]`)].map(input => (input.value === "" ? null : Math.max(0, Math.trunc(Number(input.value)))));
  }

  function updateTotals() {
    for (const team of ["away", "home"]) {
      const total = readPeriods(team).reduce((sum, v) => sum + (v || 0), 0);
      const cell = qs(`[data-total="${team}"]`);
      if (cell) cell.textContent = String(total);
    }
    const awayName = sanitizeText(qs("#away").value, 20) || "Visitante";
    const homeName = sanitizeText(qs("#home").value, 20) || "Local";
    const awayCell = qs('[data-nombre="away"]');
    const homeCell = qs('[data-nombre="home"]');
    if (awayCell) awayCell.textContent = awayName;
    if (homeCell) homeCell.textContent = homeName;
  }
  qs("#away").addEventListener("input", updateTotals);
  qs("#home").addEventListener("input", updateTotals);

  function render() {
    const visible = docs.filter(d => filter === "todos" || sportOf(d) === filter);
    qs("#resultsList").innerHTML = visible.length ? visible.map(item => rowHtml({
      id: item.id,
      title: `${sanitizeText(item.away, 40)} ${Number(item.awayScore || 0)}, ${sanitizeText(item.home, 40)} ${Number(item.homeScore || 0)}`,
      subtitle: `${formatDate(item.date, { dateStyle: "long" })}. ${seasonIndex.get(item.seasonId)?.label || "Sin temporada"}${item.source === "pizarra" ? ". Guardado desde la pizarra" : ""}`,
      tags: showSportField(config) ? [sportTag(sportOf(item))] : []
    })).join("") : emptyRowHtml("Todavía no hay resultados.");
  }

  qs("#resultsList").addEventListener("click", async event => {
    const editId = event.target.closest("[data-edit]")?.dataset.edit;
    const deleteId = event.target.closest("[data-delete]")?.dataset.delete;
    if (editId) fillForm(docs.find(item => item.id === editId));
    if (deleteId) {
      const item = docs.find(row => row.id === deleteId);
      if (!confirmDelete(`el resultado ${item ? `${item.away} vs ${item.home}` : ""}`)) return;
      try {
        await firestore.deleteDoc(firestore.doc(db, "results", deleteId));
        notify("#formNote", "Resultado borrado.");
      } catch (error) {
        notify("#formNote", `No se pudo borrar: ${errorText(error)}`, "error");
      }
    }
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const sport = formSport(form, config);
    const id = qs("#resultDocId").value || crypto.randomUUID();
    const isNew = !qs("#resultDocId").value;
    const payload = {
      sport,
      home: sanitizeText(qs("#home").value, 40),
      away: sanitizeText(qs("#away").value, 40),
      date: qs("#resultDate").value,
      seasonId: qs("#seasonId").value || firestore.deleteField(),
      updatedAt: firestore.serverTimestamp()
    };
    if (sport === "basquetbol") {
      const trim = list => { const copy = [...list]; while (copy.length > 4 && copy[copy.length - 1] === null) copy.pop(); return copy; };
      payload.awayPeriods = trim(readPeriods("away"));
      payload.homePeriods = trim(readPeriods("home"));
      if (![...payload.awayPeriods, ...payload.homePeriods].some(v => v !== null)) {
        notify("#formNote", "Captura los puntos de al menos un cuarto.", "error");
        return;
      }
      payload.awayScore = payload.awayPeriods.reduce((s, v) => s + (v || 0), 0);
      payload.homeScore = payload.homePeriods.reduce((s, v) => s + (v || 0), 0);
    } else {
      payload.homeScore = Math.max(0, Math.trunc(Number(qs("#homeScore").value)));
      payload.awayScore = Math.max(0, Math.trunc(Number(qs("#awayScore").value)));
    }
    try {
      await firestore.setDoc(firestore.doc(db, "results", id), payload, { merge: true });
      notify("#formNote", isNew ? "Resultado guardado." : "Cambios guardados.");
      resetForm();
    } catch (error) {
      notify("#formNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });

  function fillForm(item) {
    if (!item) return;
    const sport = sportOf(item);
    qs("#resultDocId").value = item.id;
    setSport(form, sport);
    qs("#home").value = item.home || "";
    qs("#away").value = item.away || "";
    qs("#resultDate").value = item.date || "";
    qs("#homeScore").value = item.homeScore ?? 0;
    qs("#awayScore").value = item.awayScore ?? 0;
    if (sport === "basquetbol") {
      periods = Math.max(4, item.awayPeriods?.length || 0, item.homePeriods?.length || 0);
    }
    applySport(sport, false);
    fillSeasonSelect(qs("#seasonId"), seasonIndex, sport, item.seasonId || "");
    if (sport === "basquetbol") buildPeriods({ away: item.awayPeriods || [], home: item.homePeriods || [] });
    qs("#submitBtn").textContent = "Guardar cambios";
    editing.start(`Editando: ${item.away} vs ${item.home}`);
  }

  function resetForm() {
    form.reset();
    qs("#resultDocId").value = "";
    qs("#resultDate").value = todayIso();
    periods = 4;
    toggleSportFields(config);
    buildPeriods({ away: [], home: [] });
    applySport(readSport(form), true);
    fillSeasonSelect(qs("#seasonId"), seasonIndex, readSport(form), undefined);
    qs("#submitBtn").textContent = "Guardar resultado";
    editing.stop();
  }

  resetForm();
}
