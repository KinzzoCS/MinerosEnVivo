import { getFirebase } from "../firebase-service.js";
import { qs } from "../utils.js";

qs("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const firebase = await getFirebase();
  if (!firebase) {
    qs("#authNote").textContent = "Firebase no esta configurado todavia.";
    return;
  }
  try {
    await firebase.authMod.signInWithEmailAndPassword(firebase.auth, qs("#email").value, qs("#password").value);
    location.href = "dashboard.html";
  } catch (error) {
    qs("#authNote").textContent = "No se pudo iniciar sesion. Revisa credenciales y permisos.";
  }
});
