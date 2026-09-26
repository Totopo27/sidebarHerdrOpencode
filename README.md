# 🌸 Sidebar Herdr OpenCode 💜
> **High-Density Developer HUD & Live Telemetry Sidebar for Herdr & OpenCode**  
> *Crafted with Linear & Anti-Slop Design Principles, Native Zero-Dependency SQLite Engine, and Multi-Account Quota Guardian.*

---

## 📸 Overview

**Sidebar Herdr OpenCode** is an ambient, high-density terminal HUD designed to run alongside [OpenCode](https://opencode.ai) inside the [Herdr](https://herdr.dev) terminal multiplexer. It transforms your terminal split into a cohesive, mission-control developer workspace displaying real-time session vitals, token consumption gauges, Engram persistent memory status, multi-account API quotas, Git commit history graphs, and live tool telemetry.

```text
           ✿ OPENCODE · GENTLE-AI ✿
╭─ ✿ Status ───────────────────────────────╮
│ Project            ~/.../mi-proyecto     │
│ Branch                        ᛦ main ±2  │
│ Model        gemini-3.8-flash-high (high)│
│ 🧠 mi-proyecto · 4 MCPs · ❀ xen1  ▸      │
╰──────────────────────────────────────────╯
╭─ ✿ Context ──────────────────────────────╮
│ 125.0k / 1.0M tokens        ● Óptimo 12.5%
│ ▰▰▰▰▰▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱▱
│ ▲ 1.4M in · ▼ 12.6k out        Cost $0.000
╰──────────────────────────────────────────╯
╭─ 🧠 Engram: mi-proyecto ▲ ───────────────╮
│ 🖥 Local (7437)         ● Online · 80 obs│
│ ☁ Cloud: local only     ○ no configurado │
╰──────────────────────────────────────────╯
╭─ ✿ Integrations · 5 cuentas ─────────────╮
│    ● gianni 100%               ▰▰▰▰▰▰▰▰▰▰│
│    ● tavo   100%               ▰▰▰▰▰▰▰▰▰▰│
│  ▸ ● xen1    74% en 2h 25m     ▰▰▰▰▰▰▰▱▱▱│
│    ● xen2   100%               ▰▰▰▰▰▰▰▰▰▰│
│    ● xen3   100%               ▰▰▰▰▰▰▰▰▰▰│
╰──────────────────────────────────────────╯
╭─ ✿ antigravity · xen1 (activa) ──────────╮
│ ● Gemini Wk   74% en 4d 4h   ▰▰▰▰▰▰▰▰▰▱▱▱│
│ ● Gemini 5h   24% en 26m     ▰▰▰▱▱▱▱▱▱▱▱▱│
│ ● Claude Wk   30% en 2d 5h   ▰▰▰▰▱▱▱▱▱▱▱▱│
│ ● Claude 5h  100% en 4h 59m  ▰▰▰▰▰▰▰▰▰▰▰▰│
╰──────────────────────────────────────────╯
╭─ ᛦ git graph ────────────────────────────╮
│ main                             ✔ clean │
│ * 858ee20 (HEAD -> main) feat: core hud  │
│ ✎ 0 files · clean         /gentle:changes│
╰──────────────────────────────────────────╯
╭─ 🛠 tools · 70 calls ─────────────────────╮
│ ✎ 23 read   ✎ 9 write   >_ 21 bash 🧠 17 mem
╰──────────────────────────────────────────╯
 r: refresh all · x: migrar · q: quit · 2m
```

---

## ✨ Características Principales

### 1. 🎛️ Suite Completa de Tarjetas HUD
* **✿ Status Card:** Proyecto activo, rama Git con indicador de archivos modificados (`±N`), modelo en uso (`gemini-3.8-flash-high (high)`), MCP servers activos y perfil de cuenta seleccionado (`❀ xen1 ▸`).
* **✿ Context Gauge Card:** Medición del tamaño de contexto en tokens del turno activo sobre la ventana de 1.0M. Semáforo progresivo:
  - 🟢 **Óptimo (< 500k tokens):** Verde menta con barra proporcional.
  - 🟡 **Maduro (500k – 799k tokens):** Badge ámbar `● Maduro XX% [/snew]` con aviso para planificar handover limpio.
  - 🔴 **Saturado (≥ 800k tokens):** Alerta en rojo coral `● Saturado [/snew]` para evitar degradación de contexto.
  - Desglose acumulativo de tokens `▲ In · ▼ Out` y costo en USD.
* **🧠 Engram Card:** Monitor del daemon de memoria persistente de Engram (`🖥️ Local (7437) ● Online · N obs`). Soporte dinámico de nube privada con protección contra fugas de infraestructura ajena.
* **✿ Integrations Card (Las 5 cuentas a la vista):**
  - Vista panorámica de todas tus cuentas (`gianni`, `tavo`, `xen1`, `xen2`, `xen3`) con sus medidores de la ventana móvil de 5 horas.
  - **Soporte Multi-Sesión en Paralelo:** Si trabajas en varios tabs/spaces con distintas cuentas, el HUD marca todas las que estén en uso activo con el triángulo rosa `▸`.
  - **Sistema de Alertas Progresivo:**
    - `[AVISO 70%]`: Se tiñe en amarillo ámbar a partir del 70% de consumo con línea explicativa.
    - `[AGOTÁNDOSE]`: Escala a rojo coral brillante al superar el 85% de consumo.
* **✿ Active Account Breakdown Card (4 Piscinas):**
  - Ubicado justo debajo de Integrations, desglosa las **4 cuotas reales** de la(s) cuenta(s) en uso:
    - `Gemini Weekly` + countdown de reseteo (`en 4d 4h`).
    - `Gemini 5h` + countdown (`en 26m`).
    - `Claude/GPT Weekly`.
    - `Claude/GPT 5h`.
* **ᛦ Git Graph Card:** Árbol de commits reciente renderizado con sintaxis Dracula (nodos `*` en rosa, hashes en dorado, ramas en menta/magenta), badges de estado porcelain y resumen de líneas cambiadas (`+X -Y /gentle:changes`).
* **🛠 Live Tools Telemetry Card:** Pastillas visuales que contabilizan en tiempo real las herramientas ejecutadas en la sesión (`read`, `write`, `bash`, `engram`, `other`).

---

## ⚡ Innovaciones de Rendimiento y Arquitectura

1. **Snapshot + Reactive Active Polling (Mitigación de `403 VALIDATION_REQUIRED`):**
   - Al iniciar, realiza **1 solo barrido** de todas las cuentas para darte la foto general.
   - En el intervalo periódico (cada 2 minutos), **SOLO consulta la(s) cuenta(s) activa(s) en uso**. Esto reduce las llamadas a Google Cloud Code en más de un **80%**, evitando disparar los sistemas de detección de bots.
   - Al terminar cualquier turno del asistente en OpenCode, el sidebar lo detecta localmente en milisegundos y refresca de inmediato la cuenta activa.
2. **Motor Unicode de Ancho Real a Nivel de Píxel ($O(N)$):**
   - Algoritmo que mide con precisión caracteres anchos, emojis (`🧠`, `🖥️`, `☁️`), símbolos monoespaciados y selectores de variación (`\uFE0F`).
   - Marcos matemáticamente indestructibles (`╭─`, `│`, `├─`, `╰─`). Cero desbordes horizontales o saltos de línea indeseados en Windows Terminal, ConHost, Alacritty o WezTerm.
3. **Alternate Screen Buffer (`\x1b[?1049h`):**
   - Corre en el búfer alternativo de terminal (igual que `vim` o `htop`). **Cero contaminación del historial de scrollback**.
4. **Motor SQLite Nativo (`node:sqlite`):**
   - Lee `opencode.db` y `engram.db` directamente en microsegundos sin requerir compiladores C++, GCC ni paquetes npm pesados como `better-sqlite3`.

---

## ⌨️ Atajos y Comandos Interactivos

| Comando / Atajo | Dónde se usa | Acción |
| :--- | :--- | :--- |
| **`r`** | En el sidebar | **Refresco Panorámico Instantáneo:** Consulta las 5 cuentas al mismo tiempo para actualizar sus métricas bajo demanda. |
| **`x`** | En el sidebar | **Migración Automática de Cuenta Crítica:** Detecta si tu cuenta activa está agotada (≥85%), busca la cuenta más saludable disponible y reasigna automáticamente las sesiones abiertas en OpenCode, grabando un checkpoint inmutable en Engram. |
| **`↑` / `↓`** o **`k` / `j`** | En el sidebar | **Navegación / Scroll:** Desplaza el viewport si la ventana del terminal es muy pequeña. |
| **`q`** | En el sidebar | Salir y restaurar la pantalla anterior de la terminal. |
| **`/snew`** | En el chat de OpenCode | **Handover de Sesión:** El agente corre `mem_session_summary` en Engram y genera un bloque de handover conciso para arrancar una sesión limpia. |
| **`snew`** | En terminal / Herdr | **Nueva Pestaña Limpia:** Abre una nueva pestaña en Herdr enfocada en el directorio actual, lanzando OpenCode a la izquierda (74%) y el sidebar a la derecha (26%). |
| **`sidebar`** | En terminal / Herdr | Abre o conecta el sidebar lateral con ratio perfecto (74/26). |

---

## 📦 Instalación y Configuración

### 1. Requisitos Previos
- **Node.js ≥ 22.0.0** (incluye soporte nativo para `node:sqlite`).
- **Herdr** (opcional pero recomendado como multiplexer).
- **OpenCode** (con base de datos en `~/.local/share/opencode/opencode.db`).
- **CLIProxyAPI** (ejecutándose en `http://127.0.0.1:8317`).
- **Engram** (opcional para persistencia de memoria).

### 2. Estructura de Archivos
Ubica esta carpeta en tu disco, por ejemplo:
`D:\DocumentosDiscoD\sidebarHerdrOpencode\`

Archivos incluidos:
- `status-sidebar.mjs`: Script principal de telemetría y HUD en terminal.
- `attach-sidebar.mjs`: Script para dividir panes en Herdr con ratio 0.74/0.26.
- `snew.mjs`: Generador de nueva pestaña y handover de sesión.
- `status-sidebar.cmd`, `add-sidebar.cmd`: Lanzadores para Windows.

### 3. Configurar Shims Globales (Scoop / PATH)
Para poder ejecutar `sidebar` y `snew` desde cualquier consola, agrega en tu directorio de shims (ej. `C:\Users\<TuUsuario>\scoop\shims\` o cualquier carpeta en tu PATH de Windows):

**`sidebar.cmd`**:
```cmd
@echo off
setlocal
if "%1"=="run" goto run_sidebar

where herdr >nul 2>&1
if errorlevel 1 goto run_sidebar

node "D:\DocumentosDiscoD\sidebarHerdrOpencode\attach-sidebar.mjs"
if not errorlevel 1 exit /b 0

:run_sidebar
chcp 65001 >nul
node "D:\DocumentosDiscoD\sidebarHerdrOpencode\status-sidebar.mjs"
```

**`snew.cmd`**:
```cmd
@echo off
chcp 65001 >nul
node "D:\DocumentosDiscoD\sidebarHerdrOpencode\snew.mjs" %*
```

### 4. Comando Nativo `/snew` en OpenCode
En tu archivo de configuración de OpenCode (`opencode.json`), añade la sección `"commands"`:

```json
{
  "commands": {
    "snew": {
      "description": "Cierra sesión en Engram con resumen de handover y prepara inicio limpio",
      "template": "Por favor genera el resumen de cierre de sesión en Engram usando mem_session_summary registrando los logros, decisiones y estado actual, y escribe un bloque de handover conciso para que pueda continuar inmediatamente en una nueva sesión limpia."
    }
  }
}
```

---

## 🛡️ Licencia

Distribuido bajo licencia **MIT**. Desarrollado con dedicación técnica y rigor arquitectónico por **Totopo27** para la comunidad de desarrolladores de OpenCode, Herdr y Gentle-AI.
