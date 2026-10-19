import { getFirebase } from "./firebase-service.js";
import { demoMatches, demoResults } from "./demo-data.js";
import { docWithId, emptyHtml, matchHtml, scoreboardHtml, upcomingMatches } from "./components.js";
import { qs } from "./utils.js";

renderMatches(demoMatches);
renderResults(demoResults);

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const { collection, limit, onSnapshot, orderBy, query } = firestore;
  onSnapshot(query(collection(db, "matches"), orderBy("date", "asc")), snap => renderMatches(snap.docs.map(docWithId)));
  onSnapshot(query(collection(db, "results"), orderBy("date", "desc"), limit(20)),
    snap => renderResults(snap.empty ? demoResults : snap.docs.map(docWithId)));
}

function renderMatches(matches) {
  const upcoming = upcomingMatches(matches);
  qs("#matchesList").innerHTML = upcoming.length
    ? upcoming.map(matchHtml).join("")
    : emptyHtml("Todavía no hay juegos programados", "Cuando se anuncie el siguiente juego aparecerá aquí.");
}

function renderResults(results) {
  qs("#resultsGrid").innerHTML = results.length
    ? results.map(result => scoreboardHtml(result)).join("")
    : emptyHtml("Aún no hay resultados", "Los marcadores de cada juego aparecerán aquí.");
}
