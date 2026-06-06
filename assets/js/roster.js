import { getFirebase } from "./firebase-service.js";
import { demoPlayers } from "./demo-data.js";
import { qs, sanitizeText } from "./utils.js";

renderPlayers(demoPlayers);

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const q = firestore.query(firestore.collection(db, "players"), firestore.orderBy("number", "asc"));
  firestore.onSnapshot(q, snap => renderPlayers(snap.empty ? demoPlayers : snap.docs.map(d => ({ id: d.id, ...d.data() }))));
}

function renderPlayers(players) {
  qs("#playersGrid").innerHTML = players.map(player => `
    <article class="player-card">
      <img src="${player.photoUrl || "assets/img/player-1.svg"}" alt="">
      <span class="badge">#${Number(player.number || 0)} · ${sanitizeText(player.position, 28)}</span>
      <h3>${sanitizeText(player.name, 70)}</h3>
      <p class="meta">${sanitizeText(player.bio, 180)}</p>
    </article>`).join("");
}
