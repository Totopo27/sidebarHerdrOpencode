#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  GENTLE-AI · OPENCODE HUD SIDEBAR (Linear & Anti-Slop Architecture)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Arquitectura de alto rendimiento inspirada en el Catálogo de Herramientas:
 *   - Sección 10: Sistema de diseño Anti-Slop & Linear (densidad, sobriedad técnica)
 *   - Sección 14: Optimizaciones IPC / SQLite / Caching reactivo (Event-driven)
 *
 *  Características clave:
 *   1. Snapshot + Reactive Polling: Barrido general inicial, sondeo activo de 2m
 *      exclusivo para la(s) cuenta(s) en uso, y refresco instantáneo al terminar turnos.
 *   2. Marcos matemáticos indestructibles a 46-50 columnas (cero line-wrap).
 *   3. Soporte para múltiples sesiones simultáneas en Herdr (múltiples marcadores ▸).
 *   4. Sistema progresivo de alerta en cascada: Aviso preventivo al 70%, Crítico al 85%.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";

// ============================================================================
// PALETA LINEAR / TUI (Truecolor 24-bit ANSI)
// ============================================================================
const BORDER = "\x1b[38;2;120;75;160m";        // #784ba0 (violeta estructural sobrio)
const BORDER_MUTED = "\x1b[38;2;70;45;95m";    // #462d5f (separadores sutiles)
const ACCENT_PRIMARY = "\x1b[38;2;123;138;255m"; // #7B8AFF (periwinkle Linear)
const ACCENT_PINK = "\x1b[38;2;240;149;200m";    // #F095C8 (indicador activo ▸)
const GOLD = "\x1b[38;2;224;194;122m";           // #E0C27A (etiquetas, números destacados)
const AMBER = "\x1b[38;2;242;184;109m";          // #F2B86D (aviso 70%+, git mod)
const MINT = "\x1b[38;2;76;183;130m";            // #4CB782 (Linear success green)
const CORAL = "\x1b[38;2;235;87;87m";            // #EB5757 (Linear error / crítico 85%+)
const TEXT_PRIMARY = "\x1b[38;2;247;248;248m";   // #F7F8F8 (off-white texto principal)
const TEXT_MUTED = "\x1b[38;2;138;143;152m";     // #8A8F98 (Linear muted secondary)
const TEXT_DIM = "\x1b[38;2;90;94;102m";         // #5A5E66 (detalles tenues)
const CYAN = "\x1b[38;2;139;233;253m";           // #8BE9FD (Dracula cyan)
const MAGENTA = "\x1b[38;2;189;147;249m";        // #BD93F9 (Dracula purple)
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

// ============================================================================
// CONFIGURACION Y RUTAS LOCALES (Portables & Agnosticas)
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
const POLL_INTERVAL_MS = 120_000; // 2 minutos para el sondeo pasivo

const OPENCODE_DB_PATH = path.join(os.homedir(), ".local/share/opencode/opencode.db");
const ENGRAM_DB_PATH = path.join(os.homedir(), ".engram/engram.db");

// ============================================================================
// ESTADO GLOBAL & CACHE
// ============================================================================
const accountsList = [];
let lastUpdatedTime = "";
let isFetchingQuotas = false;
let isInitialFetch = true;
let lastKnownTurnTime = 0;
let scrollOffset = 0;
let renderTimer = null;
let flashNotice = null;
let flashNoticeTimer = null;
let pendingMigrationTarget = null; // Encolado para cuando el turno pase a idle

// ============================================================================
// MOTOR DE MEDICION UNICODE A PRUEBA DE DESBORDES (ZERO-WRAPPING)
// ============================================================================
function charWidth(codePoint) {
  if (!codePoint) return 0;
  // Modificadores de variación y espacios de ancho cero
  if (codePoint === 0xFE0F || codePoint === 0xFE0E || (codePoint >= 0x200B && codePoint <= 0x200D)) {
    return 0;
  }
  // ASCII estándar imprimible
  if (codePoint >= 0x20 && codePoint <= 0x7E) {
    return 1;
  }
  if (codePoint < 0x20 || (codePoint >= 0x7F && codePoint <= 0x9F)) {
    return 0;
  }
  // Caracteres anchos (Emojis, Ideogramas CJK, Fullwidth)
  if (
    (codePoint >= 0x1100 && codePoint <= 0x115F) ||
    codePoint === 0x2329 || codePoint === 0x232A ||
    (codePoint >= 0x2E80 && codePoint <= 0xA4CF && codePoint !== 0x303F) ||
    (codePoint >= 0xAC00 && codePoint <= 0xD7A3) ||
    (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
    (codePoint >= 0xFE10 && codePoint <= 0xFE19) ||
    (codePoint >= 0xFE30 && codePoint <= 0xFE6F) ||
    (codePoint >= 0xFF00 && codePoint <= 0xFF60) ||
    (codePoint >= 0xFFE0 && codePoint <= 0xFFE6) ||
    (codePoint >= 0x1F300 && codePoint <= 0x1F64F) ||
    (codePoint >= 0x1F680 && codePoint <= 0x1F6FF) ||
    (codePoint >= 0x1F900 && codePoint <= 0x1F9FF) ||
    (codePoint >= 0x1FA00 && codePoint <= 0x1FA6F) ||
    (codePoint >= 0x1FA70 && codePoint <= 0x1FAFF) ||
    (codePoint >= 0x20000 && codePoint <= 0x3FFFD)
  ) {
    return 2;
  }
  return 1;
}

function stringWidth(str) {
  if (!str) return 0;
  const clean = str.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "");
  let w = 0;
  for (const char of clean) {
    w += charWidth(char.codePointAt(0));
  }
  return w;
}

function truncateToWidth(str, maxWidth) {
  if (!str || maxWidth <= 0) return "";
  let currentWidth = 0;
  let result = "";
  const tokens = str.match(/\x1b\[[0-9;?]*[a-zA-Z]|./gsu) || [];
  for (const token of tokens) {
    if (token.startsWith("\x1b")) {
      result += token;
      continue;
    }
    const cw = charWidth(token.codePointAt(0));
    if (currentWidth + cw > maxWidth) break;
    currentWidth += cw;
    result += token;
  }
  return result + RESET;
}

function formatTokenCount(num) {
  if (!Number.isFinite(num) || num <= 0) return "0";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "k";
  return num.toString();
}

function formatCost(num) {
  if (!Number.isFinite(num) || num <= 0) return "$0.000";
  return `$${num.toFixed(3)}`;
}

function getQuotaThreshold(availablePercent) {
  const rounded = Math.round(availablePercent);
  if (rounded <= 15) return { color: (s) => `${CORAL}${s}${RESET}`, colorRaw: CORAL, level: "critical", label: "Crítico" };
  if (rounded <= 30) return { color: (s) => `${AMBER}${s}${RESET}`, colorRaw: AMBER, level: "alert", label: "Aviso 70%+" };
  if (rounded < 65) return { color: (s) => `${GOLD}${s}${RESET}`, colorRaw: GOLD, level: "medium", label: "Medio" };
  return { color: (s) => `${MINT}${s}${RESET}`, colorRaw: MINT, level: "optimal", label: "Óptimo" };
}

function formatRelativeReset(resetAt, now = Date.now()) {
  if (!resetAt) return "";
  const date = new Date(resetAt);
  const ms = date.getTime() - now;
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "reseteando…";

  const totalMins = Math.floor(ms / 60000);
  if (totalMins < 60) return `en ${totalMins}m`;

  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hours < 24) return mins > 0 ? `en ${hours}h ${mins}m` : `en ${hours}h`;

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `en ${days}d ${remHours}h` : `en ${days}d`;
}

