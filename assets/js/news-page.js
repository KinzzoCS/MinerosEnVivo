import { getFirebase } from "./firebase-service.js";
import { demoNews } from "./demo-data.js";
import { formatDate, qs, sanitizeText } from "./utils.js";

const id = new URLSearchParams(location.search).get("id");
let article = demoNews.find(item => item.id === id) || demoNews[0];
renderArticle(article);

const firebase = await getFirebase();
if (firebase && id) {
  const { db, firestore } = firebase;
  const snap = await firestore.getDoc(firestore.doc(db, "news", id));
  if (snap.exists()) renderArticle({ id: snap.id, ...snap.data() });
}

function renderArticle(item) {
  document.title = `${sanitizeText(item.title, 60)} | Mineros TV`;
  qs("#articleShell").innerHTML = `
    <p class="section-kicker">Noticias</p>
    <h1>${sanitizeText(item.title, 110)}</h1>
    <p class="meta">${formatDate(item.date)}</p>
    <img class="article-hero-img" src="${item.imageUrl || "assets/img/news-1.svg"}" alt="">
    <div class="article-body">${sanitizeText(item.content || item.summary, 4000)}</div>
  `;
}
