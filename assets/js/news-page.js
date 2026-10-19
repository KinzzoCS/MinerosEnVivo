import { getFirebase } from "./firebase-service.js";
import { demoNews } from "./demo-data.js";
import { formatDate, qs, safeImageUrl, sanitizeText } from "./utils.js";

const id = new URLSearchParams(location.search).get("id");
const demoArticle = demoNews.find(item => item.id === id);
if (demoArticle || !id) renderArticle(demoArticle || demoNews[0]);

const firebase = await getFirebase();
if (firebase && id) {
  const { db, firestore } = firebase;
  try {
    const snap = await firestore.getDoc(firestore.doc(db, "news", id));
    if (snap.exists()) renderArticle({ id: snap.id, ...snap.data() });
    else if (!demoArticle) renderMissing();
  } catch (error) {
    console.error("News error:", error);
    if (!demoArticle) renderMissing("No se pudo cargar la noticia. Revisa tu conexión e inténtalo de nuevo.");
  }
} else if (id && !demoArticle) {
  renderMissing();
}

function renderArticle(item) {
  document.title = `${sanitizeText(item.title, 60)} | Mineros TV`;
  qs("#articleShell").innerHTML = `
    <a class="boton-texto volver" href="noticias.html">Todas las noticias</a>
    <h1>${sanitizeText(item.title, 110)}</h1>
    <time class="tenue">${formatDate(item.date, { dateStyle: "long" })}</time>
    <img src="${safeImageUrl(item.imageUrl, "assets/img/news-1.svg")}" alt="">
    <div class="articulo-cuerpo"></div>
  `;
  // textContent conserva los saltos de línea sin interpretar HTML
  qs(".articulo-cuerpo").textContent = String(item.content || item.summary || "").slice(0, 8000);
}

function renderMissing(text = "Puede que se haya borrado o que el enlace esté incompleto.") {
  qs("#articleShell").innerHTML = `
    <a class="boton-texto volver" href="noticias.html">Todas las noticias</a>
    <h1>No encontramos esta noticia</h1>
    <p class="tenue">${sanitizeText(text, 160)}</p>`;
}