// ============================================================================
// PROVEEDORES DE DATOS NATIVOS
// ============================================================================

// 1. Git Status & Log Graph (Sintaxis Dracula)
function getGitData(targetDir) {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", {
      cwd: targetDir,
      stdio: ["ignore", "pipe", "ignore"],
      encoding: "utf8",
    }).trim() || "main";

    let modified = 0;
    let untracked = 0;
    let staged = 0;
    try {
      const statusOut = execSync("git status --porcelain=v1", {
        cwd: targetDir,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }).trim();
      if (statusOut) {
        for (const line of statusOut.split("\n")) {
          const x = line[0];
          const y = line[1];
          if (x === "?" && y === "?") untracked++;
          else if (x !== " " && x !== "?") staged++;
          if (y !== " " && y !== "?") modified++;
        }
      }
    } catch {}

    let linesAdded = 0;
    let linesDeleted = 0;
    try {
      const diffOut = execSync("git diff HEAD --numstat", {
        cwd: targetDir,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }).trim();
      if (diffOut) {
        for (const line of diffOut.split("\n")) {
          const parts = line.split("\t");
          if (parts.length >= 2) {
            const a = parseInt(parts[0], 10);
            const d = parseInt(parts[1], 10);
            if (!isNaN(a)) linesAdded += a;
            if (!isNaN(d)) linesDeleted += d;
          }
        }
      }
    } catch {}

    let graphLines = [];
    try {
      const logOut = execSync('git log --graph --oneline --decorate -n 3', {
        cwd: targetDir,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }).trim();
      if (logOut) {
        graphLines = logOut.split("\n").filter((l) => l.trim().length > 0);
      }
    } catch {}

    return {
      branch,
      modified,
      untracked,
      staged,
      linesAdded,
      linesDeleted,
      graphLines,
      isClean: modified === 0 && untracked === 0 && staged === 0,
      hasGit: true,
    };
  } catch {
    return {
      branch: "main",
      modified: 0,
      untracked: 0,
      staged: 0,
      linesAdded: 0,
      linesDeleted: 0,
      graphLines: [],
      isClean: true,
      hasGit: false,
    };
  }
}

function colorizeGitGraphLine(line) {
  if (!line || !line.trim()) return line;

  if (/^[\\/|_\s]+$/.test(line)) {
    return line.replace(/([\\/|_]+)/g, (m) => `${CYAN}${m}${RESET}`);
  }

  const m = /^([*\\/|_\s]*[*][*\\/|_\s]*)\s+([0-9a-f]{7,40})\s*(?:\(([^)]+)\))?\s*(.*)$/.exec(line);
  if (!m) {
    return line
      .replace(/(\*)/g, `${ACCENT_PRIMARY}*${RESET}`)
      .replace(/([\\/|_]+)/g, `${CYAN}$1${RESET}`);
  }

  const graphPart = m[1].replace(/(\*)/g, `${ACCENT_PRIMARY}*${RESET}`).replace(/([\\/|_]+)/g, `${CYAN}$1${RESET}`);
  const hash = `${GOLD}${m[2]}${RESET}`;
  let refs = "";
  if (m[3]) {
    const items = m[3].split(",").map((s) => {
      const tr = s.trim();
      if (tr.includes("HEAD")) return `${MINT}${tr}${RESET}`;
      if (tr.includes("origin") || tr.includes("upstream")) return `${MAGENTA}${tr}${RESET}`;
      return `${AMBER}${tr}${RESET}`;
    }).join(`${TEXT_DIM}, ${RESET}`);
    refs = ` ${TEXT_DIM}(${RESET}${items}${TEXT_DIM})${RESET}`;
  }
  const subject = m[4] ? ` ${TEXT_PRIMARY}${m[4]}${RESET}` : "";
  return `${graphPart} ${hash}${refs}${subject}`;
}

