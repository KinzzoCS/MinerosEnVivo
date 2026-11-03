// Piezas comunes del panel admin (spec 002).
import { getFirebase } from "../firebase-service.js";
import { compressImage } from "../compress-image.js";
import { qs, safeImageUrl, sanitizeAttr, sanitizeText } from "../utils.js";
import { buildSeasonIndex, currentSeasonId, seasonOptions } from "../seasons.js";
import { activeSports, crestSrc, defaultSport, normalizeSport, SPORT_LABELS, SPORTS, sportsConfig, sportTagHtml } from "../sports.js";

const NAV = [
  ["dashboard.html", "Inicio"],
  ["stream.html", "Transmisiones"],
  ["deportes.html", "Deportes"],
  ["campeonatos.html", "Campeonatos"],
  ["partidos.html", "Calendario"],
  ["resultados.html", "Resultados"],
  ["jugadores.html", "Jugadores"],
  ["noticias.html", "Noticias"],
  ["chat.html", "Chat"],
  ["../pizarra/control.html", "Pizarra"]
];

// Verifica la sesión de admin. Sin sesión o sin permisos, regresa al inicio de sesión (CA-10).
export async function requireAdmin() {
  renderNav();
  bindLogout();
  const firebase = await getFirebase({ auth: true });
  if (!firebase) {
    document.body.classList.remove("cargando");
    qs(".panel-main").innerHTML = `<div class="tarjeta formulario"><h2>Panel no disponible</h2><p>La conexión con Firebase no está configurada.</p></div>`;
    return null;
  }
  const { auth, db, firestore, authMod } = firebase;
  return new Promise(resolve => {
    authMod.onAuthStateChanged(auth, async user => {
      if (!user) {
        location.replace("index.html");
        resolve(null);
        return;
      }
      try {
        const adminSnap = await firestore.getDoc(firestore.doc(db, "admins", user.uid));
        if (!adminSnap.exists()) {
          await authMod.signOut(auth);
          location.replace("index.html?error=permisos");
          resolve(null);
          return;
        }
      } catch {
        location.replace("index.html?error=conexion");
        resolve(null);
        return;
      }
      document.querySelectorAll("[data-admin-email]").forEach(el => { el.textContent = user.email || ""; });
      document.body.classList.remove("cargando");
      resolve({ ...firebase, user });
    });
  });
}

function renderNav() {
  const current = location.pathname.split("/").pop() || "dashboard.html";
  document.querySelectorAll("[data-admin-nav]").forEach(nav => {
    nav.innerHTML = NAV.map(([href, label]) => {
      const external = href.startsWith("../");
      const attrs = external ? ' target="_blank" rel="noopener"' : current === href ? ' aria-current="page"' : "";
      return `<a href="${href}"${attrs}>${label}${external ? '<span class="solo-lector"> (abre en otra pestaña)</span>' : ""}</a>`;
    }).join("");
  });
}

function bindLogout() {
  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", async () => {
      const firebase = await getFirebase({ auth: true });
      if (firebase) await firebase.authMod.signOut(firebase.auth);
      location.replace("index.html");
    });
  });
}

// Aviso de resultado de cada acción (CA-05).
export function notify(target, text, type = "ok") {
  const el = typeof target === "string" ? qs(target) : target;
  if (!el) return;
  el.textContent = text;
  el.className = `aviso ${type}`;
  clearTimeout(el._timer);
  if (type === "ok") el._timer = setTimeout(() => { el.textContent = ""; }, 6000);
}

export function errorText(error) {
  if (error?.code === "permission-denied") return "Firestore rechazó el cambio. Revisa que tu cuenta sea admin y que los datos sean válidos.";
  if (error?.code === "unavailable") return "Sin conexión. Inténtalo de nuevo cuando vuelva la señal.";
  return "Ocurrió un error inesperado. Inténtalo de nuevo.";
}

export function confirmDelete(what) {
  return confirm(`¿Borrar ${what}? Esto no se puede deshacer.`);
}

export function rowHtml({ id, title, subtitle = "", tags = [], actions = null }) {
  const buttons = actions ?? `
      <button class="boton boton-borde boton-chico" type="button" data-edit="${sanitizeAttr(id, 120)}">Editar</button>
      <button class="boton boton-peligro boton-chico" type="button" data-delete="${sanitizeAttr(id, 120)}">Borrar</button>`;
  return `
    <article class="fila tarjeta">
      <div class="fila-info">
        <strong>${sanitizeText(title, 120)}</strong>
        ${subtitle ? `<span>${sanitizeText(subtitle, 200)}</span>` : ""}
        ${tags.length ? `<span class="fila-etiquetas">${tags.join("")}</span>` : ""}
      </div>
      <div class="fila-acciones">${buttons}</div>
    </article>`;
}

export function emptyRowHtml(text) {
  return `<p class="tenue">${sanitizeText(text, 160)}</p>`;
}

// Configuración de deportes en vivo: avisa cada vez que cambia settings/deportes.
export function watchSportsConfig({ db, firestore }, callback) {
  return firestore.onSnapshot(firestore.doc(db, "settings", "deportes"),
    snap => callback(sportsConfig(snap.exists() ? snap.data() : null)),
    () => callback(sportsConfig(null)));
}

export function sportTag(sport) {
  return sportTagHtml(sport);
}

