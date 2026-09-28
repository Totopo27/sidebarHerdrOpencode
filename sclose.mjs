#!/usr/bin/env node
/**
 * ===========================================================================
 *  sclose: Cierre de Sesion y Liberacion de Cuenta en HUD
 * ===========================================================================
 *
 * Flujo:
 * 1. Identifica la sesion activa en OpenCode (por ID explicito, pane de Herdr o cwd).
 * 2. Guarda un snapshot de cierre en Engram si hay binario disponible.
 * 3. Marca time_archived = Date.now() en opencode.db (session_v2).
 * 4. El sidebar detecta el cambio en su proximo ciclo reactivo y apaga el marcador
 *    de la cuenta si ningun otro space la esta utilizando.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

const ACCENT_PRIMARY = "\x1b[38;2;123;138;255m"; // #7B8AFF
const MINT = "\x1b[38;2;76;183;130m";           // #4CB782
const AMBER = "\x1b[38;2;242;184;109m";         // #F2B86D
const CORAL = "\x1b[38;2;235;87;87m";           // #EB5757
const TEXT_MUTED = "\x1b[38;2;138;143;152m";    // #8A8F98
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const OPENCODE_DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log(`
${ACCENT_PRIMARY}sclose: Cierre de Sesion para OpenCode & Herdr${RESET}
Uso:
  sclose [sessionId] [opciones]

Opciones:
  --close-tab    Cierra la pestaña actual en Herdr tras archivar.
  --close-pane   Cierra el pane actual en Herdr tras archivar.
  --help, -h     Muestra esta ayuda.
`);
  process.exit(0);
}
let targetSessionId = args.find((a) => a.startsWith("ses_"));
const shouldCloseTab = args.includes("--close-tab");
const shouldClosePane = args.includes("--close-pane");

const cwd = process.cwd();
const normalizedCwd = cwd.replace(/\\/g, "/");
const folder = path.basename(cwd);
let projectName = folder.toLowerCase();

try {
  const cfgPath = path.join(cwd, ".engram", "config.json");
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    if (cfg.project_name) projectName = cfg.project_name;
    else if (cfg.project) projectName = cfg.project;
  }
} catch {}

if (!fs.existsSync(OPENCODE_DB_PATH)) {
  console.error(`${CORAL}[error] No se encontro la base de datos de OpenCode en:${RESET} ${OPENCODE_DB_PATH}`);
  process.exit(1);
}

try {
  const db = new DatabaseSync(OPENCODE_DB_PATH, { open: true });

  // Si no se paso sessionId, intentamos descubrirlo por Herdr o por directorio
  if (!targetSessionId) {
    try {
      const curRaw = execSync("herdr pane current", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const curData = JSON.parse(curRaw);
      const ses = curData.result?.pane?.agent_session?.value;
      if (ses) targetSessionId = ses;
    } catch {}
  }

  if (!targetSessionId) {
    const row = db.prepare(`
      SELECT id FROM session_v2 
      WHERE (directory = ? OR directory = ?) AND time_archived IS NULL 
      ORDER BY time_updated DESC LIMIT 1
    `).get(cwd, normalizedCwd);

    if (row?.id) {
      targetSessionId = row.id;
    }
  }

  if (!targetSessionId) {
    console.log(`${AMBER}[info] No hay ninguna sesion activa de OpenCode abierta en este directorio.${RESET}`);
    db.close();
    process.exit(0);
  }

  // Obtener datos de la sesion antes de archivar
  const sessionInfo = db.prepare("SELECT agent, model, directory FROM session_v2 WHERE id = ?").get(targetSessionId);
  const now = Date.now();

  db.prepare("UPDATE session_v2 SET time_archived = ? WHERE id = ?").run(now, targetSessionId);

  // Extraer prefijo de cuenta si existe
  let accountPrefix = "cuenta activa";
  const mAgent = (sessionInfo?.agent || "").match(/sdd-orchestrator-([a-z0-9_-]+)/i);
  if (mAgent?.[1]) {
    accountPrefix = mAgent[1];
  } else if (sessionInfo?.model) {
    const mMod = String(sessionInfo.model).match(/([a-z0-9_-]+)\/gemini/i);
    if (mMod?.[1]) accountPrefix = mMod[1];
  }

  db.close();

  // Guardar snapshot en Engram si existe binario
  const engramBin = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, "engram", "bin", "engram.exe")
    : path.join(os.homedir(), "AppData", "Local", "engram", "bin", "engram.exe");

  if (fs.existsSync(engramBin)) {
    try {
      const title = `Cierre de sesion: ${projectName} [${accountPrefix}]`;
      const content = `**What**: Sesion finalizada y archivada via sclose.\n**Why**: Cierre ordenado de jornada/trabajo y liberacion de cuenta en el HUD.\n**Where**: ${sessionInfo?.directory || cwd}`;
      execSync(`"${engramBin}" save "${title}" "${content}" --type decision --project "${projectName}"`, {
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 4000,
      });
    } catch {}
  }

  console.log(`\n${ACCENT_PRIMARY}[sclose]${RESET} ${MINT}Sesion archivada exitosamente${RESET} [${targetSessionId}]`);
  console.log(`${TEXT_MUTED}- Cuenta asociada:${RESET} ${BOLD}${accountPrefix}${RESET}`);
  console.log(`${TEXT_MUTED}- HUD Sidebar:${RESET} El indicador se actualizara en el proximo sondeo si ningun otro space la utiliza.`);

  // Si se solicito cerrar el pane o la pestaña en Herdr:
  if (shouldCloseTab) {
    try {
      const cur = JSON.parse(execSync("herdr pane current", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
      const tabId = cur.result?.pane?.tab_id;
      if (tabId) execSync(`herdr tab close ${tabId}`, { stdio: ["ignore", "pipe", "ignore"] });
    } catch {}
  } else if (shouldClosePane) {
    try {
      const cur = JSON.parse(execSync("herdr pane current", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
      const paneId = cur.result?.pane?.pane_id;
      if (paneId) execSync(`herdr pane close ${paneId}`, { stdio: ["ignore", "pipe", "ignore"] });
    } catch {}
  }
} catch (err) {
  console.error(`${CORAL}[error] Error al archivar la sesion:${RESET} ${err.message}`);
  process.exit(1);
}
