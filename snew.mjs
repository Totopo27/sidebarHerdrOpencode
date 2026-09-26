#!/usr/bin/env node
/**
 * 🌸 snew: Handover y Creación de Sesión Limpia para OpenCode & Herdr 💜
 *
 * Flujo:
 * 1. Registra un hito de Handover en Engram para el proyecto activo.
 * 2. Si se ejecuta dentro de Herdr:
 *    - Abre una nueva pestaña limpia enfocada en el directorio actual.
 *    - Lanza OpenCode en el pane izquierdo.
 *    - Divide a la derecha con ratio 0.74 y arranca el sidebar con cuotas y métricas.
 * 3. Si se ejecuta en terminal independiente, lanza opencode con la nueva sesión.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";

const SCRIPT_DIR = import.meta.dirname || path.resolve(".");
const STATUS_SIDEBAR_CMD = path.join(SCRIPT_DIR, "status-sidebar.cmd");

const cwd = process.cwd();
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

console.log(`\x1b[38;2;123;138;255m✿ snew:\x1b[0m Iniciando handover para proyecto \x1b[1m${projectName}\x1b[0m...`);

// 1. Guardar Snapshot de Handover en Engram
const engramBin = "C:\\Users\\Gustavo\\AppData\\Local\\engram\\bin\\engram.exe";
if (fs.existsSync(engramBin)) {
  try {
    const title = `Handover: Nueva sesion limpia para ${projectName}`;
    const content = `**What**: Handover automatico y apertura de nueva sesion limpia via snew.\n**Why**: Restablecer ventana de contexto conservando las decisiones en memoria persistente.\n**Where**: ${cwd}`;
    execSync(`"${engramBin}" save "${title}" "${content}" --type decision --project "${projectName}"`, {
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    });
    console.log(`\x1b[38;2;76;183;130m✓\x1b[0m Handover registrado en Engram.`);
  } catch {
    // Continuar sin bloquear si engram no responde
  }
}

// 2. Comprobar si estamos en un entorno con Herdr
let inHerdr = false;
try {
  execSync("where herdr", { stdio: ["ignore", "pipe", "ignore"] });
  inHerdr = true;
} catch {}

if (inHerdr) {
  try {
    // Crear nueva pestaña en Herdr enfocada en el directorio actual
    const tabRaw = execSync(`herdr tab create --cwd "${cwd}" --label "${folder}" --focus`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const tabData = JSON.parse(tabRaw);
    const newTabId = tabData.result?.tab?.tab_id;

    if (newTabId) {
      console.log(`\x1b[38;2;76;183;130m✓\x1b[0m Nueva pestaña creada en Herdr (${folder}).`);

      // Buscar el pane principal de la nueva pestaña
      const listRaw = execSync("herdr pane list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const listData = JSON.parse(listRaw);
      const tabPanes = (listData.result?.panes || []).filter((p) => p.tab_id === newTabId);

      if (tabPanes.length > 0) {
        const mainPaneId = tabPanes[0].pane_id;
        // Lanzar OpenCode en el pane izquierdo
        execSync(`herdr pane run ${mainPaneId} "opencode"`, { stdio: ["ignore", "pipe", "ignore"] });

        // Crear split a la derecha para el sidebar con ratio 0.74 (26% sidebar)
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
      process.exit(0);
    }
  } catch (err) {
    // Si falla Herdr, fallback a consola local
  }
}

// Fallback: lanzar opencode localmente
console.log(`\x1b[38;2;123;138;255m✿\x1b[0m Abriendo OpenCode en nueva sesión...`);
execSync("opencode", { stdio: "inherit" });
