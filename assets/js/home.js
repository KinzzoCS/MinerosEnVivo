// Pantalla de Inicio (spec 005): resumen por deporte y accesos a toda la app.
import { formatDate, formatTime, matchStart, sanitizeAttr, sanitizeText, toDate } from "./utils.js";
import { belongsToSport, crestSrc, SPORT_LABELS } from "./sports.js";
import { currentSeasonId } from "./seasons.js";
import { liveStreams, socialLinks } from "./streams.js";
import { matchTitle, upcomingMatches } from "./components.js";

function isoDate(date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chihuahua", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Lo que Inicio dice de un deporte: transmisiones en vivo, próximo juego, último resultado y temporada.
export function sportSummary({ sport, config, streams = [], matches = [], results = [], seasonIndex = new Map(), now = new Date() }) {
  const live = liveStreams(streams, config).filter(s => s.sport === sport);
  const next = upcomingMatches(matches.filter(m => belongsToSport(m, sport)), now).find(m => matchStart(m) > now) || null;
  const last = results
    .filter(r => belongsToSport(r, sport))
    .sort((a, b) => (toDate(b.date)?.getTime() || 0) - (toDate(a.date)?.getTime() || 0))[0] || null;
  const seasonId = currentSeasonId(seasonIndex, sport, isoDate(now));
  return { sport, team: config?.[sport] || {}, live, next, last, season: seasonId ? seasonIndex.get(seasonId)?.label || "" : "" };
}

// Pone primero las transmisiones del deporte elegido, sin cambiar el orden dentro de cada grupo.
export function preferSport(list, sport) {
  return [...list.filter(s => s.sport === sport), ...list.filter(s => s.sport !== sport)];
}

export function liveBannerHtml(live) {
  if (!live.length) return "";
  const names = new Intl.ListFormat("es-MX", { type: "conjunction" }).format(live.map(s => sanitizeText(s.name, 60)));
  return `
    <a class="aviso-vivo tarjeta" href="envivo.html">
      <span class="pastilla pastilla-vivo">En vivo</span>
      <span class="aviso-vivo-texto"><strong>${names}</strong>${live.length === 1 && live[0].title ? `<span>${sanitizeText(live[0].title, 100)}</span>` : ""}</span>
      <span class="boton boton-rojo boton-chico" aria-hidden="true">Ver en vivo</span>
    </a>`;
}

export function sportCardHtml(summary, config) {
  const { sport, team, live, next, last, season } = summary;
  const crest = crestSrc(team.escudo);
  const query = `?deporte=${sport}`;
  const status = live.length
    ? `<p class="deporte-estado"><span class="pastilla pastilla-vivo">En vivo ahora</span> ${sanitizeText(live.map(s => s.name).join(", "), 120)}</p>
       <a class="boton boton-rojo boton-ancho" href="envivo.html${query}">Ver en vivo</a>`
    : next
      ? `<div class="deporte-proximo"><span class="tenue">Próximo juego</span><strong>${matchTitle(next, config)}</strong><span>${formatDate(next.date, { weekday: "long", day: "numeric", month: "long" })}, ${formatTime(next.time)}${next.stadium ? `. ${sanitizeText(next.stadium, 60)}` : ""}</span></div>
         <a class="boton boton-borde boton-ancho" href="envivo.html${query}">Ir a En vivo</a>`
      : `<p class="tenue">No hay juegos programados por ahora.</p>
         <a class="boton boton-borde boton-ancho" href="envivo.html${query}">Ir a En vivo</a>`;
  // Sin transmisión en vivo: se dice y se invita a seguir sus redes (spec 005, CA-12)
  const links = live.length ? [] : socialLinks(config).find(t => t.sport === sport)?.links || [];
  const noLiveHtml = live.length ? "" : `
      <div class="deporte-sin-vivo">
        <p><strong>Sin transmisión en vivo.</strong> Te avisamos en redes cuándo empieza.</p>
        ${links.length ? `<div class="redes-enlaces">${links.map(l => `<a class="boton boton-borde boton-red" href="${sanitizeAttr(l.url, 400)}" target="_blank" rel="noopener">${l.label}<span class="solo-lector"> (abre en otra pestaña)</span></a>`).join("")}</div>` : ""}
      </div>`;
  const lastHtml = last
    ? `<p class="deporte-ultimo"><span class="tenue">Último resultado</span> <strong>${sanitizeText(last.away, 32)} ${Number(last.awayScore || 0)}, ${sanitizeText(last.home, 32)} ${Number(last.homeScore || 0)}</strong> <span class="tenue">${formatDate(last.date)}</span></p>`
    : "";
  return `
    <article class="deporte-tarjeta tarjeta" aria-labelledby="t-deporte-${sport}">
      <header class="deporte-cabeza">
        ${crest ? `<img src="${crest}" alt="" width="56" height="56">` : ""}
        <div>
          <span class="etiqueta etiqueta-deporte">${SPORT_LABELS[sport]}</span>
          <h2 id="t-deporte-${sport}">${sanitizeText(team.nombre || "Mineros", 60)}</h2>
          ${season ? `<span class="tenue">${sanitizeText(season, 100)}</span>` : ""}
        </div>
      </header>
      ${noLiveHtml}
      ${status}
      ${lastHtml}
      <nav class="deporte-accesos" aria-label="Secciones de ${SPORT_LABELS[sport].toLowerCase()}">
        <a href="calendario.html${query}">Calendario</a>
        <a href="roster.html${query}">Equipo</a>
        <a href="noticias.html${query}">Noticias</a>
      </nav>
    </article>`;
}
