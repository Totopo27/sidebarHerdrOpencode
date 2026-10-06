import { execSync } from "node:child_process";
import * as path from "node:path";
import * as fs from "node:fs";

const SCRIPT_DIR = import.meta.dirname || path.resolve(".");
const STATUS_SIDEBAR_CMD = path.join(SCRIPT_DIR, "status-sidebar.cmd");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // Esperar a que el servidor de Herdr esté respondiendo
  let herdrReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      execSync("herdr status server", { stdio: ["ignore", "pipe", "ignore"], encoding: "utf8" });
      herdrReady = true;
      break;
    } catch {
      await sleep(1000);
    }
  }

  if (!herdrReady) {
    process.exit(1);
  }

  // Pequeño margen para que Herdr termine de hidratar la sesión y restaurar panes
  await sleep(1500);

  try {
    const listRaw = execSync("herdr pane list", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const listData = JSON.parse(listRaw);
    const panes = listData.result?.panes || [];

    // Agrupar panes por tab
    const byTab = new Map();
    for (const p of panes) {
      if (!byTab.has(p.tab_id)) byTab.set(p.tab_id, []);
      byTab.get(p.tab_id).push(p);
    }

    for (const [tabId, tabPanes] of byTab.entries()) {
      if (tabPanes.length < 2) continue;

      const opencodePane = tabPanes.find((p) => p.agent === "opencode");
      const targetSide = opencodePane
        ? tabPanes.find((p) => p.pane_id !== opencodePane.pane_id)
        : tabPanes[1];

      if (!targetSide) continue;

      // Verificar si ya tiene el HUD corriendo
      try {
        const out = execSync(`herdr pane read ${targetSide.pane_id} --source visible --lines 10`, {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });
        const hasHud = out.includes("MCP") || out.includes("Engram") || out.includes("Herramientas") || out.includes("colapsar");
        if (!hasHud) {
          execSync(`herdr pane run ${targetSide.pane_id} ${JSON.stringify(STATUS_SIDEBAR_CMD)}`, {
            stdio: ["ignore", "pipe", "ignore"],
          });
        }
      } catch {}
    }
  } catch {}
}

main();
