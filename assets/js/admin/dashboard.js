import { requireAdmin } from "./admin-common.js";
import { qs } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) {
  const { db, firestore } = firebase;
  const collections = ["news", "players", "chatMessages", "matches"];
  const counts = await Promise.all(collections.map(async name => {
    const snap = await firestore.getCountFromServer(firestore.collection(db, name));
    return [name, snap.data().count];
  }));
  const labels = { news: "Noticias", players: "Jugadores", chatMessages: "Mensajes", matches: "Proximos partidos" };
  qs("#statsGrid").innerHTML = counts.map(([name, count]) => `<article class="stat-card"><p class="section-kicker">${labels[name]}</p><h2>${count}</h2></article>`).join("");
}