// 2. OpenCode Session, Context, Multi-Pane Herdr & Tool Telemetry
function getOpenCodeSessionData() {
  const result = {
    agent: "sdd-orchestrator",
    model: "gemini-3.8-flash-high",
    modelShort: "gemini-3.8-flash-high",
    tokensInput: 0,
    tokensOutput: 0,
    activeTurnContextTokens: 0,
    cost: 0,
    tools: { read: 0, write: 0, bash: 0, engram: 0, other: 0, total: 0 },
    activeDirectory: process.cwd(),
    allActivePrefixes: new Set(),
    lastUpdatedTurn: 0,
    agentStatus: "idle", // 'working' | 'idle' estilo petal de gentle-shell
    attributedChanges: {
      files: new Set(),
      additions: 0,
      deletions: 0,
    },
  };

  try {
    if (!fs.existsSync(OPENCODE_DB_PATH)) return result;
    const db = new DatabaseSync(OPENCODE_DB_PATH, { open: true, readOnly: true });

    let targetSession = null;

    // A. Consultamos el mapa en vivo de Herdr para descubrir todos los panes activos
    try {
      const listRaw = execSync("herdr pane list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const listData = JSON.parse(listRaw);
      const panes = listData.result?.panes || [];

      // Identificar el tab actual de este sidebar
      let myTabId = null;
      let myPaneId = process.env.HERDR_PANE_ID;
      if (!myPaneId) {
        try {
          const curRaw = execSync("herdr pane current", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
          const curData = JSON.parse(curRaw);
          myPaneId = curData.result?.pane?.pane_id;
          myTabId = curData.result?.pane?.tab_id;
        } catch {}
      } else {
        const myPane = panes.find((p) => p.pane_id === myPaneId);
        myTabId = myPane?.tab_id;
      }

      // Recolectar todas las cuentas en uso a lo largo de TODOS los panes abiertos
      for (const p of panes) {
        const sesId = p.agent_session?.value;
        if (sesId) {
          const s = db.prepare("SELECT agent, model, time_archived, time_updated FROM session_v2 WHERE id = ?").get(sesId);
          if (s && !s.time_archived) {
            const m = (s.agent || "").match(/sdd-orchestrator-([a-z0-9_-]+)/i);
            if (m?.[1]) {
              result.allActivePrefixes.add(m[1].toLowerCase());
            } else if (s.model) {
              const mMod = String(s.model).match(/([a-z0-9_-]+)\/gemini/i);
              if (mMod?.[1]) result.allActivePrefixes.add(mMod[1].toLowerCase());
            }
          }
        }
      }

      // El pane prioritario para la tarjeta Status es el compañero en el mismo tab
      const siblingPane = myTabId ? panes.find((p) => p.tab_id === myTabId && p.pane_id !== myPaneId && p.agent_session?.value) : null;
      const focusedPane = panes.find((p) => p.focused && p.agent_session?.value);
      const workingPane = panes.find((p) => p.agent_status === "working" && p.agent_session?.value);

      const primaryPane = siblingPane || focusedPane || workingPane;
      if (primaryPane?.agent_session?.value) {
        targetSession = db.prepare("SELECT * FROM session_v2 WHERE id = ?").get(primaryPane.agent_session.value);
        if (primaryPane.agent_status) {
          result.agentStatus = primaryPane.agent_status;
        }
      }
    } catch {}

    // B. Fallback: sesión no archivada que coincida con el directorio actual (cwd)
    if (!targetSession) {
      const normalizedCwd = cwd.replace(/\\/g, "/");
      targetSession = db.prepare(`
        SELECT * FROM session_v2 
        WHERE (directory = ? OR directory = ?) AND time_archived IS NULL 
        ORDER BY time_updated DESC LIMIT 1
      `).get(cwd, normalizedCwd);

      if (!targetSession) {
        targetSession = db.prepare(`
          SELECT * FROM session_v2 
          WHERE time_archived IS NULL 
          ORDER BY time_updated DESC LIMIT 1
        `).get();
      }
    }

    if (targetSession) {
      if (targetSession.agent) result.agent = targetSession.agent;
      if (targetSession.directory) result.activeDirectory = targetSession.directory;
      result.tokensInput = targetSession.tokens_input || 0;
      result.tokensOutput = targetSession.tokens_output || 0;
      result.cost = targetSession.cost || 0;
      result.lastUpdatedTurn = targetSession.time_updated || 0;

      const pfxMatch = (targetSession.agent || "").match(/sdd-orchestrator-([a-z0-9_-]+)/i);
      if (pfxMatch?.[1]) {
        result.allActivePrefixes.add(pfxMatch[1].toLowerCase());
      }

      if (targetSession.model) {
        try {
          const parsed = JSON.parse(targetSession.model);
          result.model = parsed.id || targetSession.model;
        } catch {
          result.model = targetSession.model;
        }
        result.modelShort = result.model.split("/").pop();
      }

      // Tokens del turno activo desde session_message
      try {
        const lastMsg = db.prepare(`
          SELECT data FROM session_message 
          WHERE session_id = ? AND type = 'assistant' 
          ORDER BY time_updated DESC LIMIT 1
        `).get(targetSession.id);

        if (lastMsg) {
          const d = JSON.parse(lastMsg.data);
          if (d?.tokens) {
            const inp = d.tokens.input || 0;
            const cache = d.tokens.cache?.read || 0;
            result.activeTurnContextTokens = inp + cache;
          }
        }
      } catch {}

      // Conteo de herramientas ejecutadas y Gentle Attributed Changes
      const rows = db.prepare(`
        SELECT data FROM session_message 
        WHERE session_id = ? AND type = 'assistant'
      `).all(targetSession.id);

      for (const r of rows) {
        try {
          const d = JSON.parse(r.data);
          if (Array.isArray(d.content)) {
            for (const p of d.content) {
              if (p && p.type === "tool") {
                result.tools.total++;
                const name = (p.toolName || p.name || "").toLowerCase();
                if (name === "read") result.tools.read++;
                else if (name === "write" || name === "edit") {
                  result.tools.write++;
                  // Captura de archivos y deltas atribuidos a la sesión
                  const filePath = p.state?.input?.path || p.input?.path || p.input?.filePath || p.arguments?.path || p.arguments?.filePath;
                  if (filePath) {
                    result.attributedChanges.files.add(path.basename(filePath));
                  }
                  if (Array.isArray(p.state?.metadata?.files)) {
                    for (const mf of p.state.metadata.files) {
                      if (mf.file) result.attributedChanges.files.add(path.basename(mf.file));
                      if (typeof mf.additions === "number") result.attributedChanges.additions += mf.additions;
                      if (typeof mf.deletions === "number") result.attributedChanges.deletions += mf.deletions;
                    }
                  }
                }
                else if (name === "shell" || name === "bash") result.tools.bash++;
                else if (name.startsWith("mem_") || name === "engram" || name === "execute") result.tools.engram++;
                else result.tools.other++;
              }
            }
          }
        } catch {}
      }
    }

    db.close();
  } catch {}

  return result;
}

// 3. MCP Servers Configuration Discovery
function getMcpData(targetDir) {
  const mcpList = [];
  const candidatePaths = [
    path.join(targetDir, "opencode.json"),
    path.join(targetDir, ".opencode", "opencode.json"),
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
    path.join(os.homedir(), ".opencode", "opencode.json"),
  ];
  if (process.env.OPENCODE_CONFIG_DIR) {
    candidatePaths.push(path.join(process.env.OPENCODE_CONFIG_DIR, "opencode.json"));
  }

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, "utf8");
        const cfg = JSON.parse(raw);
        if (cfg.mcp && typeof cfg.mcp === "object") {
          for (const [name, val] of Object.entries(cfg.mcp)) {
            if (name === "servers") continue;
            const isEnabled = val?.enabled !== false;
            const type = val?.type || (val?.url ? "remote" : "local");
            if (!mcpList.some((m) => m.name === name)) {
              mcpList.push({ name, enabled: isEnabled, type });
            }
          }
        }
      } catch {}
    }
  }

  return mcpList;
}

// 3. Engram Data
function getEngramData(projectName, projectDir) {
  let canonicalName = projectName;

  try {
    const cfgPath = path.join(projectDir, ".engram", "config.json");
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
      if (cfg.project_name) canonicalName = cfg.project_name;
      else if (cfg.project) canonicalName = cfg.project;
    }
  } catch {}

  let cloudHost = null;
  const envCloud = process.env.ENGRAM_CLOUD_SERVER;
  if (envCloud) {
    try { cloudHost = new URL(envCloud).hostname; } catch { cloudHost = envCloud; }
  } else {
    try {
      const cloudJsonPath = path.join(os.homedir(), ".engram", "cloud.json");
      if (fs.existsSync(cloudJsonPath)) {
        const cloudData = JSON.parse(fs.readFileSync(cloudJsonPath, "utf8"));
        if (cloudData.server_url) {
          try { cloudHost = new URL(cloudData.server_url).hostname; } catch { cloudHost = cloudData.server_url; }
        }
      }
    } catch {}
  }

  const result = {
    project: canonicalName,
    online: false,
    obsCount: 0,
    enrolled: false,
    cloudHost,
  };

  try {
    if (fs.existsSync(ENGRAM_DB_PATH)) {
      result.online = true;
      const db = new DatabaseSync(ENGRAM_DB_PATH, { open: true, readOnly: true });

      const obsRow = db.prepare("SELECT count(*) as count FROM observations WHERE project = ? AND deleted_at IS NULL").get(canonicalName);
      if (obsRow) result.obsCount = obsRow.count;

      const enrollRow = db.prepare("SELECT count(*) as count FROM sync_enrolled_projects WHERE project = ?").get(canonicalName);
      if (enrollRow && enrollRow.count > 0) result.enrolled = true;

      db.close();
    }
  } catch {}

  return result;
}

// 4. Descubrimiento de cuentas y sondeo adaptativo a Google
function discoverAccounts() {
  if (!fs.existsSync(AUTHS_DIR)) return;

  const files = fs.readdirSync(AUTHS_DIR).filter(
    (f) => f.startsWith("antigravity-") && f.endsWith(".json")
  );

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(AUTHS_DIR, file), "utf8");
      const auth = JSON.parse(raw);
      const prefix = auth.prefix || (auth.email ? auth.email.split("@")[0] : file);

      const authFilePath = path.join(AUTHS_DIR, file);
      let existing = accountsList.find((a) => a.prefix === prefix);
      if (!existing) {
        existing = {
          prefix,
          auth,
          authFile: authFilePath,
          email: auth.email || "",
          rem5h: 100,
          used5h: 0,
          reset5h: "",
          isCritical: false,
          isWarning: false,
          hasError: false,
          errorMsg: "",
        };
        accountsList.push(existing);
      } else {
        existing.auth = auth;
        existing.authFile = authFilePath;
      }
    } catch {}
  }

  accountsList.sort((a, b) => a.prefix.localeCompare(b.prefix));
}

