import { getFirebase } from "./firebase-service.js";
import { demoNews } from "./demo-data.js";
import { docWithId, emptyHtml, newsCardHtml } from "./components.js";
import { qs } from "./utils.js";

renderNews(demoNews);

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const { collection, limit, onSnapshot, orderBy, query } = firestore;
  onSnapshot(query(collection(db, "news"), orderBy("date", "desc"), limit(30)),
    snap => renderNews(snap.empty ? demoNews : snap.docs.map(docWithId)));
}

function renderNews(news) {
  qs("#newsGrid").innerHTML = news.length
    ? news.map(newsCardHtml).join("")
    : emptyHtml("Sin noticias por ahora", "Las noticias del equipo aparecerán aquí.");
}
