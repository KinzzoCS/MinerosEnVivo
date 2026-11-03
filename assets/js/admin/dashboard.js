import { requireAdmin } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";
import { isLiveGame } from "../components.js";
import { SPORT_LABELS } from "../sports.js";
import { legacyStreams, normalizeStream, sortStreams } from "../streams.js";

const firebase = await requireAdmin();
if (firebase) {
  const { db, firestore } = firebase;
  const count = async (name, filter = null) => {
    try {
      const ref = filter ? firestore.query(firestore.collection(db, name), filter) : firestore.collection(db, name);
      return (await firestore.getCountFromServer(ref)).data().count;
    } catch {
      return "–";
    }
  };
  const items = [
    ["matches", "Juegos", "partidos.html"],
    ["results", "Resultados", "resultados.html"],
    ["players", "Jugadores", "jugadores.html"],
    ["news", "Noticias", "noticias.html"],
    ["chatMessages", "Mensajes", "chat.html", firestore.where("status", "==", "visible")]
  ];
  const counts = await Promise.all(items.map(([name, , , filter]) => count(name, filter)));
  qs("#resumen").innerHTML = items.map(([, label, href], i) =>
    `<a class="dato tarjeta" href="${href}"><strong>${counts[i]}</strong><span>${label}</span></a>`).join("");

  let settings = {};
  let streamDocs = [];
  let liveGame = null;
  const renderLive = () => {
    const all = streamDocs.length ? streamDocs : legacyStreams(settings);
    const streams = sortStreams(all.map(normalizeStream)).filter(s => s.live).map(s =>
      `${sanitizeText(s.name, 60)}${s.title ? `: ${sanitizeText(s.title, 80)}` : ""} (${SPORT_LABELS[s.sport]})`);
    const pizarra = isLiveGame(liveGame) ? `<span class="pastilla pastilla-vivo">Pizarra en vivo</span>` : "";
    qs("#estadoVivo").innerHTML = streams.length
      ? `<span class="pastilla pastilla-vivo">En vivo</span><span>${new Intl.ListFormat("es-MX", { type: "conjunction" }).format(streams)}</span>${pizarra}`
      : `<span class="pastilla pastilla-espera">Sin transmisión en vivo</span><a class="boton-texto" href="stream.html">Configurar transmisiones</a>${pizarra}`;
  };
  firestore.onSnapshot(firestore.doc(db, "settings", "main"), snap => {
    settings = snap.exists() ? snap.data() : {};
    renderLive();
  });
  firestore.onSnapshot(firestore.collection(db, "streams"), snap => {
    streamDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderLive();
  });
  firestore.onSnapshot(firestore.doc(db, "liveGame", "actual"), snap => {
    liveGame = snap.exists() ? snap.data() : null;
    renderLive();
  });
}
