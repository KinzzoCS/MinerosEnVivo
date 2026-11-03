import { getFirebase } from "./firebase-service.js";
import { demoBasketballNews, demoNews, demoSportsConfig } from "./demo-data.js";
import { docWithId, emptyHtml, newsCardHtml } from "./components.js";
import { belongsToSport, mountSportSelector, noSportsActive, sportsConfig } from "./sports.js";
import { qs } from "./utils.js";

const demo = [...demoNews, ...demoBasketballNews];
const state = { config: sportsConfig(demoSportsConfig), sport: "beisbol", news: demo };

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const { collection, doc, limit, onSnapshot, orderBy, query } = firestore;
  state.config = sportsConfig(null);
  onSnapshot(doc(db, "settings", "deportes"), snap => {
    state.config = sportsConfig(snap.exists() ? snap.data() : null);
    render();
  });
  onSnapshot(query(collection(db, "news"), orderBy("date", "desc"), limit(40)), snap => {
    state.news = snap.empty ? demo : snap.docs.map(docWithId);
    render();
  });
}
render();

function render() {
  state.sport = mountSportSelector(qs("#sportSelector"), state.config, sport => {
    state.sport = sport;
    renderNews();
  });
  renderNews();
}

function renderNews() {
  // Fuera de temporada (ningún deporte activo) se muestran todas las noticias (spec 003, CA-04)
  const news = noSportsActive(state.config) ? state.news : state.news.filter(item => belongsToSport(item, state.sport, { news: true }));
  qs("#newsGrid").innerHTML = news.length
    ? news.map(newsCardHtml).join("")
    : emptyHtml("Sin noticias por ahora", "Las noticias del equipo aparecerán aquí.");
}
