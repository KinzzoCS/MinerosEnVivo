// Sección Deportes (spec 001, CA-16): básquetbol encendido/apagado y nombre, liga y escudo de cada equipo.
import { errorText, imageField, notify, requireAdmin } from "./admin-common.js";
import { qs, sanitizeText } from "../utils.js";
import { SOCIAL_KEYS, SPORTS, sportsConfig } from "../sports.js";
import { safeLinkUrl } from "../utils.js";

const firebase = await requireAdmin();
if (firebase) {
  const { db, firestore } = firebase;
  const ref = firestore.doc(db, "settings", "deportes");
  const form = qs("#sportsForm");

  const crests = {};
  for (const sport of SPORTS) {
    crests[sport] = imageField({
      file: qs(`#escudoArchivo-${sport}`),
      url: qs(`#escudoUrl-${sport}`),
      preview: qs(`#escudoVista-${sport}`),
      clear: qs(`#escudoQuitar-${sport}`),
      maxW: 256, mime: "image/png", quality: 0.92
    });
  }

  const snap = await firestore.getDoc(ref);
  const config = sportsConfig(snap.exists() ? snap.data() : null);
  for (const sport of SPORTS) {
    qs(`#equipo-${sport}`).value = config[sport].equipo;
    qs(`#nombre-${sport}`).value = config[sport].nombre;
    qs(`#liga-${sport}`).value = config[sport].liga;
    crests[sport].set(config[sport].escudo);
    for (const key of SOCIAL_KEYS) qs(`#red-${sport}-${key}`).value = config[sport].redes[key];
  }
  for (const sport of SPORTS) qs(`#activo-${sport}`).checked = config[sport].activo;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const payload = { updatedAt: firestore.serverTimestamp() };
    for (const sport of SPORTS) {
      payload[sport] = {
        activo: qs(`#activo-${sport}`).checked,
        equipo: sanitizeText(qs(`#equipo-${sport}`).value, 30),
        nombre: sanitizeText(qs(`#nombre-${sport}`).value, 60),
        liga: sanitizeText(qs(`#liga-${sport}`).value, 60),
        escudo: crests[sport].value(),
        redes: Object.fromEntries(SOCIAL_KEYS.map(key => [key, safeLinkUrl(qs(`#red-${sport}-${key}`).value)]))
      };
      const bad = SOCIAL_KEYS.find(key => qs(`#red-${sport}-${key}`).value.trim() && !payload[sport].redes[key]);
      if (bad) {
        notify("#formNote", "Un enlace de redes no es válido: debe empezar con https://", "error");
        qs(`#red-${sport}-${bad}`).focus();
        return;
      }
    }
    const size = new Blob([JSON.stringify(payload)]).size;
    if (size > 900000) {
      notify("#formNote", "Los escudos pesan demasiado. Usa imágenes más pequeñas o pega una URL.", "error");
      return;
    }
    try {
      await firestore.setDoc(ref, payload, { merge: true });
      const on = SPORTS.filter(sport => payload[sport].activo).map(sport => sport === "beisbol" ? "béisbol" : "básquetbol");
      notify("#formNote", on.length === 2 ? "Deportes guardados. La app muestra béisbol y básquetbol."
        : on.length === 1 ? `Deportes guardados. La app solo muestra ${on[0]}.`
        : "Deportes guardados. Los dos deportes están apagados: la app muestra \"Volvemos pronto\".");
    } catch (error) {
      notify("#formNote", `No se pudo guardar: ${errorText(error)}`, "error");
    }
  });
}
