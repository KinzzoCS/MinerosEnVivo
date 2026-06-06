import { requireAdmin } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) {
  const { db, firestore } = firebase;
  const ref = firestore.doc(db, "settings", "main");
  const snap = await firestore.getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    qs("#activeStream").value = data.activeStream || "1";
    qs("#liveTitle1").value = data.liveTitle1 || "";
    qs("#liveStreamUrl1").value = data.liveStreamUrl1 || "";
    qs("#liveStatus1").checked = Boolean(data.liveStatus1);
    qs("#liveTitle2").value = data.liveTitle2 || "";
    qs("#liveStreamUrl2").value = data.liveStreamUrl2 || "";
    qs("#liveStatus2").checked = Boolean(data.liveStatus2);
  }
  qs("#streamForm").addEventListener("submit", async event => {
    event.preventDefault();
    await firestore.setDoc(ref, {
      activeStream: qs("#activeStream").value,
      liveTitle1: sanitizeText(qs("#liveTitle1").value, 100),
      liveStreamUrl1: sanitizeText(qs("#liveStreamUrl1").value, 400),
      liveStatus1: qs("#liveStatus1").checked,
      liveTitle2: sanitizeText(qs("#liveTitle2").value, 100),
      liveStreamUrl2: sanitizeText(qs("#liveStreamUrl2").value, 400),
      liveStatus2: qs("#liveStatus2").checked,
      updatedAt: firestore.serverTimestamp()
    }, { merge: true });
    qs("#formNote").textContent = "Stream actualizado.";
  });
}
