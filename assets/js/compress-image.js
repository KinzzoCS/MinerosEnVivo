// Reduce una imagen en el navegador antes de guardarla en Firestore (límite de 1 MB por documento).
// Para escudos usa mime "image/png" y conserva la transparencia.
export function compressImage(file, maxW = 800, quality = 0.7, mime = "image/jpeg") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > maxW) { height *= maxW / width; width = maxW; }
        canvas.width = Math.round(width); canvas.height = Math.round(height);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
