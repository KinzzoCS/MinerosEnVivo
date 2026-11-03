const INNINGS = 9;
const STORAGE_KEY = "pizarra_estado_v3";

const defaultTheme = {
  // Colores
  bg0:           "#000000",
  bg1:           "#000000",
  lineColor:     "#c0392b",
  digitColor:    "#f4f4f6",
  nameBoxColorA: "#000000",
  nameBoxColorB: "#000000",
  teamNameColor: "#ffffff",
  rheColor:      "#f4f4f6",
  bsoColor:      "#f4f7ff",
  sponsorBgColor: "#000000",
  // Fuentes
  fontFamily:    "Barlow Condensed",
  fontFamilyNum: "Quicksand",
  // Tamaños — pizarra inferior
  teamNameSize:  140,
  inningSize:    200,
  rheSize:       220,
  // Tamaños — panel BSO (superior derecho)
  bsoLabelSize:  72,
  bsoValueSize:  300,
  // Tamaño — labels C/H/E (fila cabecera)
  cheLabelSize:  90,
  teamLogoScale: 1,
  teamBoxWidth: 1500,
  // Estética extra
  lineThickness: 10,
  sponsorScaleX: 1,
  sponsorScaleY: 1,
  // Fila cabecera CHE (sólida)
  cheHeaderHeight: 120,
  cheHeaderBg:     "#1a1a1a",
  cheHeaderColor:  "#d9d9d9",
  cheHeaderFontSize: 90,
  // Brillo y opacidad
  markerOpacity:       40,   // 0-100  opacidad watermark números grandes
  headerMarkerOpacity: 100,  // 0-100  opacidad números header fila CHE
  headerMarkerSize:    70,   // px     tamaño números header
  headerMarkerColor:   "#ffffff", // color texto números header
  digitBrightness:     100,  // 0-200  brillo números pizarra
  textBrightness:      100,  // 0-200  brillo texto general
};

const defaultState = {
  teamA: "VISITANTE",
  teamB: "MINEROS",
  logoA: "",
  logoB: "",
  sponsorLogo: "",
  inningsA: Array(INNINGS).fill(null),
  inningsB: Array(INNINGS).fill(null),
  r: { a: 0, b: 0 },
  h: { a: 0, b: 0 },
  e: { a: 0, b: 0 },
  balls: 0,
  strikes: 0,
  outs: 0,
  inning: 1,
  half: "ALTA",
  bases: { 1: false, 2: false, 3: false },
  showInningMarkers: true,
  theme: { ...defaultTheme }
};

let state = loadState();
let lastSyncedRaw = localStorage.getItem(STORAGE_KEY) || "";
let syncChannel = null;
let themeSaveTimer = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const normalizeInnings = (arr) => {
      if (!Array.isArray(arr)) return Array(INNINGS).fill(null);
      const normalized = arr.map((v) => Number.isInteger(v) ? clamp(v, 0, 99) : null);
      if (normalized.length < INNINGS) {
        return normalized.concat(Array(INNINGS - normalized.length).fill(null));
      }
      return normalized.slice(0, INNINGS);
    };
    const toInt = (v, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) ? clamp(Math.trunc(n), min, max) : min;
    };
    return {
      ...defaultState,
      ...parsed,
      logoA: typeof parsed.logoA === "string" ? parsed.logoA : "",
      logoB: typeof parsed.logoB === "string" ? parsed.logoB : "",
      sponsorLogo: typeof parsed.sponsorLogo === "string" ? parsed.sponsorLogo : "",
      inningsA: normalizeInnings(parsed.inningsA),
      inningsB: normalizeInnings(parsed.inningsB),
      r: { a: toInt(parsed?.r?.a ?? defaultState.r.a, 0, 999), b: toInt(parsed?.r?.b ?? defaultState.r.b, 0, 999) },
      h: { a: toInt(parsed?.h?.a ?? defaultState.h.a, 0, 999), b: toInt(parsed?.h?.b ?? defaultState.h.b, 0, 999) },
      e: { a: toInt(parsed?.e?.a ?? defaultState.e.a, 0, 999), b: toInt(parsed?.e?.b ?? defaultState.e.b, 0, 999) },
      bases: { ...defaultState.bases, ...(parsed.bases || {}) },
      theme: { ...defaultTheme, ...(parsed.theme || {}) }
    };
  } catch {
    return { ...defaultState };
  }
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function ensureInningsCapacity(index) {
  const needed = index + 1;
  while (state.inningsA.length < needed) state.inningsA.push(null);
  while (state.inningsB.length < needed) state.inningsB.push(null);
}
const saveState = () => {
  const persistState = {
    ...state,
    logoA: "",
    logoB: "",
    sponsorLogo: ""
  };
  const raw = JSON.stringify(persistState);
  try {
    localStorage.setItem(STORAGE_KEY, raw);
    lastSyncedRaw = raw;
  } catch {
    // Ignore write failures; do not block user interaction.
  }
  try {
    syncChannel?.postMessage({ key: STORAGE_KEY, raw, state });
  } catch {}
};
const byId = (id) => document.getElementById(id);
const isActivelyEditing = (el) => document.activeElement === el;
const syncInputValue = (id, value) => {
  const el = byId(id);
  if (!el || isActivelyEditing(el)) return;
  const next = String(value);
  if (el.value !== next) el.value = next;
};

