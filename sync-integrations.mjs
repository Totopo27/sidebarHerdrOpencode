import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as http from "node:http";

const MODEL_TEMPLATES = {
  "claude-opus-4-6-thinking": {
    capabilities: { input: ["text", "image"], output: ["text"], tools: true },
    compatibility: { reasoningField: "reasoning_content" },
    limit: { context: 200000, output: 64000 },
    baseName: "Claude Opus 4.6 (thinking)"
  },
  "claude-sonnet-4-6": {
    capabilities: { input: ["text", "image"], output: ["text"], tools: true },
    compatibility: { reasoningField: "reasoning_content" },
    limit: { context: 200000, output: 64000 },
    baseName: "Claude Sonnet 4.6"
  },
  "gemini-3.8-flash-high": {
    capabilities: { input: ["text", "image"], output: ["text"], tools: true },
    compatibility: { reasoningField: "reasoning_content" },
    limit: { context: 1048576, output: 65536 },
    baseName: "Gemini 3.8 Flash (high)"
  },
  "gemini-pro-agent": {
    capabilities: { input: ["text", "image"], output: ["text"], tools: true },
    compatibility: { reasoningField: "reasoning_content" },
    limit: { context: 1048576, output: 65536 },
    baseName: "Gemini Pro Agent"
  },
  "gpt-oss-120b-medium": {
    capabilities: { input: ["text"], output: ["text"], tools: true },
    compatibility: { reasoningField: "reasoning_content" },
    limit: { context: 131072, output: 128000 },
    baseName: "GPT-OSS 120B (medium)"
  }
};

