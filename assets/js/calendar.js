import { getFirebase } from "./firebase-service.js";
import { demoChampionships, demoMatches, demoResults, demoSeasons, demoSportsConfig } from "./demo-data.js";
import { docWithId, emptyHtml, matchHtml, scoreboardHtml, toggleOffSeason, upcomingMatches } from "./components.js";
import { belongsToSport, mountSportSelector, noSportsActive, SPORT_LABELS, sportsConfig } from "./sports.js";
import { belongsToSeason, buildSeasonIndex, currentSeasonId, NO_SEASON, seasonOptions, seasonSelectHtml } from "./seasons.js";
import { qs } from "./utils.js";

const state = {
  config: sportsConfig(demoSportsConfig),
  sport: "beisbol",
  seasonId: null,
  championships: demoChampionships,
  seasons: demoSeasons,
  index: buildSeasonIndex(demoChampionships, demoSeasons),
  matches: demoMatches,
  results: demoResults
};

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const { collection, doc, limit, onSnapshot, orderBy, query } = firestore;
  state.config = sportsConfig(null);
  state.championships = [];
  state.seasons = [];
  state.index = buildSeasonIndex([], []);
  onSnapshot(doc(db, "settings", "deportes"), snap => {
    state.config = sportsConfig(snap.exists() ? snap.data() : null);
    render();
  });
  onSnapshot(collection(db, "championships"), snap => {
    state.championships = snap.docs.map(docWithId);
    rebuildIndex();
  });
  onSnapshot(collection(db, "seasons"), snap => {
    state.seasons = snap.docs.map(docWithId);
    rebuildIndex();
  });
  onSnapshot(query(collection(db, "matches"), orderBy("date", "asc")), snap => {
    state.matches = snap.docs.map(docWithId);
    renderSeasonSelector();
    renderLists();
  });
  onSnapshot(query(collection(db, "results"), orderBy("date", "desc"), limit(80)), snap => {
    state.results = snap.empty ? demoResults : snap.docs.map(docWithId);
    renderSeasonSelector();
    renderLists();
  });
}
render();

function rebuildIndex() {
  state.index = buildSeasonIndex(state.championships, state.seasons);
  state.seasonId = null;
  renderSeasonSelector();
  renderLists();
}

function render() {
  if (toggleOffSeason(noSportsActive(state.config), "", state.config)) return;
  const previous = state.sport;
  state.sport = mountSportSelector(qs("#sportSelector"), state.config, sport => {
    state.sport = sport;
    state.seasonId = null;
    renderSeasonSelector();
    renderLists();
  });
  if (previous !== state.sport) state.seasonId = null;
  renderSeasonSelector();
  renderLists();
}

// Selector de temporada (spec 003, CA-11 a CA-13). Sin temporadas del deporte, no aparece.
function renderSeasonSelector() {
  const box = qs("#seasonSelector");
  if (noSportsActive(state.config)) return;
  const docs = [...state.matches, ...state.results].filter(d => belongsToSport(d, state.sport));
  const options = seasonOptions(state.index, state.sport, docs);
  const hasSeasons = options.some(o => o.id !== NO_SEASON);
  box.hidden = !hasSeasons;
  box.dataset.ocultoPorTemporada = hasSeasons ? "si" : "no";
  if (!hasSeasons) {
    state.seasonId = null;
    box.innerHTML = "";
    return;
  }
  if (!state.seasonId || !options.some(o => o.id === state.seasonId)) {
    state.seasonId = currentSeasonId(state.index, state.sport) || options[0].id;
  }
  box.innerHTML = seasonSelectHtml(options, state.seasonId);
  qs("#seasonSelect").addEventListener("change", event => {
    state.seasonId = event.target.value;
    renderLists();
  });
}

function renderLists() {
  if (noSportsActive(state.config)) return;
  const label = SPORT_LABELS[state.sport].toLowerCase();
  const inSelection = doc => belongsToSport(doc, state.sport) && (!state.seasonId || belongsToSeason(doc, state.seasonId, state.index));
  const upcoming = upcomingMatches(state.matches.filter(inSelection));
  qs("#matchesList").innerHTML = upcoming.length
    ? upcoming.map(match => matchHtml(match, { config: state.config, seasons: state.index })).join("")
    : emptyHtml("No hay juegos próximos", state.seasonId ? "Esta temporada no tiene juegos por jugar." : `Cuando se anuncie el siguiente juego de ${label} aparecerá aquí.`);
  const results = state.results.filter(inSelection);
  qs("#resultsGrid").innerHTML = results.length
    ? results.map(result => scoreboardHtml(result)).join("")
    : emptyHtml("Aún no hay resultados", `Los marcadores de ${label} aparecerán aquí.`);
}
