import { firebaseConfig, firebaseReady } from "./firebase-config.js";

let app;
let db;
let auth;
let firebaseModules;

export async function getFirebase() {
  if (!firebaseReady) return null;
  if (firebaseModules) return firebaseModules;

  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js");
  const firestore = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js");
  const authMod = await import("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js");

  app = appMod.initializeApp(firebaseConfig);
  try {
    // Caché local: la app muestra el último calendario, resultados y noticias aunque no haya señal
    db = firestore.initializeFirestore(app, {
      localCache: firestore.persistentLocalCache({ tabManager: firestore.persistentMultipleTabManager() })
    });
  } catch (error) {
    console.warn("Caché sin conexión no disponible:", error);
    db = firestore.getFirestore(app);
  }
  auth = authMod.getAuth(app);
  firebaseModules = { app, db, auth, firestore, authMod };
  return firebaseModules;
}
