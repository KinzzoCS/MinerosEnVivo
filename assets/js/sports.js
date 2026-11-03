// Deportes de Mineros TV (spec 001): béisbol (principal, con pizarra) y básquetbol.
// Un documento sin deporte se trata como béisbol, así no hay que migrar datos viejos.
import { safeImageUrl, safeLinkUrl, sanitizeAttr, sanitizeText } from "./utils.js";

export const SPORTS = ["beisbol", "basquetbol"];
export const SPORT_LABELS = { beisbol: "Béisbol", basquetbol: "Básquetbol" };
export const SOCIAL_KEYS = ["facebook", "instagram", "youtube", "tiktok", "x", "whatsapp"];

export const DEFAULT_SPORTS_CONFIG = {
  beisbol: { activo: true, equipo: "Mineros", nombre: "Mineros de Parral", liga: "Estatal Chihuahua 2026", escudo: "assets/icons/escudo.png" },
  basquetbol: { activo: false, equipo: "Mineros", nombre: "Mineros A.C.", liga: "", escudo: "" }
};

const SELECTED_KEY = "mineros_deporte";

export function normalizeSport(value) {
  return SPORTS.includes(value) ? value : "beisbol";
}

export function sportOf(doc) {
  return normalizeSport(doc?.sport);
}

export function newsSports(doc) {
  const list = Array.isArray(doc?.sports) ? [...new Set(doc.sports.filter(s => SPORTS.includes(s)))] : [];
  return list.length ? list : [sportOf(doc)];
}

export function belongsToSport(doc, sport, { news = false } = {}) {
  return news ? newsSports(doc).includes(sport) : sportOf(doc) === sport;
}

// Mezcla lo guardado en settings/deportes con los valores por defecto y limpia el texto.
export function sportsConfig(raw) {
  const config = {};
  for (const sport of SPORTS) {
    const base = DEFAULT_SPORTS_CONFIG[sport];
    const saved = raw && typeof raw[sport] === "object" ? raw[sport] : {};
    config[sport] = {
      activo: Boolean(saved.activo ?? base.activo),
      equipo: sanitizeText(saved.equipo, 30) || base.equipo,
      nombre: sanitizeText(saved.nombre, 60) || base.nombre,
      liga: saved.liga === undefined ? base.liga : sanitizeText(saved.liga, 60),
      escudo: saved.escudo === undefined ? base.escudo : safeImageUrl(saved.escudo, ""),
      // Redes sociales del equipo (spec 004): solo enlaces https
      redes: Object.fromEntries(SOCIAL_KEYS.map(key => [key, safeLinkUrl(saved.redes?.[key])]))
    };
  }
  return config;
}

export function basketballOn(config) {
  return Boolean(config?.basquetbol?.activo);
}

// Deportes encendidos en settings/deportes (spec 003). Cualquiera de los dos se puede apagar.
export function activeSports(config) {
  return SPORTS.filter(sport => config?.[sport]?.activo);
}

export function isSportActive(config, sport) {
  return activeSports(config).includes(normalizeSport(sport));
}

export function multiSport(config) {
  return activeSports(config).length > 1;
}

export function noSportsActive(config) {
  return activeSports(config).length === 0;
}

// Deporte que se usa si la persona no elige: el único activo, o béisbol.
export function defaultSport(config) {
  return activeSports(config)[0] || "beisbol";
}

// Deporte pedido en la dirección (?deporte=beisbol), si está activo (spec 005, CA-08).
export function sportFromQuery(search, config) {
  const value = new URLSearchParams(search || "").get("deporte");
  return SPORTS.includes(value) && activeSports(config).includes(value) ? value : null;
}

function savedSport() {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

// Deporte que la persona eligió de verdad: el de la dirección o el que guardó. Si no eligió, null (spec 005, CA-11).
export function explicitSport(config, search = typeof location === "undefined" ? "" : location.search, saved = savedSport()) {
  const active = activeSports(config);
  return sportFromQuery(search, config) || (active.includes(saved) ? saved : null);
}

export function readSelectedSport(config) {
  const active = activeSports(config);
  if (active.length <= 1) return defaultSport(config);
  const fromUrl = typeof location === "undefined" ? null : sportFromQuery(location.search, config);
  if (fromUrl) {
    saveSelectedSport(fromUrl);
    return fromUrl;
  }
  try {
    const saved = localStorage.getItem(SELECTED_KEY);
    return active.includes(saved) ? saved : active[0];
  } catch {
    return active[0];
  }
}

export function saveSelectedSport(sport) {
  try {
    localStorage.setItem(SELECTED_KEY, normalizeSport(sport));
  } catch {
    // Sin almacenamiento: la elección dura solo esta visita
  }
}

// `base` antepone la ruta a escudos locales (por ejemplo "../" desde el panel admin).
export function crestSrc(escudo, base = "") {
  if (!escudo) return "";
  return escudo.startsWith("assets/") ? `${base}${escudo}` : escudo;
}

export function sportSelectorHtml(selected, config, { base = "" } = {}) {
  const buttons = SPORTS.map(sport => {
    const crest = crestSrc(config?.[sport]?.escudo, base);
    return `<button type="button" data-sport="${sport}" aria-pressed="${sport === selected}">${crest ? `<img src="${crest}" alt="" width="28" height="28">` : ""}<span>${SPORT_LABELS[sport]}</span></button>`;
  }).join("");
  return `<div class="selector selector-deporte" role="group" aria-label="Elige el deporte">${buttons}</div>`;
}

export function sportTagHtml(sport) {
  const value = normalizeSport(sport);
  return `<span class="etiqueta etiqueta-deporte" data-deporte="${sanitizeAttr(value)}">${SPORT_LABELS[value]}</span>`;
}

// Pinta el selector en `container` y avisa cada cambio. Solo aparece con dos deportes activos.
export function mountSportSelector(container, config, onChange) {
  if (!container) return "beisbol";
  const selected = readSelectedSport(config);
  container.hidden = !multiSport(config);
  container.innerHTML = multiSport(config) ? sportSelectorHtml(selected, config) : "";
  if (!container.dataset.bound) {
    container.dataset.bound = "1";
    container.addEventListener("click", event => {
      const button = event.target.closest("[data-sport]");
      if (!button) return;
      saveSelectedSport(button.dataset.sport);
      container.querySelectorAll("[data-sport]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      onChange(button.dataset.sport);
    });
  }
  return selected;
}
