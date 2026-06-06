Despliegue en GitHub Pages

1. Crear repositorio en GitHub y subir el proyecto a la rama `main`.

2. En GitHub > Settings > Secrets and variables > Actions, crea estos secretos:

FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID

3. El workflow `.github/workflows/deploy-github-pages.yml` genera `assets/js/firebase-config.js` desde esos secretos antes de publicar.

4. Seguridad local: nunca incluyas credenciales en el repo. Si ya las tenías en `assets/js/firebase-config.js`, elimina el archivo del índice antes de push:

```bash
git rm --cached assets/js/firebase-config.js
git commit -m "Remove local firebase credentials"
```

5. Opcional: para desarrollo local crea `assets/js/firebase-config.js` basado en `assets/js/firebase-config.example.js` y abre un servidor estático:

```bash
python -m http.server 8080
# luego visita http://localhost:8080
```

6. Si deseas limpiar historial de commits para eliminar la clave pública, usa herramientas como `git filter-repo` o `git filter-branch` (cuidado con reescribir historial público).

7. Tras configurar los secretos y push a `main`, GitHub Actions publicará el sitio en Pages automáticamente.
