# Mineros TV

Plataforma web estatica para transmisiones de beisbol en vivo, noticias, roster, calendario, resultados, chat comunitario y panel administrativo.

## Stack

- HTML5, CSS3, Tailwind por CDN y JavaScript Vanilla.
- Firebase Authentication para administradores.
- Firestore para contenido, chat y configuracion.
- Imagenes por URL externa o archivos locales para mantener el proyecto en plan gratis.
- Cloudflare Pages, GitHub Pages o Firebase Hosting.

## Configuracion Firebase

1. Crea un proyecto en Firebase.
2. Habilita Authentication con proveedor correo/contrasena.
3. Crea Firestore en modo produccion.
4. No actives Storage si quieres mantener el proyecto sin pagos.
5. Copia la configuracion web en `assets/js/firebase-config.js` para desarrollo local.
6. Publica `firebase.rules` como reglas de Firestore.
7. Publica `firestore.indexes.json` para el indice de noticias destacadas.

Si usas Firebase CLI:

```bash
firebase init
firebase deploy --only firestore:rules,firestore:indexes
```

El archivo `firebase.json` ya apunta a las reglas e indices de este proyecto.

## Valores de Firebase

En Firebase Console abre Project settings > General > Your apps > Web app. Copia estos valores:

```js
apiKey
authDomain
projectId
storageBucket
messagingSenderId
appId
```

Para probar localmente, reemplaza los placeholders en:

```text
assets/js/firebase-config.js
```

Tambien puedes usar como referencia:

```text
assets/js/firebase-config.example.js
```

## Primer administrador

Las reglas no permiten crear administradores desde el cliente. Crea manualmente este documento en Firestore:

```text
admins/{UID_DEL_USUARIO}
```

El UID lo obtienes desde Firebase Authentication despues de crear el usuario admin. El documento puede contener:

```json
{
  "role": "admin",
  "createdAt": "manual"
}
```

## Colecciones

- `settings/main`: URL del stream, titulo y estado en vivo.
- `news`: noticias con titulo, resumen, contenido, URL de imagen y destacada.
- `players`: jugadores, posicion, numero, biografia y URL de foto.
- `matches`: proximos partidos.
- `results`: resultados recientes.
- `chatMessages`: mensajes de comunidad.
- `bannedWords`: palabras prohibidas para validacion basica.
- `mutedUsers`: usuarios temporales silenciados.
- `admins`: lista de UIDs autorizados.

## Desarrollo local

Abre `index.html` directamente en el navegador para revisar la version demo. Para probar Firebase, usa un servidor estatico local porque los modulos ES y las importaciones CDN funcionan mejor sobre HTTP.

```bash
python -m http.server 8080
```

Luego visita:

```text
http://localhost:8080
```

## Despliegue en GitHub Pages

El proyecto ya incluye un workflow en:

```text
.github/workflows/deploy-github-pages.yml
```

Pasos:

1. Sube el proyecto a un repositorio de GitHub.
2. En GitHub ve a Settings > Pages.
3. En Build and deployment selecciona Source: `GitHub Actions`.
4. En Settings > Secrets and variables > Actions crea estos secretos:

```text
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
```

5. Haz push a la rama `main`.
6. GitHub Actions generara `assets/js/firebase-config.js` con esos secretos y publicara el sitio.

En Firebase Authentication agrega el dominio de GitHub Pages en Authorized domains:

```text
TU_USUARIO.github.io
```

Si publicas como sitio de proyecto, la URL sera similar a:

```text
https://TU_USUARIO.github.io/NOMBRE_REPO/
```

## Despliegue en Cloudflare Pages

1. Sube este proyecto a GitHub.
2. En Cloudflare Pages crea un proyecto conectado al repositorio.
3. Framework preset: `None`.
4. Build command: vacio.
5. Output directory: `/`.
6. Despliega.

## Notas de seguridad

La V1 incluye sanitizacion en cliente, limite basico entre mensajes, palabras prohibidas, silenciado temporal y reglas que validan forma/tamano de mensajes. Para mantener todo en plan gratis, no se usa Firebase Storage; las imagenes se cargan mediante URL.
