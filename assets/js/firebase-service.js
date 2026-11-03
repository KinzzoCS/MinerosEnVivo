import { firebaseConfig, firebaseReady } from "./firebase-config.js";

// En localhost la app usa los emuladores de Firebase (datos locales, nunca producción).
// Para mirar datos reales desde localhost: ?datos=produccion   Para volver: ?datos=local
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];
const EMULATOR_PROJECT = "demo-mineros";
export const usingEmulators = LOCAL_HOSTS.includes(location.hostname) && readDataPreference() !== "produccion";

const emulatorConfig = {
  apiKey: "demo-key",
  authDomain: `${EMULATOR_PROJECT}.firebaseapp.com`,
  projectId: EMULATOR_PROJECT,
  appId: "demo-app"
};

let app;
let db;
let auth;
let firebaseModules;

// `auth: true` solo en el panel y la pizarra: la app pública no inicia sesión, así no carga Firebase Auth
// (menos peso y sin el iframe oculto que agrega). Auth se registra antes de Firestore para que las
// consultas del panel salgan con la sesión del admin.
export async function getFirebase({ auth: withAuth = false } = {}) {
  if (!usingEmulators && !firebaseReady) return null;
  if (firebaseModules) {
    if (withAuth && !firebaseModules.auth) console.warn("Firebase ya se inició sin Auth en esta página.");
    return firebaseModules;
  }

  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js");
  const authMod = withAuth ? await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js") : null;
  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js");

  app = appMod.initializeApp(usingEmulators ? emulatorConfig : firebaseConfig);
  if (authMod) {
    auth = authMod.getAuth(app);
    if (usingEmulators) authMod.connectAuthEmulator(auth, `http://${location.hostname}:9099`, { disableWarnings: true });
  }
  try {
    // Caché local: la app muestra el último calendario, resultados y noticias aunque no haya señal
    db = firestore.initializeFirestore(app, {
      localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() })
    });
  } catch (error) {
    console.warn("Caché sin conexión no disponible:", error);
    db = firestore.getFirestore(app);
  }
  if (usingEmulators) {
    firestore.connectFirestoreEmulator(db, location.hostname, 8180);
    showEmulatorBadge();
  }
  firebaseModules = { app, db, auth: auth || null, firestore, authMod };
  return firebaseModules;
}

function readDataPreference() {
  const key = "mineros_datos";
  try {
    const param = new URLSearchParams(location.search).get("datos");
    if (param === "produccion" || param === "local") localStorage.setItem(key, param);
    return localStorage.getItem(key) || "local";
  } catch {
    return "local";
  }
}

// Aviso visible para que nadie confunda los datos locales con los reales.
function showEmulatorBadge() {
  const add = () => {
    if (document.getElementById("aviso-emulador")) return;
    const badge = document.createElement("div");
    badge.id = "aviso-emulador";
    badge.textContent = "Datos locales (emulador)";
    badge.setAttribute("role", "status");
    badge.style.cssText = "position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 2px);z-index:99999;padding:4px 10px;border-radius:999px;background:#000;color:#fff;font:600 12px/1.4 system-ui,sans-serif;border:1px solid #fff;pointer-events:none;opacity:.85";
    document.body.append(badge);
  };
  if (document.body) add();
  else document.addEventListener("DOMContentLoaded", add, { once: true });
}
