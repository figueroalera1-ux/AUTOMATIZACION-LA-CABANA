# Credenciales necesarias

Rellena este archivo con tus API keys antes de usar las herramientas en modo live.
**NUNCA subas este archivo a git** — añádelo a `.gitignore`.

---

## auditar/ — Claude Ads (opcionales — solo para modo live)

### Google Ads MCP (cohnen/mcp-google-ads)
- `GOOGLE_ADS_DEVELOPER_TOKEN` — dónde conseguirlo: https://developers.google.com/google-ads/api/docs/first-call/dev-token
- `GOOGLE_CLOUD_PROJECT_ID` — crear proyecto en https://console.cloud.google.com
- `GOOGLE_ADS_OAUTH_REFRESH_TOKEN` — seguir guía OAuth en la consola de Google Cloud
- `GOOGLE_ADS_LOGIN_CUSTOMER_ID` — ID de la cuenta MCC en Google Ads (10 dígitos sin guiones)

### Meta Ads MCP (brijr/meta-mcp)
- `META_ACCESS_TOKEN` — dónde conseguirlo: https://developers.facebook.com → crear app → Marketing API → generar token de larga duración
- `META_BUSINESS_MANAGER_ID` — ID numérico en business.facebook.com → Configuración del negocio

### LinkedIn Ads (Synter o Adzviser — SaaS)
- `LINKEDIN_MCP_API_KEY` — registrarse en https://syntermedia.ai o https://adzviser.com y generar API key desde el dashboard

### TikTok Ads MCP (AdsMCP/tiktok-ads-mcp-server)
- `TIKTOK_APP_ID` — crear app en https://business.tiktok.com/portal/apps
- `TIKTOK_APP_SECRET` — generado junto con el App ID en el portal de TikTok Business
- `TIKTOK_ADVERTISER_OAUTH_TOKEN` — flujo OAuth desde el portal de desarrolladores de TikTok

### Microsoft Ads (CData o Synter)
- `MICROSOFT_ADS_OAUTH_TOKEN` — seguir guía en https://learn.microsoft.com/en-us/advertising/guides/authentication-oauth-quick-start

---

## diagnosticar/ — Toprank

### notfair.co (Google Ads + Meta Ads — OAuth, sin API key manual)
- Cuenta en https://notfair.co — registrarse gratis
- La primera vez que corras `/toprank:google-ads-audit` o `/toprank:meta-ads-audit`,
  Claude Code abre el navegador y pide login en notfair.co. El token se guarda en el
  keychain del sistema operativo. No hay variable de entorno que copiar.

### Google Search Console (para SEO)
- `GOOGLE_CLOUD_PROJECT_ID` — mismo proyecto de Google Cloud que en auditar/ (reutilizable)
- `GOOGLE_SEARCH_CONSOLE_OAUTH_CREDENTIALS` — activar Search Console API en la consola de Google Cloud y completar el flujo OAuth con `gcloud auth application-default login`
- Guía oficial: https://developers.google.com/webmaster-tools/v1/how-tos/authorizing

---

## crear/ — Open Generative AI

- `MUAPI_API_KEY` — registrarse en https://muapi.ai → Dashboard → API Keys → Create key
  - Plan gratuito disponible con créditos limitados
  - La app pide la key en el primer uso desde la interfaz web (se guarda en localStorage)
  - Para uso programático: pasar como header `x-api-key` en las peticiones a `https://api.muapi.ai`
