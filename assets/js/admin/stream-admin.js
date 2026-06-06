import { requireAdmin } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) {
  const { db, firestore } = firebase;
  const ref = firestore.doc(db, "settings", "main");
  const snap = await firestore.getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    qs("#liveTitle").value = data.liveTitle || "";
    qs("#liveStreamUrl").value = data.liveStreamUrl || "";
    qs("#liveStatus").checked = Boolean(data.liveStatus);
  }
  qs("#streamForm").addEventListener("submit", async event => {
    event.preventDefault();
    await firestore.setDoc(ref, {
      liveTitle: sanitizeText(qs("#liveTitle").value, 100),
      liveStreamUrl: sanitizeText(qs("#liveStreamUrl").value, 400),
      liveStatus: qs("#liveStatus").checked,
      updatedAt: firestore.serverTimestamp()
    }, { merge: true });
    qs("#formNote").textContent = "Stream actualizado.";
  });
}
