export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function sanitizeText(value, max = 500) {
  return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Para atributos HTML: además de <> quita comillas y acentos graves.
export function sanitizeAttr(value, max = 200) {
  return sanitizeText(value, max).replace(/["'`]/g, "");
}

// Solo deja pasar https:, rutas locales del sitio o imágenes base64 subidas desde el panel.
export function safeImageUrl(url, fallback) {
  const value = String(url || "").trim();
  if (!value) return fallback;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
  if (/^assets\/[\w\-./ ]+$/.test(value)) return encodeURI(value);
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "https:") return parsed.href.replace(/["'`<>]/g, encodeURIComponent);
  } catch {
    // URL inválida: se usa la imagen de respaldo
  }
  return fallback;
}

// Las fechas del calendario se capturan en hora de Parral (Chihuahua, UTC-6 sin horario de verano).
const PARRAL_OFFSET = "-06:00";

export function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // YYYY-MM-DD como fecha local: evita que el parseo en UTC mueva el día
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value, options = { dateStyle: "medium" }) {
  const date = toDate(value);
  if (!date) return "Fecha por definir";
  return new Intl.DateTimeFormat("es-MX", options).format(date);
}

export function formatTime(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
  if (!match) return "Hora por definir";
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "pm" : "am";
  return `${hours % 12 || 12}:${match[2]} ${suffix}`;
}

// Momento exacto de inicio de un juego (fecha + hora de Parral).
export function matchStart(match) {
  const date = typeof match.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(match.date) ? match.date : null;
  if (!date) {
    const parsed = toDate(match.date);
    return parsed;
  }
  const time = /^\d{1,2}:\d{2}$/.test(match.time || "") ? match.time.padStart(5, "0") : "23:59";
  return new Date(`${date}T${time}:00${PARRAL_OFFSET}`);
}

export function teamAbbr(name) {
  const clean = sanitizeText(name, 40).normalize("NFD").replace(/[̀-ͯ]/g, "");
  return (clean.replace(/[^a-z]/gi, "").slice(0, 3) || "---").toUpperCase();
}

export function youtubeEmbedUrl(url) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\.|^m\./, "");
    if (!["youtube.com", "youtu.be", "youtube-nocookie.com"].includes(host)) return "";
    if (parsed.pathname.startsWith("/embed/")) return `https://www.youtube.com${parsed.pathname}${parsed.search}`;
    const parts = parsed.pathname.split("/").filter(Boolean);
    const videoId = host === "youtu.be"
      ? parts[0]
      : parsed.searchParams.get("v") || (["live", "shorts"].includes(parts[0]) ? parts[1] : "");
    return videoId && /^[\w-]{6,20}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : "";
  } catch {
    return "";
  }
}

export function getGuestIdentity() {
  const key = "mineros_guest";
  let saved = null;
  try {
    saved = JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    saved = null;
  }
  if (saved?.id && saved?.name) return saved;
  const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const name = `Minero-${Math.floor(1000 + Math.random() * 9000)}`;
  const identity = { id, name };
  try {
    localStorage.setItem(key, JSON.stringify(identity));
  } catch {
    // Sin almacenamiento: la identidad dura solo esta visita
  }
  return identity;
}

export function setGuestName(name) {
  const identity = getGuestIdentity();
  const next = { ...identity, name: sanitizeText(name, 26) || identity.name };
  try {
    localStorage.setItem("mineros_guest", JSON.stringify(next));
  } catch {
    // Sin almacenamiento: el nombre dura solo esta visita
  }
  return next;
}
