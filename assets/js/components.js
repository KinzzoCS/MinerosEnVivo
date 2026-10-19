// Piezas de interfaz compartidas por las páginas públicas.
import { formatDate, formatTime, matchStart, safeImageUrl, sanitizeAttr, sanitizeText, teamAbbr } from "./utils.js";

const TEAM = "Mineros";

// Marcador pintado. Si el resultado trae carreras por entrada, muestra la línea completa (C, H, E).
// Con `situation` (juego en vivo) agrega entrada, conteo y bases.
export function scoreboardHtml(result, { label = "Final", situation = null } = {}) {
  const away = sanitizeText(result.away, 32) || "Visitante";
  const home = sanitizeText(result.home, 32) || "Local";
  const awayRuns = Number(result.awayScore || 0);
  const homeRuns = Number(result.homeScore || 0);
  const toInnings = list => (Array.isArray(list) ? list.map(v => (v === null || v === undefined || v === "" ? null : Number(v))) : []);
  const awayInnings = toInnings(result.awayInnings);
  const homeInnings = toInnings(result.homeInnings);
  const innings = Math.max(awayInnings.length, homeInnings.length, situation ? Number(situation.inning || 0) : 0);
  const showLine = innings > 0;
  const columns = showLine ? Math.max(9, innings) : 0;
  const hasHits = Number.isFinite(Number(result.awayHits)) && result.awayHits !== undefined;

  const inningCells = list => Array.from({ length: columns }, (_, i) =>
    Number.isFinite(list[i]) ? `<td>${list[i]}</td>` : `<td class="vacio">-</td>`).join("");
  const row = (name, runs, list, hits, errors, winner) => `
    <tr class="${winner ? "ganador" : ""}">
      <th scope="row" class="equipo">${showLine ? `<abbr title="${sanitizeAttr(name)}">${teamAbbr(name)}</abbr>` : name}</th>
      ${inningCells(list)}
      <td class="total carreras">${runs}</td>
      ${hasHits ? `<td class="total">${Number(hits || 0)}</td><td class="total">${Number(errors || 0)}</td>` : ""}
    </tr>`;

  const currentColumn = situation ? Number(situation.inning) - 1 : -1;
  const headInnings = Array.from({ length: columns }, (_, i) =>
    `<th scope="col"${i === currentColumn ? ' class="actual"' : ""}>${i + 1}</th>`).join("");
  const description = `${away} ${awayRuns}, ${home} ${homeRuns}`;
  if (situation) {
    return `
    <article class="marcador marcador-vivo" aria-label="${sanitizeAttr(`En vivo: ${description}`)}">
      <p class="marcador-equipos"><span class="punto-vivo" aria-hidden="true"></span>Marcador en vivo: ${away} en casa de ${home}</p>
      <div class="marcador-tabla">
        <table>
          <thead><tr><th scope="col"><span class="solo-lector">Equipo</span></th>${headInnings}<th scope="col" title="Carreras">C</th>${hasHits ? `<th scope="col" title="Hits">H</th><th scope="col" title="Errores">E</th>` : ""}</tr></thead>
          <tbody>
            ${row(away, awayRuns, awayInnings, result.awayHits, result.awayErrors, false)}
            ${row(home, homeRuns, homeInnings, result.homeHits, result.homeErrors, false)}
          </tbody>
        </table>
      </div>
      ${situationHtml(situation)}
    </article>`;
  }
  return `
    <article class="marcador" aria-label="${sanitizeAttr(description)}">
      <div class="marcador-tabla">
        <table>
          <thead><tr><th scope="col"><span class="solo-lector">Equipo</span></th>${headInnings}<th scope="col" title="Carreras">C</th>${hasHits ? `<th scope="col" title="Hits">H</th><th scope="col" title="Errores">E</th>` : ""}</tr></thead>
          <tbody>
            ${row(away, awayRuns, awayInnings, result.awayHits, result.awayErrors, awayRuns > homeRuns)}
            ${row(home, homeRuns, homeInnings, result.homeHits, result.homeErrors, homeRuns > awayRuns)}
          </tbody>
        </table>
      </div>
      <div class="marcador-pie"><span>${sanitizeText(label, 30)}</span><span>${away} en casa de ${home}</span><span>${formatDate(result.date)}</span></div>
    </article>`;
}

