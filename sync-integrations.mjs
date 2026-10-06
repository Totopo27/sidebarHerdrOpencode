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
  if (rawConfig.agent && typeof rawConfig.agent === "object") {
    for (const [agentName, agentDef] of Object.entries(rawConfig.agent)) {
      if (agentName.startsWith("sdd-orchestrator-") && agentDef) {
        if (!agentDef.model || typeof agentDef.model !== "string" || !agentDef.model.trim()) {
          const profilePrefix = agentName.replace("sdd-orchestrator-", "").trim();
          const candidateModelKey = `${profilePrefix}/gemini-3.8-flash-high`;
          const genericModelKey = "gemini-3.8-flash-high";

          if (modelsMap[candidateModelKey]) {
            agentDef.model = `cliproxy/${candidateModelKey}`;
            repairedOrchestratorsCount++;
          } else if (modelsMap[genericModelKey]) {
            agentDef.model = `cliproxy/${genericModelKey}`;
            repairedOrchestratorsCount++;
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
      console.log(`✓ Sincronización exitosa: ${res.totalModels} modelos disponibles (+${res.addedModels} nuevos), ${res.repairedOrchestrators} orquestadores auditados.`);
    })
    .catch((err) => {
      console.error(`! Error en sincronización: ${err.message}`);
      process.exit(1);
    });
}
