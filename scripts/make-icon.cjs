// Rasterises assets/icon.svg → 1024px PNG via Chromium (no SVG CLI available),
// then builds the macOS .iconset and icon.icns with sips + iconutil.
// Run with: npm run make:icon
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ASSETS = path.join(__dirname, "..", "assets");
const ICONSET = path.join(ASSETS, "icon.iconset");
const svg = fs.readFileSync(path.join(ASSETS, "icon.svg"), "utf8");

if (app.dock) app.dock.hide();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 256, height: 256 });
  await win.loadURL("data:text/html,<html><body></body></html>");

  const svgDataUrl =
    "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

  const pngDataUrl = await win.webContents.executeJavaScript(`
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = 1024; c.height = 1024;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, 1024, 1024);
        resolve(c.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('SVG failed to load'));
      img.src = ${JSON.stringify(svgDataUrl)};
    })
  `);

  const master = path.join(ASSETS, "icon-1024.png");
  fs.writeFileSync(master, Buffer.from(pngDataUrl.split(",")[1], "base64"));

  fs.rmSync(ICONSET, { recursive: true, force: true });
  fs.mkdirSync(ICONSET, { recursive: true });
  const sizes = [
    [16, "icon_16x16.png"],
    [32, "icon_16x16@2x.png"],
    [32, "icon_32x32.png"],
    [64, "icon_32x32@2x.png"],
    [128, "icon_128x128.png"],
    [256, "icon_128x128@2x.png"],
    [256, "icon_256x256.png"],
    [512, "icon_256x256@2x.png"],
    [512, "icon_512x512.png"],
    [1024, "icon_512x512@2x.png"],
  ];
  for (const [px, name] of sizes) {
    execFileSync(
      "sips",
      ["-z", String(px), String(px), master, "--out", path.join(ICONSET, name)],
      { stdio: "ignore" },
    );
  }
  execFileSync("iconutil", [
    "-c",
    "icns",
    ICONSET,
    "-o",
    path.join(ASSETS, "icon.icns"),
  ]);
  fs.copyFileSync(master, path.join(ASSETS, "icon.png"));

  console.log("ICON_DONE");
  app.exit(0);
});