function fetchRemoteModels(baseURL = "http://127.0.0.1:8317/v1", apiKey = "") {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(baseURL.endsWith("/models") ? baseURL : `${baseURL.replace(/\/+$/, "")}/models`);
      const options = {
        hostname: u.hostname,
        port: u.port || 80,
        path: `${u.pathname}${u.search}`,
        method: "GET",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
      };
      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            if (data && Array.isArray(data.data)) {
              resolve(data.data);
            } else {
              reject(new Error("Respuesta inválida de CLI Proxy"));
            }
          } catch (e) {
            reject(new Error(`Error parseando JSON: ${e.message}`));
          }
        });
      });
      req.on("error", (err) => reject(err));
      req.setTimeout(3000, () => {
        req.destroy(new Error("Timeout conectando con CLI Proxy (3s)"));
      });
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function syncIntegrationsAndOrchestrators() {
  const opencodeJsonPathD = "D:/.opencode/opencode.json";
  const opencodeJsonPathC = path.join(os.homedir(), ".config/opencode/opencode.json");

  const targetPath = fs.existsSync(opencodeJsonPathD) ? opencodeJsonPathD : opencodeJsonPathC;
  if (!fs.existsSync(targetPath)) {
    throw new Error("No se encontró opencode.json ni en D:/.opencode ni en .config");
  }

  const rawConfig = JSON.parse(fs.readFileSync(targetPath, "utf8"));
  const cliproxyProvider = rawConfig.providers?.cliproxy || rawConfig.provider?.cliproxy;
  if (!cliproxyProvider) {
    throw new Error("No se encontró el provider 'cliproxy' en opencode.json");
  }

  const baseURL = cliproxyProvider.settings?.baseURL || cliproxyProvider.options?.baseURL || "http://127.0.0.1:8317/v1";
  const apiKey = cliproxyProvider.settings?.apiKey || cliproxyProvider.options?.apiKey || "";

  // 1. Obtener modelos remotos de CLI Proxy
  const remoteModels = await fetchRemoteModels(baseURL, apiKey);
  const modelsMap = cliproxyProvider.models || {};

  let addedModelsCount = 0;
  for (const remote of remoteModels) {
    const id = remote.id;
    if (!modelsMap[id]) {
      let prefix = "";
      let baseKey = id;
      if (id.includes("/")) {
        const parts = id.split("/");
        prefix = parts[0];
        baseKey = parts[1];
      }

      const tpl = MODEL_TEMPLATES[baseKey];
      if (tpl) {
        modelsMap[id] = {
          capabilities: JSON.parse(JSON.stringify(tpl.capabilities)),
          compatibility: JSON.parse(JSON.stringify(tpl.compatibility)),
          limit: JSON.parse(JSON.stringify(tpl.limit)),
          name: prefix ? `${tpl.baseName} [${prefix}]` : tpl.baseName
        };
        addedModelsCount++;
      }
    }
  }

  // Ordenar alfabéticamente
  const sortedKeys = Object.keys(modelsMap).sort();
  const sortedModels = {};
  for (const k of sortedKeys) {
    sortedModels[k] = modelsMap[k];
  }
  cliproxyProvider.models = sortedModels;

  // 2. Auditar y auto-asignar modelos faltantes a los orquestadores SDD
  let repairedOrchestratorsCount = 0;

  // Soportar tanto "agent" como "agents" para compatibilidad con V1, V2 y Gentle AI
  const agentSections = [];
  if (rawConfig.agent && typeof rawConfig.agent === "object") agentSections.push(rawConfig.agent);
  if (rawConfig.agents && typeof rawConfig.agents === "object") agentSections.push(rawConfig.agents);

  // Lista de cuentas conocidas detectadas en los modelos remotos
  const knownAccountPrefixes = new Set();
  for (const mId of Object.keys(modelsMap)) {
    if (mId.includes("/")) {
      knownAccountPrefixes.add(mId.split("/")[0]);
    }
  }

  for (const section of agentSections) {
    for (const [agentName, agentDef] of Object.entries(section)) {
      if (agentName.startsWith("sdd-orchestrator-") && agentDef) {
        if (!agentDef.model || typeof agentDef.model !== "string" || !agentDef.model.trim()) {
          const profile = agentName.replace("sdd-orchestrator-", "").trim().toLowerCase();

          // Detección inteligente de familia de modelo según el nombre del orquestador o sus subagentes
          let assignedModelKey = null;

          if (profile.includes("claude") || profile.includes("opus")) {
            // Prioridad para perfiles Claude: Claude Opus 4.6 (thinking)
            if (knownAccountPrefixes.has(profile) && modelsMap[`${profile}/claude-opus-4-6-thinking`]) {
              assignedModelKey = `${profile}/claude-opus-4-6-thinking`;
            } else if (modelsMap["claude-opus-4-6-thinking"]) {
              assignedModelKey = "claude-opus-4-6-thinking";
            } else if (modelsMap["claude-sonnet-4-6"]) {
              assignedModelKey = "claude-sonnet-4-6";
            }
          } else if (profile.includes("sonnet")) {
            if (knownAccountPrefixes.has(profile) && modelsMap[`${profile}/claude-sonnet-4-6`]) {
              assignedModelKey = `${profile}/claude-sonnet-4-6`;
            } else if (modelsMap["claude-sonnet-4-6"]) {
              assignedModelKey = "claude-sonnet-4-6";
            }
          } else if (profile.includes("gpt") || profile.includes("oss")) {
            if (knownAccountPrefixes.has(profile) && modelsMap[`${profile}/gpt-oss-120b-medium`]) {
              assignedModelKey = `${profile}/gpt-oss-120b-medium`;
            } else if (modelsMap["gpt-oss-120b-medium"]) {
              assignedModelKey = "gpt-oss-120b-medium";
            }
          } else {
            // Familia Gemini o perfiles asociados directamente al nombre de cuenta (gianni, tavo, etc.)
            const candidateModelKey = `${profile}/gemini-3.8-flash-high`;
            if (modelsMap[candidateModelKey]) {
              assignedModelKey = candidateModelKey;
            } else if (modelsMap["gemini-3.8-flash-high"]) {
              assignedModelKey = "gemini-3.8-flash-high";
            }
          }

          if (assignedModelKey) {
            agentDef.model = `cliproxy/${assignedModelKey}`;
            repairedOrchestratorsCount++;

            // Si el system prompt tiene la tabla de 'Model Assignments', actualizar la fila del orchestrator
            if (typeof agentDef.system === "string" && agentDef.system.includes("## Model Assignments")) {
              agentDef.system = agentDef.system.replace(
                /(\|\s*orchestrator\s*\|\s*)(—|[^|]+)(\s*\|\s*Coordinates,\s*makes decisions\s*\|)/,
                `$1cliproxy/${assignedModelKey}$3`
              );
            }
          }
        } else if (typeof agentDef.system === "string" && agentDef.system.includes("## Model Assignments") && agentDef.model) {
          // Si el agente ya tenía model pero la tabla en el prompt aún tenía "—"
          if (agentDef.system.includes("| orchestrator | — | Coordinates, makes decisions |")) {
            agentDef.system = agentDef.system.replace(
              "| orchestrator | — | Coordinates, makes decisions |",
              `| orchestrator | ${agentDef.model} | Coordinates, makes decisions |`
            );
          }
        }
      }
    }
  }

  // 3. Guardar cambios en ambos directorios
  const updatedContent = JSON.stringify(rawConfig, null, 2);
  fs.writeFileSync(targetPath, updatedContent, "utf8");

  if (fs.existsSync(opencodeJsonPathD) && targetPath !== opencodeJsonPathD) {
    fs.writeFileSync(opencodeJsonPathD, updatedContent, "utf8");
  }
  if (fs.existsSync(opencodeJsonPathC) && targetPath !== opencodeJsonPathC) {
    fs.writeFileSync(opencodeJsonPathC, updatedContent, "utf8");
  }

  return {
    totalModels: Object.keys(sortedModels).length,
    addedModels: addedModelsCount,
    repairedOrchestrators: repairedOrchestratorsCount
  };
}

// Ejecución directa si se invoca por terminal: `node sync-integrations.mjs`
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename || "")) {
  syncIntegrationsAndOrchestrators()
    .then((res) => {
      console.log(`[ok] Sincronizacion exitosa: ${res.totalModels} modelos disponibles (+${res.addedModels} nuevos), ${res.repairedOrchestrators} orquestadores auditados.`);
    })
    .catch((err) => {
      console.error(`! Error en sincronización: ${err.message}`);
      process.exit(1);
    });
}
