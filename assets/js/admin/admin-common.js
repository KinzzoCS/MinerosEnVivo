import { getFirebase } from "../firebase-service.js";
import { sanitizeText } from "../utils.js";

export async function requireAdmin() {
  renderNav();
  bindLogout();
  const firebase = await getFirebase();
  if (!firebase) {
    alert("Panel no disponible.");
    location.href = "index.html";
    return null;
  }
  const { auth, db, firestore, authMod } = firebase;
  return new Promise(resolve => {
    authMod.onAuthStateChanged(auth, async user => {
      if (!user) {
        location.href = "index.html";
        resolve(null);
        return;
      }
      const adminSnap = await firestore.getDoc(firestore.doc(db, "admins", user.uid));
      if (!adminSnap.exists()) {
        await authMod.signOut(auth);
        alert("Usuario sin permisos de administrador.");
        location.href = "index.html";
        resolve(null);
        return;
      }
      resolve(firebase);
    });
  });
}

export function renderNav() {
  document.querySelectorAll("[data-admin-nav]").forEach(target => {
    const current = location.pathname.split("/").pop();
    const links = [
      ["dashboard.html", "Dashboard"],
      ["stream.html", "Stream"],
      ["noticias.html", "Noticias"],
      ["jugadores.html", "Jugadores"],
      ["partidos.html", "Partidos"],
      ["chat.html", "Chat"]
    ];
    target.innerHTML = `<a class="brand" href="../index.html"><span class="brand-mark">MTV</span><span>Mineros TV</span></a><nav class="admin-nav">${links.map(([href, label]) => `<a class="${current === href ? "active" : ""}" href="${href}">${label}</a>`).join("")}</nav>`;
  });
}

export function bindLogout() {
  document.querySelectorAll("[data-logout]").forEach(button => {
    button.addEventListener("click", async () => {
      const firebase = await getFirebase();
      if (firebase) await firebase.authMod.signOut(firebase.auth);
      location.href = "index.html";
    });
  });
}

export function rowTemplate(title, subtitle, id) {
  return `<article class="admin-row" data-id="${id}">
    <div><strong>${sanitizeText(title, 100)}</strong><p class="meta">${sanitizeText(subtitle, 180)}</p></div>
    <div class="row-actions"><button class="ghost-button" data-edit="${id}">Editar</button><button class="danger-button" data-delete="${id}">Eliminar</button></div>
  </article>`;
}
