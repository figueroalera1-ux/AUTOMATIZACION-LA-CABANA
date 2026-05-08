# Agencia de Marketing — Herramientas Open-Source

Tres herramientas complementarias para auditar, diagnosticar y crear contenido publicitario.

---

## auditar/ — Claude Ads

**Qué hace:** Skill de Claude Code que convierte a Claude en un equipo de analistas de paid ads.
Realiza auditorías completas de cuentas publicitarias (Google, Meta, YouTube, LinkedIn, TikTok,
Microsoft, Apple), genera un Ads Health Score de 0–100, listas de prioridades y reportes PDF.
Funciona en modo manual (pega tus exports/capturas) o en modo live conectando servidores MCP.

**Tipo:** Claude Code skill (sin servidor propio — corre dentro de Claude Code)

**Requisitos:** Claude Code CLI · Python 3.10+ · venv incluido en `auditar/venv/`

**Instalar el skill en Claude Code:**
```powershell
# Opción A — Plugin marketplace (recomendado)
/plugin marketplace add Hainrixz/claude-ads
/plugin install claude-ads@tododeia-claude-ads

# Opción B — PowerShell (desde cualquier terminal)
irm https://raw.githubusercontent.com/Hainrixz/claude-ads/main/install.ps1 | iex
```

**Usar:**
```
# Dentro de Claude Code
/ads audit          → auditoría completa multi-plataforma
/ads google         → Google Ads (80 checks)
/ads meta           → Meta/Facebook Ads (50 checks)
/ads plan saas      → plan estratégico para SaaS
/ads report         → genera PDF para el cliente
/ads math           → calculadora CPA, ROAS, break-even
```

---

## diagnosticar/ — Toprank

**Qué hace:** Plugin de Claude Code de SEO + Google Ads + Meta Ads. Analiza tráfico real desde
Google Search Console, audita cuentas de Google Ads y Meta Ads (con conexión OAuth a notfair.co),
detecta palabras clave que desperdician presupuesto, crea contenido SEO, optimiza meta tags,
genera datos estructurados JSON-LD y puede hacer cambios directamente en la cuenta.

**Tipo:** Claude Code plugin (sin servidor propio — corre dentro de Claude Code)

**Requisitos:** Claude Code CLI · Python 3.8+ · venv incluido en `diagnosticar/venv/`
· Google Cloud SDK (para Search Console) · Cuenta en notfair.co (para Google/Meta Ads live)

**Instalar el plugin en Claude Code:**
```
/plugin marketplace add nowork-studio/toprank
/plugin install toprank@nowork-studio
```

**Usar:**
```
# Dentro de Claude Code
/toprank:google-ads-audit    → auditoría completa de Google Ads
/toprank:google-ads          → gestión de campañas (pausar, pujas, negativos)
/toprank:meta-ads-audit      → auditoría de Meta Ads
/toprank:seo-analysis        → análisis SEO completo con datos de Search Console
/toprank:keyword-research    → investigación de palabras clave
/toprank:content-writer      → crear contenido SEO (E-E-A-T)
/toprank:meta-tags-optimizer → optimizar title tags y meta descriptions
/toprank:geo-optimizer       → optimizar para motores de búsqueda con IA
```

---

## crear/ — Open Generative AI

**Qué hace:** Estudio de generación de IA para imágenes, vídeos, lip sync y cine.
Soporta 200+ modelos (Flux, Midjourney, Kling, Sora, Veo, Wan, etc.). Funciona como
app web (Next.js) o app de escritorio (Electron). Alternativa open-source a Higgsfield,
Freepik, Krea y Openart AI, sin filtros de contenido.

**Tipo:** Aplicación web Next.js / app Electron

**Requisitos:** Node.js v18+ · API key de Muapi.ai

**Instalar y correr:**
```powershell
# Las dependencias ya están instaladas en crear/node_modules
cd agencia-marketing\crear

# App web (http://localhost:3000)
npm run dev

# App de escritorio (Electron)
npm run electron:dev
```

**Construir instalador de escritorio para Windows:**
```powershell
npm run electron:build:win
# El instalador aparece en crear\release\
```

---

## Estructura de carpetas

```
agencia-marketing/
├── auditar/         → Claude Ads (skill de Claude Code, Python 3.10+)
│   └── venv/        → entorno virtual Python aislado
├── diagnosticar/    → Toprank (plugin de Claude Code, Python 3.8+)
│   └── venv/        → entorno virtual Python aislado
├── crear/           → Open Generative AI (Next.js + Electron, Node.js v18+)
│   └── node_modules/→ dependencias Node aisladas
├── README.md        → este archivo
└── CREDENCIALES.md  → API keys necesarias (vacío — rellenar antes de usar)
```