function recalcRuns() {
  state.r.a = state.inningsA.reduce((sum, v) => sum + (Number.isInteger(v) ? v : 0), 0);
  state.r.b = state.inningsB.reduce((sum, v) => sum + (Number.isInteger(v) ? v : 0), 0);
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderInningsRow(id, arr) {
  const c = byId(id);
  if (!c) return;
  c.innerHTML = "";
  arr.forEach((v) => {
    const cell = document.createElement("div");
    cell.className = "inning-cell";
    cell.textContent = Number.isInteger(v) ? String(v) : "-";
    c.appendChild(cell);
  });
}

function renderMarkers(start = 0) {
  const markers = byId("inningMarkers");
  if (!markers) return;
  markers.innerHTML = "";
  for (let i = 0; i < INNINGS; i++) {
    const d = document.createElement("div");
    d.className = "inning-num";
    d.textContent = start + i + 1;
    markers.appendChild(d);
  }
}

function renderHeaderMarkers(start = 0) {
  const row = document.querySelector(".innings-che-header-row");
  if (!row) return;
  row.innerHTML = "";
  for (let i = 0; i < INNINGS; i++) {
    const d = document.createElement("div");
    d.className = "header-inning-num";
    d.textContent = start + i + 1;
    row.appendChild(d);
  }
}

function renderControls(windowStart = 0) {
  const inningsControls = byId("inningsControls");
  if (!inningsControls) return;
  inningsControls.innerHTML = "";
  const table = document.createElement("div");
  table.className = "inning-table";

  const head = document.createElement("div");
  head.className = "inning-table-row head";
  head.innerHTML = `<span>Eq</span>${Array.from({ length: INNINGS }, (_, i) => `<span>${windowStart + i + 1}</span>`).join("")}`;
  table.appendChild(head);

  const rowA = document.createElement("div");
  rowA.className = "inning-table-row";
  rowA.innerHTML = `<span>VIS</span>${Array.from({ length: INNINGS }, (_, i) => {
    const index = windowStart + i;
    return `
    <div class="it-cell">
      <button data-inning="${index}" data-team="a" data-delta="1">+</button>
      <span id="ctlA-${index}">0</span>
      <button data-inning="${index}" data-team="a" data-delta="-1">-</button>
    </div>`;
  }).join("")}`;
  table.appendChild(rowA);

  const rowB = document.createElement("div");
  rowB.className = "inning-table-row";
  rowB.innerHTML = `<span>LOC</span>${Array.from({ length: INNINGS }, (_, i) => {
    const index = windowStart + i;
    return `
    <div class="it-cell">
      <button data-inning="${index}" data-team="b" data-delta="1">+</button>
      <span id="ctlB-${index}">0</span>
      <button data-inning="${index}" data-team="b" data-delta="-1">-</button>
    </div>`;
  }).join("")}`;
  table.appendChild(rowB);

  inningsControls.appendChild(table);

  inningsControls.querySelectorAll("button").forEach((btn) => {
  btn.onclick = () => {
    const i = Number(btn.dataset.inning);
    const target = btn.dataset.team === "a" ? state.inningsA : state.inningsB;
    ensureInningsCapacity(i);

    const delta = Number(btn.dataset.delta);
    const current = Number.isInteger(target[i]) ? target[i] : null;

    // ── VACÍO (-) → empieza en 0 ─────────────────────
    if (current === null && delta > 0) {
      target[i] = 0;
    }

    // ── 0 → vuelve a vacío (-) ───────────────────────
    else if (current === 0 && delta < 0) {
      target[i] = null;
    }

    // ── si está vacío y presionan - no hace nada ─────
    else if (current === null && delta < 0) {
      target[i] = null;
    }

    // ── comportamiento normal ────────────────────────
    else {
      const base = current === null ? 0 : current;
      target[i] = clamp(base + delta, 0, 99);
    }

    render();
  };
  });

  const rheControls = byId("rheControls");
  if (!rheControls) return;
  rheControls.innerHTML = "";
  ["h", "e"].forEach((stat) => {
    const row = document.createElement("div");
    row.className = "control-row";
    row.innerHTML = `
      <strong>${stat.toUpperCase()}</strong>
      <div class="btn-row">
        <button data-stat="${stat}" data-team="a" data-delta="-1">Vis -</button>
        <button data-stat="${stat}" data-team="a" data-delta="1">Vis +</button>
      </div>
      <div class="btn-row">
        <button data-stat="${stat}" data-team="b" data-delta="-1">Loc -</button>
        <button data-stat="${stat}" data-team="b" data-delta="1">Loc +</button>
      </div>`;
    rheControls.appendChild(row);
  });

  rheControls.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => {
      const stat = btn.dataset.stat;
      const team = btn.dataset.team;
      state[stat][team] = clamp(state[stat][team] + Number(btn.dataset.delta), 0, 999);
      render();
    };
  });
}

