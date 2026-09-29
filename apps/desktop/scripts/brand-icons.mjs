import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { app, BrowserWindow } from "electron";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const targets = [
  {
    size: 1024,
    tile: true,
    files: ["apps/desktop/build/icon.png", "apps/desktop/resources/app-icon.png"],
  },
  { size: 16, tile: false, files: ["apps/desktop/resources/tray-icon.png"] },
  { size: 32, tile: false, files: ["apps/desktop/resources/tray-icon@2x.png"] },
  {
    size: 32,
    tile: true,
    files: ["apps/web/public/favicon.png", "apps/docs/public/favicon.png"],
  },
];

app.disableHardwareAcceleration();

app
  .whenReady()
  .then(async () => {
    const brand = await readFile(resolve(root, "packages/ui/src/styles/brand.css"), "utf8");
    const window = new BrowserWindow({
      width: 1024,
      height: 1024,
      show: false,
      frame: false,
      transparent: true,
    });
    for (const { size, tile, files } of targets) {
      window.setSize(size, size);
      const html = `<!doctype html><style>${brand}
      body { margin: 0; width: 100vw; height: 100vh; display: grid; place-items: center; }
      .tile { display: grid; place-items: center; width: 81.25%; height: 81.25%; border-radius: 24%; background: #171719; }
      .otomat-mark { font-size: ${size * (tile ? 0.5 : 0.875)}px; color: ${tile ? "#f4f4f5" : "#000"}; }
      </style>${tile ? '<div class="tile">' : ""}<span class="otomat-mark"></span>${tile ? "</div>" : ""}`;
      await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      const image = await window.webContents.capturePage();
      const dimensions = image.getSize();
      if (image.isEmpty() || dimensions.width !== size || dimensions.height !== size) {
        throw new Error(`Expected a ${size}px icon, got ${JSON.stringify(dimensions)}`);
      }
      const png = image.toPNG();
      for (const file of files) {
        const path = resolve(root, file);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, png);
        console.log(`${file}: ${size} × ${size}`);
      }
    }
    window.destroy();
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
