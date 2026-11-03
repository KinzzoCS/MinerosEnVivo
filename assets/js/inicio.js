// Pantalla de Inicio (spec 005): aviso de transmisión en vivo, una tarjeta por deporte, noticias y redes.
import { getFirebase } from "./firebase-service.js";
import { demoBasketballNews, demoChampionships, demoMatches, demoNews, demoResults, demoSeasons, demoSettings, demoSportsConfig, demoStreams } from "./demo-data.js";
import { docWithId, emptyHtml, newsCardHtml, toggleOffSeason } from "./components.js";
import { activeSports, isSportActive, newsSports, noSportsActive, sportsConfig } from "./sports.js";
import { buildSeasonIndex } from "./seasons.js";
import { legacyStreams, liveStreams, socialBlockHtml, socialLinks } from "./streams.js";
import { liveBannerHtml, sportCardHtml, sportSummary } from "./home.js";
import { qs } from "./utils.js";

const state = {
  config: sportsConfig(demoSportsConfig),
  streamDocs: demoStreams,
  legacySettings: demoSettings,
  matches: demoMatches,
  results: demoResults,
  news: [...demoNews, ...demoBasketballNews],
  championships: demoChampionships,
  seasons: demoSeasons
};

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const { collection, doc, limit, onSnapshot, orderBy, query, where } = firestore;
  Object.assign(state, { config: sportsConfig(null), streamDocs: [], legacySettings: null, matches: [], championships: [], seasons: [] });
  const listen = (ref, apply) => onSnapshot(ref, snap => { apply(snap); render(); });
  listen(doc(db, "settings", "deportes"), snap => { state.config = sportsConfig(snap.exists() ? snap.data() : null); });
  listen(collection(db, "streams"), snap => { state.streamDocs = snap.docs.map(docWithId); });
  listen(doc(db, "settings", "main"), snap => { state.legacySettings = snap.exists() ? snap.data() : null; });
  listen(collection(db, "championships"), snap => { state.championships = snap.docs.map(docWithId); });
  listen(collection(db, "seasons"), snap => { state.seasons = snap.docs.map(docWithId); });
  listen(query(collection(db, "matches"), where("date", ">=", isoDaysFromToday(-1)), orderBy("date", "asc"), limit(20)),
    snap => { state.matches = snap.docs.map(docWithId); });
  listen(query(collection(db, "results"), orderBy("date", "desc"), limit(20)),
    snap => { state.results = snap.empty ? demoResults : snap.docs.map(docWithId); });
  listen(query(collection(db, "news"), orderBy("date", "desc"), limit(12)),
    snap => { state.news = snap.empty ? demoNews : snap.docs.map(docWithId); });
}
render();

function isoDaysFromToday(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function render() {
  const off = toggleOffSeason(noSportsActive(state.config), "", state.config);
  renderNews(off);
  if (off) {
    qs("#avisoVivo").innerHTML = "";
    return;
  }
  const streams = state.streamDocs.length ? state.streamDocs : legacyStreams(state.legacySettings);
  qs("#avisoVivo").innerHTML = liveBannerHtml(liveStreams(streams, state.config));

  const seasonIndex = buildSeasonIndex(state.championships, state.seasons);
  qs("#sportCards").innerHTML = activeSports(state.config).map(sport => sportCardHtml(sportSummary({
    sport, config: state.config, streams, matches: state.matches, results: state.results, seasonIndex
  }), state.config)).join("");

  const teams = socialLinks(state.config).filter(team => team.links.length);
  qs("#redesInicio").hidden = !teams.length;
  qs("#redesLista").innerHTML = socialBlockHtml(teams);
}

function renderNews(off) {
  // Fuera de temporada se muestran todas; si no, solo las de deportes activos
  const visible = off ? state.news : state.news.filter(item => newsSports(item).some(sport => isSportActive(state.config, sport)));
  qs("#newsGrid").innerHTML = visible.length
    ? visible.slice(0, 3).map(newsCardHtml).join("")
    : emptyHtml("Sin noticias por ahora", "Las noticias del equipo aparecerán aquí.");
}
