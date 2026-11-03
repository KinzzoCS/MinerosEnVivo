// Campeonatos y temporadas (spec 003). Un campeonato ("Estatal Chihuahua") tiene temporadas ("2026").
// Juegos y resultados se ligan a una temporada con `seasonId`; los que no tienen siguen funcionando.
import { safeImageUrl, sanitizeAttr, sanitizeText } from "./utils.js";
import { normalizeSport } from "./sports.js";

export const NO_SEASON = "sin-temporada";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeChampionship(doc) {
  return {
    id: String(doc?.id || ""),
    name: sanitizeText(doc?.name, 80),
    sport: normalizeSport(doc?.sport),
    logo: safeImageUrl(doc?.logo, "")
  };
}

export function normalizeSeason(doc) {
  return {
    id: String(doc?.id || ""),
    championshipId: String(doc?.championshipId || ""),
    sport: normalizeSport(doc?.sport),
    name: sanitizeText(doc?.name, 40),
    startDate: DATE.test(doc?.startDate || "") ? doc.startDate : "",
    endDate: DATE.test(doc?.endDate || "") ? doc.endDate : "",
    logo: safeImageUrl(doc?.logo, "")
  };
}

// Mapa seasonId → { season, championship, label, logo, sport }.
export function buildSeasonIndex(championships = [], seasons = []) {
  const champs = new Map(championships.map(normalizeChampionship).map(c => [c.id, c]));
  const index = new Map();
  for (const raw of seasons) {
    const season = normalizeSeason(raw);
    if (!season.id) continue;
    const championship = champs.get(season.championshipId) || null;
    index.set(season.id, {
      season,
      championship,
      sport: season.sport,
      label: championship ? `${championship.name} ${season.name}`.trim() : season.name,
      logo: season.logo || championship?.logo || ""
    });
  }
  return index;
}

function seasonsOf(index, sport) {
  return [...index.values()].filter(entry => entry.sport === normalizeSport(sport));
}

// Temporada en curso: la que incluye hoy; si no, la próxima en empezar; si no, la última que terminó.
export function currentSeasonId(index, sport, today = todayInParral()) {
  const list = seasonsOf(index, sport);
  if (!list.length) return null;
  const running = list.filter(e => e.season.startDate && e.season.startDate <= today && (!e.season.endDate || e.season.endDate >= today))
    .sort((a, b) => b.season.startDate.localeCompare(a.season.startDate));
  if (running.length) return running[0].season.id;
  const upcoming = list.filter(e => e.season.startDate > today).sort((a, b) => a.season.startDate.localeCompare(b.season.startDate));
  if (upcoming.length) return upcoming[0].season.id;
  return [...list].sort((a, b) => (b.season.startDate || "").localeCompare(a.season.startDate || ""))[0].season.id;
}

// Opciones del selector: de la más reciente a la más antigua, y "Sin temporada" si hay juegos sueltos.
export function seasonOptions(index, sport, docs = []) {
  const options = seasonsOf(index, sport)
    .sort((a, b) => (b.season.startDate || "").localeCompare(a.season.startDate || ""))
    .map(entry => ({ id: entry.season.id, label: entry.label }));
  if (docs.some(doc => !doc.seasonId || !index.has(doc.seasonId))) options.push({ id: NO_SEASON, label: "Sin temporada" });
  return options;
}

export function belongsToSeason(doc, seasonId, index = null) {
  if (seasonId === NO_SEASON) return !doc.seasonId || (index ? !index.has(doc.seasonId) : false);
  return doc.seasonId === seasonId;
}

export function seasonSelectHtml(options, selected) {
  return `
    <label class="campo selector-temporada" for="seasonSelect">Temporada
      <select id="seasonSelect">
        ${options.map(o => `<option value="${sanitizeAttr(o.id, 80)}"${o.id === selected ? " selected" : ""}>${sanitizeText(o.label, 100)}</option>`).join("")}
      </select>
    </label>`;
}

// Logo y nombre del campeonato para tarjetas. `base` antepone la ruta a imágenes locales (panel admin).
export function seasonBadgeHtml(entry, base = "") {
  if (!entry) return "";
  const logo = entry.logo ? (entry.logo.startsWith("assets/") ? `${base}${entry.logo}` : entry.logo) : "";
  return `<span class="temporada-insignia">${logo ? `<img src="${logo}" alt="" width="24" height="24" loading="lazy">` : ""}<span>${sanitizeText(entry.label, 100)}</span></span>`;
}

export function todayInParral() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chihuahua", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
