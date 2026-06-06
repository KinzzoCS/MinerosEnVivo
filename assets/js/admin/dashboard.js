import { requireAdmin } from "./admin-common.js";
import { qs } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) {
  const { db, firestore } = firebase;
  const collections = ["news", "players", "chatMessages", "matches", "results"];
  const counts = await Promise.all(collections.map(async name => {
    const snap = await firestore.getCountFromServer(firestore.collection(db, name));
    return [name, snap.data().count];
  }));
  const labels = { news: "Noticias", players: "Jugadores", chatMessages: "Mensajes", matches: "Próximos partidos", results: "Resultados" };
  const countsMap = Object.fromEntries(counts);
  qs("#statsGrid").innerHTML = counts.map(([name, count]) => `<article class="stat-card"><p class="section-kicker">${labels[name]}</p><h2>${count}</h2></article>`).join("");
  const quickItems = [
    ["partidos.html", "Partidos", `${countsMap.matches || 0} registros disponibles`],
    ["resultados.html", "Resultados", `${countsMap.results || 0} resultados registrados`],
    ["noticias.html", "Noticias", `${countsMap.news || 0} noticias publicadas`],
    ["jugadores.html", "Jugadores", `${countsMap.players || 0} jugadores registrados`],
    ["chat.html", "Chat", `${countsMap.chatMessages || 0} mensajes recientes`]
  ];
  qs("#quickActions").innerHTML = quickItems.map(([href, label, subtitle]) => `<article class="admin-row"><div><strong>${label}</strong><p class="meta">${subtitle}</p></div><div class="row-actions"><a class="ghost-button" href="${href}">Abrir</a></div></article>`).join("");
}