function applyTheme() {
  const t = state.theme;
  const px = (v, fallback) => `${Number.isFinite(Number(v)) ? Number(v) : fallback}px`;

  // ── Colores ──────────────────────────────────────────
  document.documentElement.style.setProperty("--bg-0",          t.bg0          || "#09090f");
  document.documentElement.style.setProperty("--bg-1",          t.bg1          || "#1a1220");
  document.documentElement.style.setProperty("--line",          t.lineColor    || "#f3c640");
  document.documentElement.style.setProperty("--digit",         t.digitColor   || "#f4f4f6");
  document.documentElement.style.setProperty("--name-box-a",    t.nameBoxColorA|| "#2e2538");
  document.documentElement.style.setProperty("--name-box-b",    t.nameBoxColorB|| "#2e2538");
  document.documentElement.style.setProperty("--team-name-color",t.teamNameColor||"#ffffff");
  document.documentElement.style.setProperty("--rhe-color",     t.rheColor     || "#f4f4f6");
  document.documentElement.style.setProperty("--count-color",   t.bsoColor     || "#f4f7ff");
  document.documentElement.style.setProperty("--sponsor-bg",   t.sponsorBgColor|| "#ffffff");

  // ── Fuentes ──────────────────────────────────────────
  document.documentElement.style.setProperty("--font-main",
    `"${t.fontFamily || "Barlow Condensed"}", sans-serif`);
  document.documentElement.style.setProperty("--font-num",
    `"${t.fontFamilyNum || "Quicksand"}", sans-serif`);

  // ── Tamaños — franja inferior ─────────────────────────
  document.documentElement.style.setProperty("--team-name-size", px(t.teamNameSize, 140));
  document.documentElement.style.setProperty("--inning-size",    px(t.inningSize,   200));
  document.documentElement.style.setProperty("--rhe-size",       px(t.rheSize,      220));

  // ── Tamaños — panel BSO ───────────────────────────────
  document.documentElement.style.setProperty("--bso-label-size", px(t.bsoLabelSize, 72));
  document.documentElement.style.setProperty("--bso-value-size", px(t.bsoValueSize, 300));

  // ── Tamaños — columna C/H/E ───────────────────────────
  document.documentElement.style.setProperty("--che-label-size", px(t.cheLabelSize, 90));
  document.documentElement.style.setProperty("--team-logo-scale", Number.isFinite(Number(t.teamLogoScale)) ? Number(t.teamLogoScale) : 1);
  document.documentElement.style.setProperty("--team-col-width", px(t.teamBoxWidth, 1500));

  // ── Estética extra ───────────────────────────────────────────────
  document.documentElement.style.setProperty("--line-thickness", px(t.lineThickness, 6));
  document.documentElement.style.setProperty("--sponsor-scale-x", Number.isFinite(Number(t.sponsorScaleX)) ? Number(t.sponsorScaleX) : 1);
  document.documentElement.style.setProperty("--sponsor-scale-y", Number.isFinite(Number(t.sponsorScaleY)) ? Number(t.sponsorScaleY) : 1);

  // ── Fila cabecera CHE (sólida) ─────────────────────────────────────────
  document.documentElement.style.setProperty("--che-header-height",    px(t.cheHeaderHeight, 120));
  document.documentElement.style.setProperty("--che-header-bg",        t.cheHeaderBg     || "#1a1a1a");
  document.documentElement.style.setProperty("--che-header-color",     t.cheHeaderColor  || "#d9d9d9");
  document.documentElement.style.setProperty("--che-header-font-size", px(t.cheHeaderFontSize, 90));
  document.documentElement.style.setProperty("--header-marker-size",  px(t.headerMarkerSize, 70));
  document.documentElement.style.setProperty("--header-marker-color", t.headerMarkerColor || "#ffffff");

  // ── Brillo y opacidad ────────────────────────────────────────────
  const markerOp = Number.isFinite(Number(t.markerOpacity)) ? clamp(Number(t.markerOpacity), 0, 100) : 40;
  document.documentElement.style.setProperty("--marker-opacity",   (markerOp / 100).toFixed(2));
  const hdrMarkerOp = Number.isFinite(Number(t.headerMarkerOpacity)) ? clamp(Number(t.headerMarkerOpacity), 0, 100) : 100;
  document.documentElement.style.setProperty("--header-marker-opacity", (hdrMarkerOp / 100).toFixed(2));
  const digBr = Number.isFinite(Number(t.digitBrightness)) ? clamp(Number(t.digitBrightness), 0, 200) : 100;
  document.documentElement.style.setProperty("--digit-brightness",  (digBr / 100).toFixed(2));
  const txtBr = Number.isFinite(Number(t.textBrightness)) ? clamp(Number(t.textBrightness), 0, 200) : 100;
  document.documentElement.style.setProperty("--text-brightness",   (txtBr / 100).toFixed(2));

  // ── Sync inputs del panel de control ─────────────────────────
  syncInputValue("bg0",          t.bg0);
  syncInputValue("bg1",          t.bg1);
  syncInputValue("lineColor",    t.lineColor);
  syncInputValue("digitColor",   t.digitColor);
  syncInputValue("nameBoxColorA",t.nameBoxColorA);
  syncInputValue("nameBoxColorB",t.nameBoxColorB);
  syncInputValue("teamNameColor",t.teamNameColor);
  syncInputValue("rheColor",     t.rheColor);
  syncInputValue("bsoColor",     t.bsoColor);
  syncInputValue("sponsorBgColor", t.sponsorBgColor);
  document.querySelectorAll('#fontSelect .font-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === t.fontFamily));
  document.querySelectorAll('#fontSelectNum .font-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.value === t.fontFamilyNum));
  syncInputValue("teamNameSize", t.teamNameSize);
  syncInputValue("inningSize",   t.inningSize);
  syncInputValue("rheSize",      t.rheSize);
  syncInputValue("bsoLabelSize", t.bsoLabelSize);
  syncInputValue("bsoValueSize", t.bsoValueSize);
  syncInputValue("cheLabelSize", t.cheLabelSize);
  syncInputValue("teamLogoScale", t.teamLogoScale);
  syncInputValue("teamBoxWidth", t.teamBoxWidth);
  syncInputValue("lineThickness", t.lineThickness);
  syncInputValue("sponsorScaleX", t.sponsorScaleX);
  syncInputValue("sponsorScaleY", t.sponsorScaleY);
  syncInputValue("cheHeaderHeight", t.cheHeaderHeight);
  syncInputValue("cheHeaderBg", t.cheHeaderBg);
  syncInputValue("cheHeaderColor", t.cheHeaderColor);
  syncInputValue("cheHeaderFontSize", t.cheHeaderFontSize);
  syncInputValue("cheHeaderBgOpacity", t.cheHeaderBgOpacity);
  syncInputValue("markerOpacity", t.markerOpacity);
  syncInputValue("headerMarkerSize", t.headerMarkerSize);
  syncInputValue("headerMarkerOpacity", t.headerMarkerOpacity);
  syncInputValue("headerMarkerColor", t.headerMarkerColor);
  syncInputValue("digitBrightness", t.digitBrightness);
  syncInputValue("textBrightness", t.textBrightness);

  // ── Sync color swatches ──────────────────────────────
  document.querySelectorAll('.custom-color').forEach(w => {
    const inp = w.querySelector('input[type="text"]');
    const sw = w.querySelector('.color-swatch');
    if (inp && sw) sw.style.background = inp.value || "#000000";
  });
}

function renderLogos() {
  const imgA = byId("teamALogo");
  const imgB = byId("teamBLogo");
  const textA = byId("teamANameText");
  const textB = byId("teamBNameText");
  const cellA = byId("teamANameCell");
  const cellB = byId("teamBNameCell");

  if (imgA) {
    imgA.src = state.logoA || "";
    imgA.style.opacity = state.logoA ? "1" : "0";
  }
  if (imgB) {
    imgB.src = state.logoB || "";
    imgB.style.opacity = state.logoB ? "1" : "0";
  }
  if (textA) textA.style.display = state.logoA ? "none" : "flex";
  if (textB) textB.style.display = state.logoB ? "none" : "flex";
  if (cellA) cellA.classList.toggle("has-logo", !!state.logoA);
  if (cellB) cellB.classList.toggle("has-logo", !!state.logoB);

  // Logo patrocinador en la pizarra
  const sponsor = byId("sponsorLogo");
  if (sponsor) {
    sponsor.src = state.sponsorLogo || "";
    sponsor.style.display = state.sponsorLogo ? "block" : "none";
  }

  // Preview en el panel de control
  const preview = byId("sponsorPreview");
  if (preview) {
    preview.src = state.sponsorLogo || "";
    preview.style.display = state.sponsorLogo ? "block" : "none";
  }

  const previewA = byId("logoAPreview");
  if (previewA) {
    previewA.src = state.logoA || "";
    previewA.style.display = state.logoA ? "block" : "none";
  }
  const previewB = byId("logoBPreview");
  if (previewB) {
    previewB.src = state.logoB || "";
    previewB.style.display = state.logoB ? "block" : "none";
  }
}

function scaleStage() {
  const stage = byId("scoreboard-stage");
  const wrap = document.querySelector(".stage-scale");
  if (!stage || !wrap) return;
  const scale = wrap.clientWidth / 8000;
  stage.style.transform = `scale(${scale})`;
  wrap.style.height = `${1575 * scale}px`;
}

function render(shouldSave = true) {
  recalcRuns();

  if (byId("teamANameText")) byId("teamANameText").textContent = state.teamA;
  if (byId("teamBNameText")) byId("teamBNameText").textContent = state.teamB;
  if (byId("inputTeamA")) byId("inputTeamA").value = state.teamA;
  if (byId("inputTeamB")) byId("inputTeamB").value = state.teamB;

  ensureInningsCapacity(state.inning - 1);
  const windowStart = Math.max(0, Math.max(state.inningsA.length, state.inningsB.length) - INNINGS);
  const visibleA = state.inningsA.slice(windowStart);
  const visibleB = state.inningsB.slice(windowStart);
  while (visibleA.length < INNINGS) visibleA.push(null);
  while (visibleB.length < INNINGS) visibleB.push(null);
  renderInningsRow("teamAInnings", visibleA);
  renderInningsRow("teamBInnings", visibleB);
  renderControls(windowStart);
  renderLogos();
  for (let i = 0; i < INNINGS; i++) {
    const idx = windowStart + i;
    const a = Number.isInteger(state.inningsA[idx]) ? state.inningsA[idx] : "-";
    const b = Number.isInteger(state.inningsB[idx]) ? state.inningsB[idx] : "-";
    const ctlA = document.getElementById(`ctlA-${idx}`);
    const ctlB = document.getElementById(`ctlB-${idx}`);
    if (ctlA) ctlA.textContent = String(a);
    if (ctlB) ctlB.textContent = String(b);
  }
  renderMarkers(windowStart);
  renderHeaderMarkers(windowStart);

  if (byId("teamAR")) byId("teamAR").textContent = state.r.a;
  if (byId("teamAH")) byId("teamAH").textContent = state.h.a;
  if (byId("teamAE")) byId("teamAE").textContent = state.e.a;
  if (byId("teamBR")) byId("teamBR").textContent = state.r.b;
  if (byId("teamBH")) byId("teamBH").textContent = state.h.b;
  if (byId("teamBE")) byId("teamBE").textContent = state.e.b;

  if (byId("statusInning")) byId("statusInning").textContent = state.inning;
  if (byId("statusHalf")) byId("statusHalf").textContent = state.half;
  if (byId("statusBalls")) byId("statusBalls").textContent = state.balls;
  if (byId("statusStrikes")) byId("statusStrikes").textContent = state.strikes;
  if (byId("statusOuts")) byId("statusOuts").textContent = state.outs;

  if (byId("ballsVal")) byId("ballsVal").textContent = state.balls;
  if (byId("strikesVal")) byId("strikesVal").textContent = state.strikes;
  if (byId("outsVal")) byId("outsVal").textContent = state.outs;
  if (byId("inningVal")) byId("inningVal").textContent = state.inning;
  if (byId("halfVal")) byId("halfVal").textContent = state.half;

  [1, 2, 3].forEach((b) => {
    const on = !!state.bases[b];
    document.getElementById(`base${b}`)?.classList.toggle("active", on);
    document.querySelector(`.base-toggle[data-base='${b}']`)?.classList.toggle("active", on);
  });

  applyTheme();

  // Watermark markers — actualizar opacidad visual
  const markers = byId("inningMarkers");
  if (markers) {
    // La opacidad ya se aplica vía CSS var --marker-opacity en applyTheme
    // Solo limpiar clase legacy si existiese
    markers.classList.remove("hidden-markers");
  }

  if (shouldSave) saveState();
  scaleStage();
}

function scheduleThemeSave() {
  if (themeSaveTimer) clearTimeout(themeSaveTimer);
  themeSaveTimer = setTimeout(() => {
    saveState();
    themeSaveTimer = null;
  }, 80);
}

function applyThemeLive() {
  applyTheme();
  scheduleThemeSave();
}

function attachEvents() {
  if (byId("inputTeamA")) byId("inputTeamA").oninput = (e) => { state.teamA = e.target.value.toUpperCase(); render(); };
  if (byId("inputTeamB")) byId("inputTeamB").oninput = (e) => { state.teamB = e.target.value.toUpperCase(); render(); };

  if (byId("logoAInput")) byId("logoAInput").onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.logoA = await fileToDataUrl(file);
    render();
  };

  if (byId("logoBInput")) byId("logoBInput").onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.logoB = await fileToDataUrl(file);
    render();
  };

  if (byId("sponsorLogoInput")) byId("sponsorLogoInput").onchange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.sponsorLogo = await fileToDataUrl(file);
    render();
  };

  if (byId("clearSponsor")) byId("clearSponsor").onclick = () => {
    state.sponsorLogo = "";
    const inp = byId("sponsorLogoInput");
    if (inp) inp.value = "";
    render();
  };

  if (byId("clearLogoA")) byId("clearLogoA").onclick = () => {
    state.logoA = "";
    const inp = byId("logoAInput");
    if (inp) inp.value = "";
    render();
  };
  if (byId("clearLogoB")) byId("clearLogoB").onclick = () => {
    state.logoB = "";
    const inp = byId("logoBInput");
    if (inp) inp.value = "";
    render();
  };

  document.querySelectorAll("[data-op]").forEach((btn) => {
    btn.onclick = () => {
      const key = btn.dataset.op;
      const max = key === "outs" ? 2 : key === "strikes" ? 2 : 3;
      state[key] = clamp(state[key] + Number(btn.dataset.delta), 0, max);
      render();
    };
  });

  if (byId("prevInning")) byId("prevInning").onclick = () => {
    const maxInning = Math.max(state.inningsA.length, state.inningsB.length, state.inning, INNINGS);
    state.inning = clamp(state.inning - 1, 1, maxInning);
    render();
  };
  if (byId("nextInning")) byId("nextInning").onclick = () => {
    const maxInning = Math.max(state.inningsA.length, state.inningsB.length, state.inning, INNINGS);
    state.inning = clamp(state.inning + 1, 1, maxInning);
    render();
  };
  if (byId("toggleHalf")) byId("toggleHalf").onclick = () => {
    state.half = state.half === "ALTA" ? "BAJA" : "ALTA";
    render();
  };

  document.querySelectorAll(".base-toggle").forEach((btn) => {
    btn.onclick = () => {
      const b = Number(btn.dataset.base);
      state.bases[b] = !state.bases[b];
      render();
    };
  });

  if (byId("clearBases")) byId("clearBases").onclick = () => { state.bases = { 1: false, 2: false, 3: false }; render(); };
  if (byId("resetCount")) byId("resetCount").onclick = () => { state.balls = 0; state.strikes = 0; state.outs = 0; render(); };

  if (byId("newHalfInning")) byId("newHalfInning").onclick = () => {
    state.balls = 0;
    state.strikes = 0;
    state.outs = 0;
    state.bases = { 1: false, 2: false, 3: false };
    const nextHalf = state.half === "ALTA" ? "BAJA" : "ALTA";
    state.half = nextHalf;
    if (state.half === "ALTA") {
      state.inning = state.inning + 1;
      ensureInningsCapacity(state.inning - 1);
    }
    render();
  };

  if (byId("newGame")) byId("newGame").onclick = () => {
    state = {
      ...defaultState,
      theme: { ...state.theme },
      logoA: state.logoA,
      logoB: state.logoB,
      inningsA: Array(INNINGS).fill(null),
      inningsB: Array(INNINGS).fill(null)
    };
    render();
  };

  // Colores
  ["bg0","bg1","lineColor","digitColor","nameBoxColorA","nameBoxColorB",
   "teamNameColor","rheColor","bsoColor","sponsorBgColor","cheHeaderBg","cheHeaderColor",
   "headerMarkerColor"].forEach((id) => {
    if (!byId(id)) return;
    byId(id).oninput = (e) => { state.theme[id] = e.target.value; applyThemeLive(); };
  });

  // Tamaños numéricos (incluyendo brillo y opacidad)
  ["teamNameSize","inningSize","rheSize","bsoLabelSize","bsoValueSize","cheLabelSize",
   "teamLogoScale","teamBoxWidth","lineThickness","sponsorScaleX","sponsorScaleY",
   "cheHeaderHeight","cheHeaderFontSize",
   "markerOpacity","headerMarkerOpacity","headerMarkerSize",
   "digitBrightness","textBrightness"].forEach((id) => {
    if (!byId(id)) return;
    byId(id).oninput = (e) => { state.theme[id] = Number(e.target.value); applyThemeLive(); };
  });

  document.querySelectorAll('#fontSelect .font-btn').forEach(btn => {
    btn.onclick = () => { state.theme.fontFamily = btn.dataset.value; applyThemeLive(); };
  });
  document.querySelectorAll('#fontSelectNum .font-btn').forEach(btn => {
    btn.onclick = () => { state.theme.fontFamilyNum = btn.dataset.value; applyThemeLive(); };
  });

  window.addEventListener("resize", scaleStage);
}

