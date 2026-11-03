// Medios de transmisión (spec 004). Cada uno es un video o canal de YouTube con su nombre y deporte.
// En la app solo aparecen los que están en vivo. Si no hay ninguno, se invita a seguir las redes.
import { sanitizeAttr, sanitizeText, youtubeEmbedUrl } from "./utils.js";
import { activeSports, crestSrc, normalizeSport, SOCIAL_KEYS, SPORT_LABELS, SPORTS } from "./sports.js";

export const SOCIAL_NETWORKS = [
  ["facebook", "Facebook"],
  ["instagram", "Instagram"],
  ["youtube", "YouTube"],
  ["tiktok", "TikTok"],
  ["x", "X"],
  ["whatsapp", "WhatsApp"]
];

export function normalizeStream(doc) {
  const order = Math.trunc(Number(doc?.order));
  return {
    id: String(doc?.id || ""),
    name: sanitizeText(doc?.name, 60) || "Transmisión",
    title: sanitizeText(doc?.title, 100),
    url: String(doc?.url || "").trim(),
    live: doc?.live === true,
    sport: normalizeSport(doc?.sport),
    order: Number.isFinite(order) ? order : 0
  };
}

// Las dos transmisiones fijas de settings/main, para cuando todavía no existe la colección `streams`.
export function legacyStreams(settings) {
  if (!settings) return [];
  const names = { 1: "Mineros TV", 2: "La Poderosa De Parral" };
  return [1, 2]
    .filter(n => settings[`liveStreamUrl${n}`])
    .map(n => normalizeStream({
      id: String(n),
      name: names[n],
      title: settings[`liveTitle${n}`],
      url: settings[`liveStreamUrl${n}`],
      live: Boolean(settings[`liveStatus${n}`]),
      sport: settings[`liveSport${n}`],
      order: n
    }));
}

export function sortStreams(list) {
  return [...list].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "es"));
}

// Transmisiones que la app puede mostrar: en vivo, con enlace de YouTube válido y de un deporte activo.
export function liveStreams(streams, config) {
  const active = activeSports(config);
  return sortStreams(streams.map(normalizeStream).filter(s => s.live && youtubeEmbedUrl(s.url) && active.includes(s.sport)));
}

// Redes por equipo. Por defecto solo de deportes activos; con onlyActive: false, de los que tengan redes.
export function socialLinks(config, { onlyActive = true } = {}) {
  const sports = onlyActive ? activeSports(config) : SPORTS;
  return sports.map(sport => {
    const team = config?.[sport] || {};
    const links = SOCIAL_NETWORKS
      .filter(([key]) => SOCIAL_KEYS.includes(key) && team.redes?.[key])
      .map(([key, label]) => ({ key, label, url: team.redes[key] }));
    return { sport, nombre: team.nombre || "Mineros", escudo: team.escudo || "", links };
  }).filter(team => onlyActive || team.links.length);
}

export function socialBlockHtml(teams, base = "") {
  if (!teams.length) return "";
  return `
    <div class="redes">
      ${teams.map(team => {
        const crest = crestSrc(team.escudo, base);
        return `
        <div class="redes-equipo">
          <div class="redes-nombre">${crest ? `<img src="${crest}" alt="" width="40" height="40">` : ""}<strong>${sanitizeText(team.nombre, 60)}</strong></div>
          ${team.links.length
            ? `<div class="redes-enlaces">${team.links.map(link => `<a class="boton boton-borde boton-red" href="${sanitizeAttr(link.url, 400)}" target="_blank" rel="noopener">${link.label}<span class="solo-lector"> de ${sanitizeText(team.nombre, 60)} (abre en otra pestaña)</span></a>`).join("")}</div>`
            : `<p class="tenue">Este equipo todavía no tiene redes en la app.</p>`}
        </div>`;
      }).join("")}
    </div>`;
}

// Aviso cuando el deporte elegido no tiene transmisión en vivo pero otro sí (spec 005, CA-11).
export function noLiveSportHtml(config, sport, nextHtml = "") {
  const label = SPORT_LABELS[normalizeSport(sport)];
  const team = socialLinks(config).filter(t => t.sport === normalizeSport(sport));
  return `
    <section class="sin-vivo sin-vivo-deporte tarjeta" aria-labelledby="t-sin-vivo-deporte">
      <h2 id="t-sin-vivo-deporte">No hay transmisión en vivo de ${label.toLowerCase()}</h2>
      <p>Estate atento a sus redes: ahí avisamos cuándo es el próximo juego. Mientras tanto, abajo están las transmisiones que sí están en vivo.</p>
      ${socialBlockHtml(team)}
      ${nextHtml}
    </section>`;
}

// Aviso cuando ninguna transmisión está en vivo (CA-09).
export function noLiveHtml(config, nextHtml = "") {
  return `
    <section class="sin-vivo tarjeta" aria-labelledby="t-sin-vivo">
      <h1 id="t-sin-vivo">No hay transmisión en vivo</h1>
      <p>Estate atento a nuestras redes sociales: ahí avisamos cuándo es el próximo juego y cuándo empieza la transmisión.</p>
      ${socialBlockHtml(socialLinks(config))}
      ${nextHtml}
    </section>`;
}