// Botones de opción para elegir deporte dentro de un formulario.
export function sportRadiosHtml(name, selected = "beisbol") {
  return `
    <fieldset class="grupo" data-campo-deporte>
      <legend>Deporte</legend>
      <div class="opciones opciones-2">
        ${SPORTS.map(sport => `<label><input type="radio" name="${name}" value="${sport}"${sport === selected ? " checked" : ""}><span>${SPORT_LABELS[sport]}</span></label>`).join("")}
      </div>
    </fieldset>`;
}

export function readSport(form, name = "sport") {
  return normalizeSport(form.querySelector(`input[name="${name}"]:checked`)?.value);
}

export function setSport(form, sport, name = "sport") {
  const input = form.querySelector(`input[name="${name}"][value="${normalizeSport(sport)}"]`);
  if (input) input.checked = true;
}

// Con un solo deporte activo no se pregunta el deporte: se usa ese (spec 003).
// Con los dos activos, o ninguno (fuera de temporada), el admin elige.
export function showSportField(config) {
  return activeSports(config).length !== 1;
}

export function formSport(form, config, name = "sport") {
  return showSportField(config) ? readSport(form, name) : defaultSport(config);
}

export function toggleSportFields(config) {
  const show = showSportField(config);
  const sport = defaultSport(config);
  document.querySelectorAll("[data-campo-deporte]").forEach(el => {
    el.hidden = !show;
    if (!show) el.querySelectorAll("input").forEach(input => { input.checked = input.value === sport || input.id === `sport-${sport}`; });
  });
}

// Filtro de listas: Todos, Béisbol, Básquetbol (CA-06).
export function mountListFilter(container, config, onChange) {
  if (!container) return "todos";
  const on = showSportField(config);
  container.hidden = !on;
  if (!container.dataset.bound) {
    container.dataset.bound = "1";
    container.innerHTML = `
      <div class="selector filtro-deporte" role="group" aria-label="Filtrar por deporte">
        <button type="button" data-filtro="todos" aria-pressed="true">Todos</button>
        ${SPORTS.map(s => `<button type="button" data-filtro="${s}" aria-pressed="false">${SPORT_LABELS[s]}</button>`).join("")}
      </div>`;
    container.addEventListener("click", event => {
      const button = event.target.closest("[data-filtro]");
      if (!button) return;
      container.querySelectorAll("[data-filtro]").forEach(b => b.setAttribute("aria-pressed", String(b === button)));
      onChange(button.dataset.filtro);
    });
  }
  if (!on) onChange("todos");
  return container.querySelector('[aria-pressed="true"]')?.dataset.filtro || "todos";
}

// Modo edición visible con botón para cancelar (CA-04).
export function editingState(form, { onCancel }) {
  const banner = document.createElement("div");
  banner.className = "editando";
  banner.hidden = true;
  banner.setAttribute("role", "status");
  banner.innerHTML = `<span data-texto></span><button type="button" class="boton boton-borde boton-chico">Cancelar edición</button>`;
  form.prepend(banner);
  banner.querySelector("button").addEventListener("click", () => {
    banner.hidden = true;
    onCancel();
  });
  return {
    start(text) {
      banner.querySelector("[data-texto]").textContent = text;
      banner.hidden = false;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    stop() { banner.hidden = true; }
  };
}

// Campo de imagen: subir archivo (se comprime) o pegar URL https. Devuelve el valor a guardar.
export function imageField({ file, url, preview, clear = null, maxW = 800, mime = "image/jpeg", quality = 0.7 }) {
  let uploaded = "";
  const showPreview = value => {
    const src = crestSrc(safeImageUrl(value, ""), "../");
    preview.hidden = !src;
    if (src) preview.src = src;
    else preview.removeAttribute("src");
  };
  file.addEventListener("change", async () => {
    const chosen = file.files[0];
    if (!chosen) return;
    uploaded = await compressImage(chosen, maxW, quality, mime);
    url.value = "";
    showPreview(uploaded);
  });
  url.addEventListener("input", () => {
    uploaded = "";
    file.value = "";
    showPreview(url.value.trim());
  });
  clear?.addEventListener("click", () => {
    uploaded = "";
    file.value = "";
    url.value = "";
    showPreview("");
  });
  return {
    value() {
      if (uploaded) return uploaded;
      const typed = url.value.trim();
      return typed ? safeImageUrl(typed, "") : "";
    },
    set(value) {
      uploaded = value?.startsWith("data:") ? value : "";
      url.value = value && !value.startsWith("data:") ? value : "";
      file.value = "";
      showPreview(value || "");
    },
    reset() { this.set(""); }
  };
}

export function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chihuahua", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

// Campeonatos y temporadas en vivo para los formularios (spec 003).
export function watchSeasons({ db, firestore }, callback) {
  let championships = [];
  let seasons = [];
  const emit = () => callback(buildSeasonIndex(championships, seasons), championships, seasons);
  firestore.onSnapshot(firestore.collection(db, "championships"), snap => {
    championships = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    emit();
  });
  firestore.onSnapshot(firestore.collection(db, "seasons"), snap => {
    seasons = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    emit();
  });
}

// Llena un <select> de temporada con las del deporte. Para registros nuevos propone la temporada en curso.
export function fillSeasonSelect(select, index, sport, selected = undefined) {
  const current = select.value;
  const options = seasonOptions(index, sport, []);
  const value = selected !== undefined ? selected : (options.some(o => o.id === current) ? current : currentSeasonId(index, sport) || "");
  select.innerHTML = `<option value="">Sin temporada</option>` +
    options.map(o => `<option value="${sanitizeAttr(o.id, 80)}">${sanitizeText(o.label, 100)}</option>`).join("");
  select.value = options.some(o => o.id === value) ? value : "";
}