function setupDrawCanvas() {
  const canvas = document.getElementById("drawCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const colorInput = document.getElementById("drawColor");
  const sizeInput = document.getElementById("drawSize");
  const clearBtn = document.getElementById("clearDraw");

  let drawing = false;

  function getPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const x = (evt.clientX - rect.left) * (canvas.width / rect.width);
    const y = (evt.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  }

  function start(evt) {
    drawing = true;
    const p = getPos(evt);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function move(evt) {
    if (!drawing) return;
    const p = getPos(evt);
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = Number(sizeInput.value);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stop() {
    drawing = false;
    ctx.closePath();
  }

  canvas.addEventListener("pointerdown", start);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointerleave", stop);
  clearBtn?.addEventListener("click", () => ctx.clearRect(0, 0, canvas.width, canvas.height));
}

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  const prevLogos = { logoA: state.logoA, logoB: state.logoB, sponsorLogo: state.sponsorLogo };
  state = loadState();
  if (!state.logoA && prevLogos.logoA) state.logoA = prevLogos.logoA;
  if (!state.logoB && prevLogos.logoB) state.logoB = prevLogos.logoB;
  if (!state.sponsorLogo && prevLogos.sponsorLogo) state.sponsorLogo = prevLogos.sponsorLogo;
  lastSyncedRaw = localStorage.getItem(STORAGE_KEY) || "";
  render(false);
});

function setupCrossTabSync() {
  try {
    syncChannel = new BroadcastChannel("pizarra_sync_channel");
    syncChannel.onmessage = (event) => {
      if (!event?.data || event.data.key !== STORAGE_KEY) return;
      const incomingState = event.data.state && typeof event.data.state === "object" ? event.data.state : null;
      const incomingRaw = typeof event.data.raw === "string" ? event.data.raw : "";
      if (incomingState) {
        const current = loadState();
        state = { ...current, ...incomingState };
        lastSyncedRaw = incomingRaw || lastSyncedRaw;
        render(false);
        return;
      }
      if (incomingRaw && incomingRaw !== lastSyncedRaw) {
        try {
          const parsed = JSON.parse(incomingRaw);
          const current = loadState();
          state = { ...current, ...parsed };
          lastSyncedRaw = incomingRaw;
          render(false);
          return;
        } catch {}
      }
      const raw = localStorage.getItem(STORAGE_KEY) || "";
      if (!raw || raw === lastSyncedRaw) return;
      const prevLogos = { logoA: state.logoA, logoB: state.logoB, sponsorLogo: state.sponsorLogo };
      state = loadState();
      if (!state.logoA && prevLogos.logoA) state.logoA = prevLogos.logoA;
      if (!state.logoB && prevLogos.logoB) state.logoB = prevLogos.logoB;
      if (!state.sponsorLogo && prevLogos.sponsorLogo) state.sponsorLogo = prevLogos.sponsorLogo;
      lastSyncedRaw = raw;
      render(false);
    };
  } catch {}

  setInterval(() => {
    const raw = localStorage.getItem(STORAGE_KEY) || "";
    if (!raw || raw === lastSyncedRaw) return;
    const prevLogos = { logoA: state.logoA, logoB: state.logoB, sponsorLogo: state.sponsorLogo };
    state = loadState();
    if (!state.logoA && prevLogos.logoA) state.logoA = prevLogos.logoA;
    if (!state.logoB && prevLogos.logoB) state.logoB = prevLogos.logoB;
    if (!state.sponsorLogo && prevLogos.sponsorLogo) state.sponsorLogo = prevLogos.sponsorLogo;
    lastSyncedRaw = raw;
    render(false);
  }, 300);
}

renderMarkers();
renderControls();
attachEvents();
setupDrawCanvas();
setupCrossTabSync();
render();


/* Firmado por Alan Flores para Estadio Mineros de Parral  al dia 19-05-2026 a las 12:15 P.M.*/