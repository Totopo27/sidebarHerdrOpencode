import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { spawnSync } from "node:child_process";

const FONT_URL = "https://raw.githubusercontent.com/hhdebb/herdr-radar/main/dist/HerdrAgentIconsMax-Regular.ttf";
const MERGED_FONT_URL = "https://raw.githubusercontent.com/hhdebb/herdr-radar/main/dist/JetBrainsMonoHerdr-Regular.ttf";

async function download(url, dest) {
  console.log(`Descargando ${url} -> ${dest}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`✔ Guardado (${buf.length} bytes)`);
}

async function main() {
  const fontsDir = path.join(
    process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
    "Microsoft",
    "Windows",
    "Fonts"
  );

  fs.mkdirSync(fontsDir, { recursive: true });

  const iconTarget = path.join(fontsDir, "HerdrAgentIconsMax-Regular.ttf");
  const mergedTarget = path.join(fontsDir, "JetBrainsMonoHerdr-Regular.ttf");

  try {
    await download(FONT_URL, iconTarget);
  } catch (e) {
    console.error("Error descargando icon font:", e.message);
  }

  try {
    await download(MERGED_FONT_URL, mergedTarget);
  } catch (e) {
    console.error("Error descargando merged font:", e.message);
  }

  // Registrar en el Registro de Windows (HKCU)
  const REG_KEY = "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts";

  if (fs.existsSync(iconTarget)) {
    const res = spawnSync("reg", ["add", REG_KEY, "/v", "Herdr Agent Icons Max (TrueType)", "/t", "REG_SZ", "/d", iconTarget, "/f"], { encoding: "utf8" });
    console.log("Registro HerdrAgentIconsMax:", res.status === 0 ? "OK" : res.stderr);
  }

  if (fs.existsSync(mergedTarget)) {
    const res = spawnSync("reg", ["add", REG_KEY, "/v", "JetBrains Mono Herdr (TrueType)", "/t", "REG_SZ", "/d", mergedTarget, "/f"], { encoding: "utf8" });
    console.log("Registro JetBrainsMonoHerdr:", res.status === 0 ? "OK" : res.stderr);
  }

  console.log("\n✔ Fuentes instaladas y registradas para tu usuario con éxito.");
}

main().catch(console.error);