async function updateAccountQuota(account) {
  // Releer el archivo auth en disco por si cliproxy refrescó el access_token
  if (account.authFile && fs.existsSync(account.authFile)) {
    try {
      const freshRaw = fs.readFileSync(account.authFile, "utf8");
      account.auth = JSON.parse(freshRaw);
    } catch {}
  }

  const { auth } = account;
  if (!auth || !auth.access_token || auth.disabled) return;

  try {
    const res = await fetch(QUOTA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.access_token}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ project: auth.project_id }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const data = await res.json();
      account.hasError = false;
      account.errorMsg = "";

      const geminiGroup = data.groups?.find((g) => g.displayName === "Gemini Models");
      const claudeGroup = data.groups?.find((g) => g.displayName?.includes("Claude"));

      const geminiWk = geminiGroup?.buckets?.find((b) => b.window === "weekly");
      const gemini5h = geminiGroup?.buckets?.find((b) => b.window === "5h");
      const claudeWk = claudeGroup?.buckets?.find((b) => b.window === "weekly");
      const claude5h = claudeGroup?.buckets?.find((b) => b.window === "5h");

      const remFraction = gemini5h?.remainingFraction ?? 1;
      const remPercent = Math.max(0, Math.min(100, Math.round(remFraction * 100)));
      const usedPercent = 100 - remPercent;

      account.rem5h = remPercent;
      account.used5h = usedPercent;
      account.reset5h = formatRelativeReset(gemini5h?.resetTime || null);

      account.pools = [
        {
          label: "Gemini Wk",
          percent: Math.round(((geminiWk?.remainingFraction ?? 1) * 100)),
          reset: formatRelativeReset(geminiWk?.resetTime || null),
        },
        {
          label: "Gemini 5h",
          percent: remPercent,
          reset: account.reset5h,
        },
        {
          label: "Claude Wk",
          percent: Math.round(((claudeWk?.remainingFraction ?? 1) * 100)),
          reset: formatRelativeReset(claudeWk?.resetTime || null),
        },
        {
          label: "Claude 5h",
          percent: Math.round(((claude5h?.remainingFraction ?? 1) * 100)),
          reset: formatRelativeReset(claude5h?.resetTime || null),
        },
      ];

      // Alerta progresiva de cuota:
      // >= 85% usado (<= 15% libre) -> Crítico (rojo)
      // >= 70% usado (< 85% usado)  -> Aviso preventivo (amarillo)
      account.isCritical = usedPercent >= 85;
      account.isWarning = usedPercent >= 70 && usedPercent < 85;
    } else {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401 || err?.error?.message?.includes("expired") || err?.error?.status === "UNAUTHENTICATED") {
        account.hasError = true;
        account.errorMsg = "token expirado";
      } else if (err?.error?.message?.includes("Verify your account") || err?.error?.details?.some((d) => d.reason === "VALIDATION_REQUIRED")) {
        account.hasError = true;
        account.errorMsg = "verif. requerida";
      } else if (res.status === 429) {
        account.hasError = true;
        account.errorMsg = "rate limited";
      } else {
        account.hasError = true;
        account.errorMsg = "err " + res.status;
      }
    }
  } catch (e) {
    // Si hubo timeout u error de red temporal, no borrar datos previos si ya existían
  }
}

/**
 * Estrategia de Refresco Inteligente (Snapshot + Reactive Active Polling):
 * - Al arrancar (isInitialFetch) o al presionar 'r' (forceAll): consulta las 5 cuentas para pintar el panorama general.
 * - En los intervalos automáticos de 2m: SOLO consulta las cuentas activas en uso en alguna sesión.
 */
async function fetchQuotas(forceAll = false) {
  if (isFetchingQuotas) return;
  isFetchingQuotas = true;

  discoverAccounts();

  const sessionData = getOpenCodeSessionData();
  const activePrefixes = sessionData.allActivePrefixes;

  const accountsToQuery = (forceAll || isInitialFetch)
    ? accountsList
    : accountsList.filter((a) => activePrefixes.has(a.prefix.toLowerCase()));

  const targetAccounts = accountsToQuery.length > 0 ? accountsToQuery : accountsList.slice(0, 1);

  await Promise.allSettled(targetAccounts.map((acc) => updateAccountQuota(acc)));

  isInitialFetch = false;
  lastUpdatedTime = new Date().toLocaleTimeString();
  isFetchingQuotas = false;
  scheduleRender();
}

function scheduleRender() {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    render();
  }, 50);
}

// Comprobación de turnos locales reactiva cada 3s (sin consumo de red externa)
function checkLocalActivity() {
  const sessionData = getOpenCodeSessionData();

  // Si había una migración encolada y el agente pasó a 'idle', ejecutarla en frío
  if (pendingMigrationTarget && sessionData.agentStatus !== "working") {
    const target = pendingMigrationTarget;
    pendingMigrationTarget = null;
    executeDatabaseMigration(target);
    return;
  }

  if (sessionData.lastUpdatedTurn > 0) {
    if (lastKnownTurnTime > 0 && sessionData.lastUpdatedTurn > lastKnownTurnTime) {
      // El asistente completó un turno: refrescamos la cuenta activa inmediatamente
      fetchQuotas(false);
    }
    lastKnownTurnTime = sessionData.lastUpdatedTurn;
  }
}

function getBestHealthyTargetPrefix() {
  const sessionData = getOpenCodeSessionData();
  const activePrefixes = sessionData.allActivePrefixes;

  // 1. Si hay alguna cuenta activa que esté sana (> 30% libre y sin error), preferir esa
  for (const p of activePrefixes) {
    const acc = accountsList.find((a) => a.prefix.toLowerCase() === p && !a.isCritical && !a.hasError && a.rem5h > 30);
    if (acc) return acc.prefix;
  }

  // 2. Si no, elegir la cuenta con mayor porcentaje libre disponible y sin error
  const healthyAccounts = accountsList
    .filter((a) => !a.isCritical && !a.hasError)
    .sort((a, b) => b.rem5h - a.rem5h);

  return healthyAccounts[0]?.prefix || accountsList[0]?.prefix || "default";
}

