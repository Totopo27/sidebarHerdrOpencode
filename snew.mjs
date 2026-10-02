#!/usr/bin/env node
/**
 * ===========================================================================
 *  snew: Handover de Ingeniería y Apertura de Sesión Limpia
 * ===========================================================================
 *
 * Inspirado en la arquitectura de:
 * 1. Gentle Shell (ODD / Context Recovery & Attributed Changes):
 *    - Captura el contexto de la sesión saliente (archivos tocados, último turno, rama git).
 *    - Archiva limpiamente la sesión anterior en SQLite para liberar cuentas huérfanas.
 *    - Guarda un snapshot enriquecido en Engram persistente.
 * 2. CPAMC (Quota Health Allocation):
 *    - Evalúa en vivo la cuota de las 5 cuentas de Antigravity en CLIProxyAPI.
 *    - Selecciona automáticamente la cuenta con mayor cuota disponible para la nueva sesión.
 * 3. Herdr TUI Workspace:
 *    - Abre pestaña fresca en Herdr con OpenCode a la izquierda y el sidebar a la derecha.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync, execFileSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

// Colores ANSI
const ACCENT = "\x1b[38;2;123;138;255m";
const MINT = "\x1b[38;2;76;183;130m";
const GOLD = "\x1b[38;2;224;194;122m";
const AMBER = "\x1b[38;2;242;184;109m";
const CYAN = "\x1b[38;2;139;233;253m";
const TEXT_MUTED = "\x1b[38;2;138;143;152m";
const TEXT_DIM = "\x1b[38;2;90;94;102m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

const SCRIPT_DIR = import.meta.dirname || path.resolve(".");
const STATUS_SIDEBAR_CMD = path.join(SCRIPT_DIR, "status-sidebar.cmd");
const OPENCODE_DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

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

console.log(`\n${ACCENT}✿ [snew]${RESET} ${BOLD}Iniciando Handover de Ingeniería para:${RESET} ${CYAN}${projectName}${RESET}`);

// ============================================================================
// 1. CAPTURA DE CONTEXTO SALIENTE & ARCHIVADO LIMPIO (GENTLE SHELL ODD)
// ============================================================================
let outgoingContext = {
  sessionId: null,
  agent: null,
  model: null,
  accountPrefix: "default",
  attributedFiles: [],
  lastAssistantSnippet: "",
};

let branch = "main";
try {
  branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {}

if (fs.existsSync(OPENCODE_DB_PATH)) {
  try {
    const db = new DatabaseSync(OPENCODE_DB_PATH, { open: true });

    // Descubrir sesión activa actual en este cwd
    const activeRow = db.prepare(`
      SELECT * FROM session_v2 
      WHERE (directory = ? OR directory = ?) AND time_archived IS NULL 
      ORDER BY time_updated DESC LIMIT 1
    `).get(cwd, normalizedCwd);

    if (activeRow) {
      outgoingContext.sessionId = activeRow.id;
      outgoingContext.agent = activeRow.agent;
      outgoingContext.model = activeRow.model;

      const mAgent = (activeRow.agent || "").match(/sdd-orchestrator-([a-z0-9_-]+)/i);
      if (mAgent?.[1]) {
        outgoingContext.accountPrefix = mAgent[1];
      }

      // Capturar archivos modificados por herramientas en la sesión saliente
      const msgs = db.prepare(`
        SELECT data FROM session_message 
        WHERE session_id = ? AND type = 'assistant'
        ORDER BY time_updated DESC
      `).all(activeRow.id);

      const filesSet = new Set();
      for (const m of msgs) {
        try {
          const d = JSON.parse(m.data);
          if (!outgoingContext.lastAssistantSnippet && Array.isArray(d.content)) {
            const txt = d.content.find((c) => c && c.type === "text")?.text;
            if (txt) {
              outgoingContext.lastAssistantSnippet = txt.trim().split("\n")[0].slice(0, 120);
            }
          }
          if (Array.isArray(d.content)) {
            for (const p of d.content) {
              if (p && p.type === "tool") {
                const name = (p.toolName || p.name || "").toLowerCase();
                if (name === "write" || name === "edit") {
                  const fp = p.state?.input?.path || p.input?.path || p.arguments?.path;
                  if (fp) filesSet.add(path.basename(fp));
                }
              }
            }
          }
        } catch {}
      }
      outgoingContext.attributedFiles = Array.from(filesSet);

      // Archivar limpiamente la sesión saliente para liberar la cuenta en el HUD
      const now = Date.now();
      db.prepare("UPDATE session_v2 SET time_archived = ? WHERE id = ?").run(now, activeRow.id);
      console.log(`  ${MINT}✓${RESET} Sesión anterior archivada [${activeRow.id.slice(0, 8)}…] (liberando ${outgoingContext.accountPrefix}).`);
    }

    db.close();
  } catch {}
}

// Snapshot rico en Engram
const engramBin = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "engram", "bin", "engram.exe")
  : path.join(os.homedir(), "AppData", "Local", "engram", "bin", "engram.exe");

if (fs.existsSync(engramBin)) {
  try {
    const title = `Handover: ${projectName} (${branch}) -> Sesion Limpia`;
    const filesListStr = outgoingContext.attributedFiles.length > 0
      ? outgoingContext.attributedFiles.join(", ")
      : "ninguno en esta sesion";
    const snippetStr = outgoingContext.lastAssistantSnippet ? `\n**Ultimo estado**: ${outgoingContext.lastAssistantSnippet}` : "";

    const content = `**What**: Handover automatico y creacion de sesion limpia via snew.\n**Rama Git**: ${branch}\n**Cuenta saliente**: ${outgoingContext.accountPrefix}\n**Archivos tocados**: ${filesListStr}${snippetStr}\n**Where**: ${cwd}`;

    execFileSync(engramBin, [
      "save",
      title,
      content,
      "--type",
      "decision",
      "--project",
      projectName,
    ]);
    console.log(`  ${MINT}✓${RESET} Contexto de Handover registrado en Engram (${outgoingContext.attributedFiles.length} archivos atribuidos).`);
  } catch {}
}

// ============================================================================
// 2. SELECCIÓN DE LA CUENTA MÁS SANA (CPAMC HEALTH EVALUATOR)
// ============================================================================
function resolveAuthsDir() {
  const candidates = [
    process.env.CLIPROXY_AUTHS_DIR,
    path.join(os.homedir(), ".cliproxy", "auths"),
    path.join(os.homedir(), "cliproxyapi", "auths"),
    "D:/DocumentosDiscoD/cliproxyapi/auths",
    "C:/cliproxyapi/auths",
    "D:/cliproxyapi/auths",
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return process.env.CLIPROXY_AUTHS_DIR || path.join(os.homedir(), ".cliproxy", "auths");
}

const AUTHS_DIR = resolveAuthsDir();
const QUOTA_URL = "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary";
const USER_AGENT = "antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)";

async function pickHealthiestAccount() {
  if (!fs.existsSync(AUTHS_DIR)) return "gianni";

  const files = fs.readdirSync(AUTHS_DIR).filter((f) => f.startsWith("antigravity-") && f.endsWith(".json"));
  const evaluated = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(AUTHS_DIR, file), "utf8");
      const auth = JSON.parse(raw);
      const prefix = auth.prefix || (auth.email ? auth.email.split("@")[0] : file);

      if (!auth.access_token || auth.disabled) continue;

      let rem5h = 100;
      let hasError = false;

      try {
        const res = await fetch(QUOTA_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${auth.access_token}`,
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
          },
          body: JSON.stringify({ project: auth.project_id }),
          signal: AbortSignal.timeout(3500),
        });

        if (res.ok) {
          const data = await res.json();
          const geminiGroup = data.groups?.find((g) => g.displayName === "Gemini Models");
          const gemini5h = geminiGroup?.buckets?.find((b) => b.window === "5h");
          const remFraction = gemini5h?.remainingFraction ?? 1;
          rem5h = Math.max(0, Math.min(100, Math.round(remFraction * 100)));
        } else {
          hasError = true;
        }
      } catch {
        // En caso de timeout rápido, asumimos capacidad previa estándar
      }

      if (!hasError) {
        evaluated.push({ prefix, rem5h });
      }
    } catch {}
  }

  if (evaluated.length === 0) return "gianni";
  evaluated.sort((a, b) => b.rem5h - a.rem5h);
  return evaluated[0];
}

console.log(`  ${GOLD}⟡${RESET} Evaluando salud de cuotas en CLIProxyAPI...`);
const bestAccount = await pickHealthiestAccount();
const targetPrefix = typeof bestAccount === "object" ? bestAccount.prefix : bestAccount;
const remQuotaPct = typeof bestAccount === "object" ? `${bestAccount.rem5h}% libre` : "disponible";

console.log(`  ${MINT}✓${RESET} Cuenta seleccionada para nueva sesión: ${BOLD}${targetPrefix}${RESET} (${remQuotaPct}).`);

// ============================================================================
// 3. APERTURA DE ENTORNO EN HERDR (CON MODELO / AGENTE DESIGNADO)
// ============================================================================
let inHerdr = false;
try {
  execSync("where herdr", { stdio: ["ignore", "pipe", "ignore"] });
  inHerdr = true;
} catch {}

const designatedAgent = `sdd-orchestrator-${targetPrefix}`;

if (inHerdr) {
  try {
    const tabRaw = execSync(`herdr tab create --cwd "${cwd}" --label "${folder}" --focus`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const tabData = JSON.parse(tabRaw);
    const newTabId = tabData.result?.tab?.tab_id;

    if (newTabId) {
      console.log(`  ${MINT}✓${RESET} Nueva pestaña creada en Herdr (${folder}).`);

      const listRaw = execSync("herdr pane list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const listData = JSON.parse(listRaw);
      const tabPanes = (listData.result?.panes || []).filter((p) => p.tab_id === newTabId);

      if (tabPanes.length > 0) {
        const mainPaneId = tabPanes[0].pane_id;
        // Iniciar OpenCode en el pane izquierdo con el agente asignado a la cuenta óptima
        execSync(`herdr pane run ${mainPaneId} "opencode --agent ${designatedAgent}"`, { stdio: ["ignore", "pipe", "ignore"] });

        // Crear split a la derecha para el sidebar (ratio 0.74 = 26% sidebar)
        const splitRaw = execSync(`herdr pane split --pane ${mainPaneId} --direction right --ratio 0.74 --no-focus`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const splitData = JSON.parse(splitRaw);
        const sidePaneId = splitData.result?.pane?.pane_id || splitData.result?.new_pane_id;

        if (sidePaneId) {
          execSync(`herdr pane run ${sidePaneId} "${STATUS_SIDEBAR_CMD}"`, {
            stdio: ["ignore", "pipe", "ignore"],
          });
        }
      }
      console.log(`\n${MINT}🚀 Handover completado con éxito.${RESET}\n`);
      process.exit(0);
    }
  } catch (err) {}
}

// Fallback: lanzar opencode localmente con el agente designado
console.log(`\n${ACCENT}✿${RESET} Abriendo OpenCode con ${designatedAgent}...`);
execSync(`opencode --agent ${designatedAgent}`, { stdio: "inherit" });
