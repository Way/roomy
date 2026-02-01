const MAX_DIMENSION = 4096;
const DEFAULT_DIMENSION = 2048;

export function isSvgDataUrl(dataUrl: string): boolean {
  return dataUrl.startsWith("data:image/svg+xml");
}

export async function rasterizeSvgToBase64Png(
  svgDataUrl: string
): Promise<{ base64Data: string; mediaType: "image/png" }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth || DEFAULT_DIMENSION;
      let h = img.naturalHeight || DEFAULT_DIMENSION;

      // Cap to MAX_DIMENSION while preserving aspect ratio
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas 2d context"));
        return;
      }

      // White background — SVGs often have transparent backgrounds
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const pngDataUrl = canvas.toDataURL("image/png");
      const base64Data = pngDataUrl.replace(/^data:image\/png;base64,/, "");
      resolve({ base64Data, mediaType: "image/png" });
    };
    img.onerror = () =>
      reject(new Error("Failed to load SVG for rasterization"));
    img.src = svgDataUrl;
  });
}