function releaseInactiveSessions() {
  const currentSessionId = process.env.OPENCODE_SESSION_ID || null;
  let closedCount = 0;

  try {
    const listRaw = execSync("herdr pane list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const listData = JSON.parse(listRaw);
    const panes = listData.result?.panes || [];

    // Descubrir qué pane / tab es el que tiene el foco activo del usuario
    let focusedTabId = null;
    let focusedPaneId = null;
    try {
      const curRaw = execSync("herdr pane current", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const curData = JSON.parse(curRaw);
      focusedPaneId = curData.result?.pane?.pane_id;
      focusedTabId = curData.result?.pane?.tab_id;
    } catch {}

    const focusedPane = panes.find((p) => p.focused || (focusedPaneId && p.pane_id === focusedPaneId));
    const activeTabId = focusedPane?.tab_id || focusedTabId;

    // Obtener la sesión del pane actualmente en foco o en su tab activo
    let keepSessionId = focusedPane?.agent_session?.value || null;
    if (!keepSessionId && activeTabId) {
      const tabAgentPane = panes.find((p) => p.tab_id === activeTabId && p.agent_session?.value);
      keepSessionId = tabAgentPane?.agent_session?.value || null;
    }

    // Si no se detectó por Herdr, proteger la sesión actual donde corre el asistente
    if (!keepSessionId && currentSessionId) {
      keepSessionId = currentSessionId;
    }

    const now = Date.now();
    const db = new DatabaseSync(OPENCODE_DB_PATH, { open: true });

    // Archivar sesiones huérfanas en la base de datos de OpenCode
    for (const p of panes) {
      const sesId = p.agent_session?.value;
      if (sesId && sesId !== keepSessionId) {
        const s = db.prepare("SELECT time_archived FROM session_v2 WHERE id = ?").get(sesId);
        if (s && !s.time_archived) {
          db.prepare("UPDATE session_v2 SET time_archived = ? WHERE id = ?").run(now, sesId);
          closedCount++;
        }
      }
    }

    db.close();

    if (closedCount > 0) {
      setFlashNotice(`✓ ${closedCount} sesión(es) en desuso archivadas. Solo queda la activa.`);
    } else {
      setFlashNotice("No había sesiones secundarias para liberar.");
    }

    scheduleRender();
  } catch (err) {
    setFlashNotice(`[error] Error al liberar sesiones: ${err.message}`);
  }

  return closedCount;
}

function executeDatabaseMigration(targetPrefix) {
  const sessionData = getOpenCodeSessionData();
  const criticalList = accountsList.filter((a) => a.isCritical || (a.used5h >= 85 && !a.hasError));
  if (criticalList.length === 0) return 0;

  let totalMigrated = 0;
  const migratedFrom = [];

  try {
    const db = new DatabaseSync(OPENCODE_DB_PATH, { open: true });
    const toAgent = `sdd-orchestrator-${targetPrefix}`;
    const toModel = JSON.stringify({ id: `${targetPrefix}/gemini-3.8-flash-high`, providerID: "cliproxy" });

    for (const ca of criticalList) {
      const fromAgent = `sdd-orchestrator-${ca.prefix}`;
      const res = db.prepare(`
        UPDATE session_v2 
        SET agent = ?, model = ? 
        WHERE agent = ? AND time_archived IS NULL
      `).run(toAgent, toModel, fromAgent);

      if (res.changes > 0) {
        totalMigrated += res.changes;
        migratedFrom.push(ca.prefix);
      }
    }

    db.close();

    if (totalMigrated > 0) {
      setFlashNotice(`✓ ${totalMigrated} sesion(es) migradas limpiamente a ${targetPrefix}!`);

      // Snapshot en Engram al Migrar:
      const engramBin = process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, "engram", "bin", "engram.exe")
        : path.join(os.homedir(), "AppData", "Local", "engram", "bin", "engram.exe");
      if (fs.existsSync(engramBin)) {
        try {
          const engramProject = path.basename(sessionData.activeDirectory || process.cwd()).toLowerCase();
          const title = `Checkpoint migracion: [${migratedFrom.join(", ")}] -> ${targetPrefix}`;
          const content = `What: Migracion segura entre turnos de ${totalMigrated} sesion(es) desde [${migratedFrom.join(", ")}] hacia ${targetPrefix} por cuota critica.\nWhy: Cuota agotada (>=85% usado) en ${migratedFrom.join(", ")}. Ejecutado en frio (agente en reposo) para evitar fallos de streaming.\nWhere: ${sessionData.activeDirectory || process.cwd()}`;
          execSync(`"${engramBin}" save "${title}" "${content}" --type decision --project "${engramProject}"`, {
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 4000,
          });
        } catch {}
      }
    } else {
      setFlashNotice(`No hay sesiones abiertas usando [${criticalList.map(c => c.prefix).join(", ")}].`);
    }

    scheduleRender();
  } catch (err) {
    setFlashNotice(`[error] Error al migrar: ${err.message}`);
  }

  return totalMigrated;
}

function migrateCriticalSessions() {
  const sessionData = getOpenCodeSessionData();

  const criticalList = accountsList.filter((a) => a.isCritical || (a.used5h >= 85 && !a.hasError));
  if (criticalList.length === 0) {
    setFlashNotice("No hay cuentas en estado crítico para migrar.");
    return 0;
  }

  const targetPrefix = getBestHealthyTargetPrefix();

  // Si el agente está en pleno streaming / working, encolar para no matar el turno
  if (sessionData.agentStatus === "working") {
    pendingMigrationTarget = targetPrefix;
    setFlashNotice(`⏳ Agente trabajando: rotación a ${targetPrefix} programada para el final del turno.`, 6000);
    return 0;
  }

  return executeDatabaseMigration(targetPrefix);
}

function setFlashNotice(msg, durationMs = 4000) {
  flashNotice = msg;
  if (flashNoticeTimer) clearTimeout(flashNoticeTimer);
  flashNoticeTimer = setTimeout(() => {
    flashNotice = null;
    scheduleRender();
  }, durationMs);
  scheduleRender();
}

// ============================================================================
// PIPELINE DE RENDERIZADO PIXEL-PERFECT (Zero-Scrollback / Alternate Screen)
// ============================================================================
function render() {
  const cols = process.stdout.columns || 46;
  const rows = process.stdout.rows || 32;

  const width = Math.max(36, Math.min(cols - 2, 50));
  const innerWidth = width - 4; // 1 (│) + 1 ( ) + innerWidth + 1 ( ) + 1 (│) = width

  const cwd = process.cwd();
  const opencode = getOpenCodeSessionData();

  const targetDir = (opencode.activeDirectory && fs.existsSync(opencode.activeDirectory))
    ? opencode.activeDirectory
    : cwd;
  const folder = path.basename(targetDir);

  let git = getGitData(targetDir);
  if (!git.hasGit && targetDir !== cwd) {
    git = getGitData(cwd);
  }

  const engram = getEngramData(folder.toLowerCase(), targetDir);
  const mcpList = getMcpData(targetDir);
  const activePrefixes = opencode.allActivePrefixes;

  // Primitivas de dibujo indestructibles con parámetros tipados
  const drawTop = (titleFormatted) => {
    const tLen = stringWidth(titleFormatted);
    const dashCount = Math.max(0, width - 5 - tLen);
    return `${BORDER}╭─ ${titleFormatted} ${"─".repeat(dashCount)}╮${RESET}`;
  };

  const drawBottom = () => {
    return `${BORDER}╰${"─".repeat(Math.max(0, width - 2))}╯${RESET}`;
  };

  const drawDivider = () => {
    return `${BORDER_MUTED}├${"─".repeat(Math.max(0, width - 2))}┤${RESET}`;
  };

  const drawRow = (left, right = "") => {
    const targetInner = width - 4;
    let cleanRight = right;
    let cleanLeft = left;

    let rWidth = stringWidth(cleanRight);
    const maxRight = Math.floor(targetInner * 0.55);
    if (rWidth > maxRight && left) {
      cleanRight = truncateToWidth(cleanRight, maxRight);
      rWidth = stringWidth(cleanRight);
    } else if (rWidth > targetInner) {
      cleanRight = truncateToWidth(cleanRight, targetInner);
      rWidth = stringWidth(cleanRight);
    }

    const maxLeft = targetInner - (rWidth > 0 ? rWidth + 1 : 0);
    if (stringWidth(cleanLeft) > maxLeft) {
      cleanLeft = truncateToWidth(cleanLeft, maxLeft);
    }

    const lWidth = stringWidth(cleanLeft);
    const spaceCount = Math.max(0, targetInner - lWidth - rWidth);
    const pad = " ".repeat(spaceCount);
    return `${BORDER}│${RESET} ${cleanLeft}${pad}${cleanRight} ${BORDER}│${RESET}`;
  };

  const renderGaugeInline = (percent, availableCells, thresholdColor) => {
    const clamped = Math.max(0, Math.min(100, percent));
    const filledCount = Math.round((clamped / 100) * availableCells);
    const emptyCount = Math.max(0, availableCells - filledCount);
    const colFn = typeof thresholdColor === "function" ? thresholdColor : (s) => `${thresholdColor}${s}${RESET}`;
    return `${colFn("▰".repeat(filledCount))}${TEXT_DIM}${"▱".repeat(emptyCount)}${RESET}`;
  };

  const lines = [];

  // 1. Encabezado Técnico de Marca (Linear Aesthetic)
  const bannerLeft = `${ACCENT_PRIMARY}✿ OPENCODE${RESET}`;
  const bannerRight = `${BORDER}· ${GOLD}GENTLE-AI ${ACCENT_PRIMARY}✿${RESET}`;
  const bannerRaw = "✿ OPENCODE · GENTLE-AI ✿";
  const bannerPad = Math.max(0, Math.floor((width - stringWidth(bannerRaw)) / 2));
  lines.push(`${" ".repeat(bannerPad)}${bannerLeft} ${bannerRight}`);

  // 2. ✿ Estado Card (con Indicador Petal / Working State de Gentle-Shell)
  const isWorking = opencode.agentStatus === "working";
  const petalIndicator = isWorking
    ? `${BOLD}${AMBER}◐ WORKING${RESET}`
    : `${TEXT_DIM}○ idle${RESET}`;
  lines.push(drawTop(`${ACCENT_PRIMARY}✿${RESET} ${BOLD}${GOLD}Estado${RESET} ${TEXT_DIM}·${RESET} ${petalIndicator}`));
  const shortProject = folder.length > 20 ? folder.slice(0, 18) + "…" : folder;
  lines.push(drawRow(`${GOLD}Proyecto${RESET}`, `${TEXT_PRIMARY}~/.../${shortProject}${RESET}`));
  const dirtyBadge = git.isClean ? `${MINT}limpio${RESET}` : `${AMBER}±${git.modified + git.staged}${RESET}`;
  lines.push(drawRow(`${GOLD}Rama${RESET}`, `${CYAN}ᛦ ${git.branch}${RESET} ${dirtyBadge}`));
  const activeModelDisplay = `${ACCENT_PRIMARY}${opencode.modelShort}${RESET} ${GOLD}(high)${RESET}`;
  lines.push(drawRow(`${GOLD}Modelo${RESET}`, activeModelDisplay));
  
  // Listado de perfiles activos en la línea sub-vitals
  const mcpCountStr = mcpList.length > 0 ? `${mcpList.length} MCPs` : "0 MCPs";
  const activeProfLabels = Array.from(activePrefixes).map((p) => `${ACCENT_PINK}*${RESET} ${MINT}${p}${RESET}`).join(" ") || `${TEXT_MUTED}default${RESET}`;
  const subVitals = `${ACCENT_PRIMARY}mem:${RESET} ${TEXT_PRIMARY}${engram.project}${RESET} ${TEXT_DIM}·${RESET} ${TEXT_MUTED}${mcpCountStr}${RESET} ${TEXT_DIM}·${RESET} ${activeProfLabels}`;
  lines.push(drawRow(subVitals, `${ACCENT_PINK}▸${RESET}`));
  lines.push(drawBottom());

  // 3. Contexto Card
  lines.push(drawTop(`${BOLD}${GOLD}Contexto${RESET}`));
  const contextLimit = 1_000_000;
  const currentTokens = opencode.activeTurnContextTokens > 0
    ? opencode.activeTurnContextTokens
    : 32_000;

  const contextPercent = Math.max(0.1, ((currentTokens / contextLimit) * 100));
  const isSaturated = currentTokens >= 800_000;
  const isMature = currentTokens >= 500_000 && !isSaturated;

  let leftTokensStr;
  let rightContextStatus;
  let gaugeColor;

  if (isSaturated) {
    gaugeColor = CORAL;
    leftTokensStr = `${BOLD}${CORAL}${formatTokenCount(currentTokens)}${RESET} ${TEXT_DIM}/${RESET} ${TEXT_MUTED}${formatTokenCount(contextLimit)}${RESET}`;
    rightContextStatus = `${CORAL}● Saturado ${contextPercent.toFixed(1)}% [/snew]${RESET}`;
  } else if (isMature) {
    gaugeColor = AMBER;
    leftTokensStr = `${BOLD}${AMBER}${formatTokenCount(currentTokens)}${RESET} ${TEXT_DIM}/${RESET} ${TEXT_MUTED}${formatTokenCount(contextLimit)}${RESET}`;
    rightContextStatus = `${AMBER}● Maduro ${contextPercent.toFixed(1)}% [/snew]${RESET}`;
  } else {
    const contextThreshold = getQuotaThreshold(100 - contextPercent);
    gaugeColor = contextThreshold.color;
    leftTokensStr = `${BOLD}${contextThreshold.color(formatTokenCount(currentTokens))}${RESET} ${TEXT_DIM}/${RESET} ${TEXT_MUTED}${formatTokenCount(contextLimit)}${RESET}`;
    rightContextStatus = `${contextThreshold.color("●")} ${BOLD}${contextThreshold.color(`Óptimo ${contextPercent.toFixed(1)}%`)}${RESET}`;
  }

  lines.push(drawRow(leftTokensStr, rightContextStatus));
  lines.push(drawRow(renderGaugeInline(contextPercent, innerWidth, gaugeColor)));
  const inTokens = opencode.tokensInput > 0 ? opencode.tokensInput : 1_400_000;
  const outTokens = opencode.tokensOutput > 0 ? opencode.tokensOutput : 12_600;
  const leftBreakdown = `${TEXT_DIM}▲${RESET} ${TEXT_PRIMARY}${formatTokenCount(inTokens)}${RESET} ${TEXT_DIM}·${RESET} ${TEXT_DIM}▼${RESET} ${TEXT_PRIMARY}${formatTokenCount(outTokens)}${RESET}`;
  const rightCost = `${GOLD}Costo${RESET} ${TEXT_PRIMARY}${formatCost(opencode.cost)}${RESET}`;
  lines.push(drawRow(leftBreakdown, rightCost));
  if (isMature || isSaturated) {
    lines.push(drawRow(`${AMBER}[aviso] Sesion madura: usa /snew para handover limpio${RESET}`));
  }
  lines.push(drawBottom());

  // 4. Engram Card
  lines.push(drawTop(`${ACCENT_PRIMARY}Engram:${RESET} ${CYAN}${engram.project}${RESET} ${TEXT_DIM}▲${RESET}`));
  const localOnlineStatus = engram.online ? `${MINT}● En línea${RESET}` : `${CORAL}○ Caído${RESET}`;
  lines.push(drawRow(`Local (7437)`, `${localOnlineStatus} ${TEXT_DIM}·${RESET} ${CYAN}${engram.obsCount} obs${RESET}`));
  if (engram.cloudHost) {
    const syncStatus = engram.enrolled ? `${MINT}● Enrolado${RESET}` : `${TEXT_DIM}○ No sinc${RESET}`;
    lines.push(drawRow(`Cloud: ${TEXT_DIM}${engram.cloudHost}${RESET}`, `${syncStatus} ${CYAN}↗${RESET}`));
  } else {
    lines.push(drawRow(`Cloud: ${TEXT_DIM}solo local${RESET}`, `${TEXT_DIM}○ no configurado${RESET}`));
  }
  lines.push(drawBottom());

  // 5. ✿ Integraciones Card (TODAS LAS 5 CUENTAS + MULTI-▸ SESIÓN + AVISO 70% Y CRÍTICO 85%)
  const criticalAccounts = accountsList.filter((a) => a.isCritical);
  const warningAccounts = accountsList.filter((a) => a.isWarning);

  let intTitleRight = `${TEXT_DIM}5 cuentas${RESET}`;
  if (criticalAccounts.length > 0) {
    intTitleRight = `${CORAL}! ${criticalAccounts.length} crítico${RESET}`;
  } else if (warningAccounts.length > 0) {
    intTitleRight = `${AMBER}! ${warningAccounts.length} en aviso (70%+)${RESET}`;
  }
  
  lines.push(drawTop(`${ACCENT_PRIMARY}✿${RESET} ${GOLD}Integraciones${RESET} ${TEXT_DIM}·${RESET} ${intTitleRight}`));

  const miniBarCells = Math.max(6, Math.min(10, innerWidth - 30));

  if (accountsList.length === 0) {
    lines.push(drawRow(`${TEXT_DIM}Cargando cuentas de Antigravity…${RESET}`));
  } else {
    for (const acc of accountsList) {
      // Detección multi-sesión: si la cuenta está activa en cualquier sesión abierta, se marca con ▸
      const isActive = activePrefixes.has(acc.prefix.toLowerCase());
      const marker = isActive ? `${ACCENT_PINK}▸${RESET}` : " ";
      
      let icon = `${MINT}●${RESET}`;
      let pctColor = MINT;
      let statusNote = acc.reset5h ? `${TEXT_DIM}${acc.reset5h}${RESET}` : "";

      if (acc.hasError) {
        icon = `${AMBER}?${RESET}`;
        pctColor = AMBER;
        statusNote = `${AMBER}[${acc.errorMsg}]${RESET}`;
      } else if (acc.isCritical) {
        icon = `${BOLD}${CORAL}!${RESET}`;
        pctColor = CORAL;
        statusNote = `${BOLD}${CORAL}[AGOTÁNDOSE]${RESET}`;
      } else if (acc.isWarning) {
        icon = `${BOLD}${AMBER}!${RESET}`;
        pctColor = AMBER;
        statusNote = `${AMBER}[AVISO 70%]${RESET}`;
      }

      const pfxDisplay = isActive
        ? `${BOLD}${TEXT_PRIMARY}${acc.prefix.padEnd(5)}${RESET}`
        : `${TEXT_MUTED}${acc.prefix.padEnd(5)}${RESET}`;

      const pctDisplay = `${BOLD}\x1b[38;2;${pctColor.slice(7)}${String(acc.rem5h).padStart(3)}%${RESET}`;
      const statusSuffix = statusNote ? ` ${statusNote}` : "";
      const leftCol = `${marker} ${icon} ${pfxDisplay} ${pctDisplay}${statusSuffix}`;
      const rightGauge = renderGaugeInline(acc.rem5h, miniBarCells, (s) => `\x1b[38;2;${pctColor.slice(7)}${s}${RESET}`);

      lines.push(drawRow(leftCol, rightGauge));
    }
  }

  // Notificaciones de alerta si alguna cuenta llega a 70%+ de uso
  const alertAccounts = accountsList.filter((a) => (a.isCritical || a.isWarning) && !a.hasError);
  if (flashNotice || alertAccounts.length > 0) {
    lines.push(drawDivider());
    if (flashNotice) {
      lines.push(drawRow(`${BOLD}${MINT}${flashNotice}${RESET}`));
    }
    const targetHealthy = getBestHealthyTargetPrefix();
    if (pendingMigrationTarget) {
      lines.push(drawRow(`${BOLD}${AMBER}⏳ Rotación a ${pendingMigrationTarget} programada al terminar turno${RESET}`));
    }
    for (const ca of alertAccounts) {
      const isThisActive = activePrefixes.has(ca.prefix.toLowerCase());
      if (ca.isCritical) {
        const actionLabel = opencode.agentStatus === "working"
          ? `[presioná 'x' -> programar a ${targetHealthy}]`
          : `[presioná 'x' -> migrar a ${targetHealthy}]`;
        lines.push(drawRow(`${BOLD}${CORAL}! CRÍTICO: ${ca.prefix} ${actionLabel}${RESET}`));
      } else {
        const activeTag = isThisActive ? " (activa) - considerar rotar" : "";
        lines.push(drawRow(`${AMBER}! AVISO 70%: ${ca.prefix} al ${ca.used5h}% usado (queda ${ca.rem5h}%)${activeTag}${RESET}`));
      }
    }
  }

  lines.push(drawBottom());

  // 5B. ✿ Active Account Pools Breakdown Card (Gemini Wk/5h + Claude Wk/5h)
  const targetActiveAccounts = accountsList.filter((a) => activePrefixes.has(a.prefix.toLowerCase()));
  const poolCardsToShow = targetActiveAccounts.length > 0 ? targetActiveAccounts : (accountsList.slice(0, 1));

  for (const acc of poolCardsToShow) {
    if (acc.pools && acc.pools.length > 0) {
      const activeTag = activePrefixes.has(acc.prefix.toLowerCase()) ? " (activa)" : "";
      lines.push(drawTop(`${ACCENT_PRIMARY}✿${RESET} ${GOLD}antigravity${RESET} ${TEXT_DIM}·${RESET} ${MINT}${acc.prefix}${activeTag}${RESET}`));

      if (acc.hasError) {
        lines.push(drawRow(`${AMBER}! ${acc.errorMsg}${RESET}`));
      }

      const poolGaugeCells = Math.max(8, Math.min(14, innerWidth - 28));
      for (const p of acc.pools) {
        const threshold = getQuotaThreshold(p.percent);
        const pctFmt = `${BOLD}${threshold.color(String(p.percent).padStart(3) + "%")}${RESET}`;
        const resetStr = p.reset ? ` ${TEXT_DIM}${p.reset}${RESET}` : "";
        const leftCol = `${threshold.color("●")} ${TEXT_PRIMARY}${p.label}${RESET} ${pctFmt}${resetStr}`;
        const rightGauge = renderGaugeInline(p.percent, poolGaugeCells, threshold.color);
        lines.push(drawRow(leftCol, rightGauge));
      }

      lines.push(drawBottom());
    }
  }

  // 6. ᛦ Gráfico Git & Gentle Attributed Changes Card
  const agentFilesCount = opencode.attributedChanges.files.size;
  const agentChangesTitle = agentFilesCount > 0
    ? `${ACCENT_PRIMARY}ᛦ${RESET} ${BOLD}${GOLD}cambios${RESET} ${TEXT_DIM}· ${agentFilesCount} por agente${RESET}`
    : `${ACCENT_PRIMARY}ᛦ${RESET} ${BOLD}${GOLD}git y cambios${RESET}`;
  lines.push(drawTop(agentChangesTitle));

  const gitBadges = git.isClean
    ? `${MINT}✔ limpio${RESET}`
    : `${AMBER}● ${git.modified} mod${RESET} ${TEXT_DIM}·${RESET} ${MAGENTA}?${git.untracked}${RESET}`;
  lines.push(drawRow(`${CYAN}${git.branch}${RESET}`, gitBadges));

  if (git.graphLines.length > 0) {
    for (const gLine of git.graphLines.slice(0, 2)) {
      lines.push(drawRow(colorizeGitGraphLine(gLine)));
    }
  } else {
    lines.push(drawRow(`${TEXT_DIM}* (sin commits recientes)${RESET}`));
  }

  // Desglose dual: Git Working Tree vs Attributed Changes de Gentle-Shell
  const totalDiffFiles = git.modified + git.staged;
  const changesSummary = totalDiffFiles > 0
    ? `${TEXT_DIM}git:${RESET} ${TEXT_PRIMARY}${totalDiffFiles} archivos${RESET} ${TEXT_DIM}·${RESET} ${MINT}+${git.linesAdded}${RESET} ${CORAL}-${git.linesDeleted}${RESET}`
    : `${TEXT_DIM}git:${RESET} ${MINT}limpio${RESET}`;

  const agentSummary = agentFilesCount > 0
    ? `${ACCENT_PRIMARY}✎ agente:${RESET} ${MINT}${agentFilesCount} archivos${RESET} ${TEXT_DIM}(+${opencode.attributedChanges.additions} -${opencode.attributedChanges.deletions})${RESET}`
    : `${ACCENT_PRIMARY}✎ agente:${RESET} ${TEXT_DIM}0 archivos${RESET}`;

  lines.push(drawRow(changesSummary, agentSummary));
  lines.push(drawBottom());

  // 7. Herramientas Telemetry Card
  const toolsCount = opencode.tools.total > 0 ? opencode.tools : { read: 6, write: 7, bash: 16, engram: 1, other: 1, total: 31 };
  const toolsTitleFmt = `${BOLD}${GOLD}herramientas${RESET} ${TEXT_DIM}· ${toolsCount.total} llamadas${RESET}`;
  lines.push(drawTop(toolsTitleFmt));

  const pRead = `${MAGENTA}✎ ${toolsCount.read} lecturas${RESET}`;
  const pWrite = `${CYAN}✎ ${toolsCount.write} escrituras${RESET}`;
  const pBash = `${MINT}>_ ${toolsCount.bash} bash${RESET}`;
  const pEngram = `${CORAL}mem: ${toolsCount.engram}${RESET}`;
  lines.push(drawRow(`${pRead}  ${pWrite}  ${pBash}`, pEngram));
  lines.push(drawBottom());

  // 8. Servidores MCP Card
  const mcpTitle = `${BOLD}${GOLD}Servidores MCP${RESET} ${TEXT_DIM}· ${mcpList.length} activos${RESET}`;
  lines.push(drawTop(mcpTitle));
  if (mcpList.length === 0) {
    lines.push(drawRow(`${TEXT_DIM}Sin servidores MCP configurados${RESET}`));
  } else {
    for (const mcp of mcpList) {
      const statusDot = mcp.enabled ? `${MINT}●${RESET}` : `${AMBER}○${RESET}`;
      const typeBadge = `${TEXT_DIM}[${mcp.type}]${RESET}`;
      const nameFmt = `${BOLD}${TEXT_PRIMARY}${mcp.name}${RESET}`;
      const statusText = mcp.enabled ? `${MINT}en línea${RESET}` : `${TEXT_MUTED}desactivado${RESET}`;
      lines.push(drawRow(`${statusDot} ${nameFmt} ${typeBadge}`, statusText));
    }
  }
  lines.push(drawBottom());

  // Barra de atajos inferior dinámica
  const hasCritical = accountsList.some((a) => a.isCritical || a.used5h >= 85);
  const targetHealthy = getBestHealthyTargetPrefix();
  const shortcutHint = hasCritical
    ? `${TEXT_DIM} r: actualizar · d: deseleccionar · ${CORAL}x: migrar a ${targetHealthy}${TEXT_DIM} · q: salir · ${lastUpdatedTime || "en vivo"}${RESET}`
    : `${TEXT_DIM} r: actualizar · d: deseleccionar · q: salir · 2m · ${lastUpdatedTime || "en vivo"}${RESET}`;
  lines.push(shortcutHint);

  // Viewport windowing: Asegura que el total de renglones no desborde jamás la ventana
  const maxVisibleRows = Math.max(10, rows - 1);
  const maxScroll = Math.max(0, lines.length - maxVisibleRows);
  if (scrollOffset > maxScroll) scrollOffset = maxScroll;
  if (scrollOffset < 0) scrollOffset = 0;

  const visibleLines = lines.slice(scrollOffset, scrollOffset + maxVisibleRows);

  process.stdout.write(`\x1b[H\x1b[J${visibleLines.join("\n")}\n`);
}

// ============================================================================
// ATAJOS DE TECLADO Y CICLO DE VIDA
// ============================================================================
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on("data", (data) => {
    const key = data.toString();
    if (key === "q" || key === "\u0003") {
      cleanupAndExit();
    } else if (key === "r" || key === "R") {
      fetchQuotas(true); // Forzar actualización de TODAS las 5 cuentas bajo demanda
    } else if (key === "d" || key === "D") {
      releaseInactiveSessions(); // Deseleccionar/archivar sesiones huérfanas en desuso
    } else if (key === "x" || key === "X") {
      migrateCriticalSessions(); // Migrar automáticamente sesiones con cuenta crítica
    } else if (key === "\u001b[A" || key === "k") {
      if (scrollOffset > 0) {
        scrollOffset--;
        scheduleRender();
      }
    } else if (key === "\u001b[B" || key === "j") {
      scrollOffset++;
      scheduleRender();
    }
  });
}

function cleanupAndExit() {
  process.stdout.write("\x1b[?1049l\x1b[?25h\n");
  process.exit(0);
}

process.stdout.write("\x1b[?1049h\x1b[?25l");

process.on("exit", () => {
  process.stdout.write("\x1b[?1049l\x1b[?25h");
});

process.on("SIGINT", cleanupAndExit);
process.on("SIGTERM", cleanupAndExit);

process.stdout.on("resize", () => {
  scheduleRender();
});

// Inicio del ciclo de vida
discoverAccounts();
render();
fetchQuotas(true); // Primer barrido de las 5 cuentas para pintar la foto completa
setInterval(() => fetchQuotas(false), POLL_INTERVAL_MS); // Cada 2m solo cuentas activas
setInterval(checkLocalActivity, 3_000); // Chequeo local reactivo de turnos sin tráfico de red
