import { getFirebase } from "../firebase-service.js";
import { qs } from "../utils.js";

const note = qs("#authNote");
const reasons = {
  permisos: "Esa cuenta no tiene permisos de administrador.",
  conexion: "No se pudo verificar tu acceso. Revisa la conexión e inténtalo de nuevo."
};
const reason = new URLSearchParams(location.search).get("error");
if (reasons[reason]) note.textContent = reasons[reason];

const firebase = await getFirebase({ auth: true });
if (!firebase) {
  note.textContent = "El panel no está disponible: falta configurar Firebase.";
} else {
  // Si ya hay sesión, entra directo (spec 002, CA-08)
  firebase.authMod.onAuthStateChanged(firebase.auth, user => {
    if (user && !reason) location.replace("dashboard.html");
  });
}

qs("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!firebase) return;
  const button = event.submitter || qs("#loginForm button[type=submit]");
  button.disabled = true;
  note.className = "aviso";
  note.textContent = "Entrando…";
  try {
    await firebase.authMod.signInWithEmailAndPassword(firebase.auth, qs("#email").value.trim(), qs("#password").value);
    location.replace("dashboard.html");
  } catch (error) {
    note.className = "aviso error";
    note.textContent = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(error?.code)
      ? "El correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo."
      : error?.code === "auth/too-many-requests"
        ? "Demasiados intentos. Espera unos minutos antes de volver a intentar."
        : "No se pudo iniciar sesión. Revisa la conexión e inténtalo de nuevo.";
    button.disabled = false;
  }
});