// Entrada, conteo y corredores de un juego en vivo.
function situationHtml(game) {
  const inning = Math.max(1, Math.trunc(Number(game.inning) || 1));
  const half = game.half === "baja" ? "baja" : "alta";
  const count = (value, max) => Math.min(max, Math.max(0, Math.trunc(Number(value) || 0)));
  const balls = count(game.balls, 3);
  const strikes = count(game.strikes, 2);
  const outs = count(game.outs, 2);
  const bases = Array.isArray(game.bases) ? game.bases.map(Boolean) : [false, false, false];
  const names = ["primera", "segunda", "tercera"].filter((_, i) => bases[i]);
  const runners = names.length === 0 ? "Bases vacías"
    : names.length === 3 ? "Casa llena"
    : `Corredor${names.length > 1 ? "es" : ""} en ${names.join(" y ")}`;
  // Diamante: 2ª arriba, 3ª a la izquierda, 1ª a la derecha
  const base = (on, x, y) => `<rect x="${x}" y="${y}" width="14" height="14" transform="rotate(45 ${x + 7} ${y + 7})" class="${on ? "ocupada" : ""}"/>`;
  const plural = (n, one, many) => `<span class="conteo"><b>${n}</b> ${n === 1 ? one : many}</span>`;
  return `
      <div class="situacion">
        <strong class="situacion-entrada">${inning}ª ${half}</strong>
        <span class="conteos">${plural(balls, "bola", "bolas")}${plural(strikes, "strike", "strikes")}${plural(outs, "out", "outs")}</span>
        <span class="bases" role="img" aria-label="${runners}">
          <svg viewBox="0 0 52 40" aria-hidden="true">${base(bases[1], 19, 3)}${base(bases[2], 5, 17)}${base(bases[0], 33, 17)}</svg>
          <span>${runners}</span>
        </span>
      </div>`;
}

export function liveGameHtml(game) {
  return scoreboardHtml(game, { situation: game });
}

// Un juego publicado desde la pizarra cuenta como en vivo si se actualizó en las últimas 6 horas.
export function isLiveGame(game, now = new Date()) {
  if (!game || game.status !== "en_vivo") return false;
  const updated = game.updatedAt?.toDate ? game.updatedAt.toDate() : game.updatedAt ? new Date(game.updatedAt) : null;
  return !updated || now - updated < 6 * 60 * 60 * 1000;
}

export function matchTitle(match) {
  const rival = sanitizeText(match.rival, 42) || "Rival por definir";
  return match.minerIsAway ? `${TEAM} en casa de ${rival}` : `${TEAM} vs ${rival}`;
}

export function matchHtml(match) {
  const start = matchStart(match);
  const weekday = start ? new Intl.DateTimeFormat("es-MX", { weekday: "short", timeZone: "America/Chihuahua" }).format(start).replace(".", "") : "";
  const day = start ? new Intl.DateTimeFormat("es-MX", { day: "numeric", timeZone: "America/Chihuahua" }).format(start) : "?";
  const month = start ? new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "America/Chihuahua" }).format(start).replace(".", "") : "";
  const stadium = sanitizeText(match.stadium, 60) || "Estadio por definir";
  const tournament = sanitizeText(match.tournament, 40);
  return `
    <article class="juego tarjeta">
      <div class="fecha-bloque" aria-hidden="true"><span class="dia-semana">${weekday}</span><strong>${day}</strong><span class="mes">${month}</span></div>
      <div class="juego-info">
        <span class="juego-rival">${matchTitle(match)}</span>
        <span class="juego-detalle">${formatDate(match.date, { dateStyle: "full" })}, ${formatTime(match.time)}</span>
        <span class="juego-detalle">${stadium}${tournament ? `. ${tournament}` : ""}</span>
        <span class="etiqueta ${match.minerIsAway ? "" : "etiqueta-local"}">${match.minerIsAway ? "Visitante" : "Local"}</span>
      </div>
    </article>`;
}

export function upcomingMatches(matches, now = new Date()) {
  // Un juego sigue "próximo" hasta 4 horas después de su inicio
  const margin = 4 * 60 * 60 * 1000;
  return matches
    .map(match => ({ match, start: matchStart(match) }))
    .filter(({ start }) => start && start.getTime() + margin >= now.getTime())
    .sort((a, b) => a.start - b.start)
    .map(({ match }) => match);
}

export function newsCardHtml(item) {
  const image = safeImageUrl(item.imageUrl, "assets/img/news-1.svg");
  return `
    <a class="noticia-tarjeta tarjeta" href="noticia.html?id=${encodeURIComponent(item.id)}">
      <img src="${image}" alt="" loading="lazy">
      <div>
        <time>${formatDate(item.date, { dateStyle: "long" })}</time>
        <h3>${sanitizeText(item.title, 90)}</h3>
        <p>${sanitizeText(item.summary, 140)}</p>
      </div>
    </a>`;
}

export function emptyHtml(title, text) {
  return `<div class="vacio-bloque tarjeta"><strong>${sanitizeText(title, 80)}</strong><span>${sanitizeText(text, 160)}</span></div>`;
}

export function docWithId(doc) {
  return { id: doc.id, ...doc.data() };
}
