export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function sanitizeText(value, max = 500) {
  return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function formatDate(value) {
  if (!value) return "Fecha por definir";
  let date;
  if (value.toDate) {
    date = value.toDate();
  } else if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    // Treat plain YYYY-MM-DD as a local date (avoid UTC parse that shifts day)
    const [y, m, d] = value.split("-").map(Number);
    date = new Date(y, m - 1, d);
  } else {
    date = new Date(value);
  }
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(date);
}

export function youtubeEmbedUrl(url) {
  if (!url) return "";
  if (url.includes("/embed/")) return url;
  try {
    const parsed = new URL(url);
    const videoId = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop();
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
  } catch {
    return url;
  }
}

export function getGuestIdentity() {
  const key = "mineros_guest";
  const saved = JSON.parse(localStorage.getItem(key) || "null");
  if (saved?.id && saved?.name) return saved;
  const id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const name = `Minero-${Math.floor(1000 + Math.random() * 9000)}`;
  const identity = { id, name };
  localStorage.setItem(key, JSON.stringify(identity));
  return identity;
}

export function setGuestName(name) {
  const identity = getGuestIdentity();
  const next = { ...identity, name: sanitizeText(name, 26) || identity.name };
  localStorage.setItem("mineros_guest", JSON.stringify(next));
  return next;
}
