import { getFirebase } from "./firebase-service.js";
import { demoBasketballPlayers, demoPlayers, demoSportsConfig } from "./demo-data.js";
import { docWithId, emptyHtml, toggleOffSeason } from "./components.js";
import { belongsToSport, mountSportSelector, noSportsActive, sportsConfig } from "./sports.js";
import { qs, safeImageUrl, sanitizeText } from "./utils.js";

const demo = [...demoPlayers, ...demoBasketballPlayers];
const state = { config: sportsConfig(demoSportsConfig), sport: "beisbol", players: demo };

const firebase = await getFirebase();
if (firebase) {
  const { db, firestore } = firebase;
  state.config = sportsConfig(null);
  firestore.onSnapshot(firestore.doc(db, "settings", "deportes"), snap => {
    state.config = sportsConfig(snap.exists() ? snap.data() : null);
    render();
  });
  const q = firestore.query(firestore.collection(db, "players"), firestore.orderBy("number", "asc"));
  firestore.onSnapshot(q, snap => {
    state.players = snap.empty ? demo : snap.docs.map(docWithId);
    render();
  });
}
render();

function render() {
  if (toggleOffSeason(noSportsActive(state.config), "", state.config)) return;
  state.sport = mountSportSelector(qs("#sportSelector"), state.config, sport => {
    state.sport = sport;
    renderPlayers();
  });
  renderPlayers();
}

function renderPlayers() {
  const team = state.config[state.sport];
  qs("#rosterIntro").textContent = `Los jugadores de ${team.nombre}, con su número y posición.`;
  const players = state.players.filter(p => belongsToSport(p, state.sport));
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
