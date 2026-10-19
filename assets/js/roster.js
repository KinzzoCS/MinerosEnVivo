import { getFirebase } from "./firebase-service.js";
import { demoPlayers } from "./demo-data.js";
import { docWithId, emptyHtml } from "./components.js";
import { qs, safeImageUrl, sanitizeText } from "./utils.js";

renderPlayers(demoPlayers);

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  const q = firestore.query(firestore.collection(db, "players"), firestore.orderBy("number", "asc"));
  firestore.onSnapshot(q, snap => renderPlayers(snap.empty ? demoPlayers : snap.docs.map(docWithId)));
}

function renderPlayers(players) {
  qs("#playersGrid").innerHTML = players.length
    ? players.map(player => `
      <article class="jugador tarjeta">
        <div class="jugador-foto">
          <img src="${safeImageUrl(player.photoUrl, "assets/img/player-1.svg")}" alt="" loading="lazy">
          <span class="jugador-numero" aria-label="Número ${Number(player.number || 0)}">${Number(player.number || 0)}</span>
        </div>
        <div class="jugador-info">
          <h3>${sanitizeText(player.name, 70)}</h3>
          <span class="jugador-posicion">${sanitizeText(player.position, 28)}</span>
          <p>${sanitizeText(player.bio, 180)}</p>
        </div>
      </article>`).join("")
    : emptyHtml("El roster todavía no está publicado", "Los jugadores aparecerán aquí cuando se den de alta.");
}
