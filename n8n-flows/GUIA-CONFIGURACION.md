# Guía de Configuración n8n — La Cabaña Eventos
## Paso a paso después de la instalación

---

## PASO 1 — Iniciar n8n

Abre PowerShell en la carpeta `n8n-flows` y ejecuta:
```powershell
.\iniciar-n8n.ps1
```
Luego abre tu navegador en: **http://localhost:5678**
- Usuario: `admin`
- Contraseña: `lacabana2026`

---

## PASO 2 — Configurar credenciales en n8n

Ve a **Configuración (⚙️) → Credenciales → Añadir credencial**

### 2a. Credencial para HubSpot
1. Buscar "HTTP Request Auth" → Tipo: **Header Auth**
2. Nombre: `HubSpot API`
3. Header name: `Authorization`
4. Header value: `Bearer TU_HUBSPOT_API_KEY`
5. Guardar

**Cómo obtener la API Key de HubSpot:**
- hubspot.com → Configuración → Integraciones → Claves de acceso privadas
- Clic en "Crear clave de acceso privada"
- Permisos mínimos: `crm.objects.contacts.write` + `crm.objects.contacts.read`
- Copiar el token generado

### 2b. Credencial SMTP (para enviar emails)

**Opción Gmail:**
1. Ve a myaccount.google.com → Seguridad → Verificación en 2 pasos (activar)
2. Luego: Seguridad → Contraseñas de aplicaciones
3. Selecciona "Correo" + "Windows" → Genera contraseña de 16 dígitos
4. En n8n: Credenciales → SMTP
   - Host: `smtp.gmail.com`
   - Port: `587`
   - User: `tu@gmail.com`
   - Password: contraseña de 16 dígitos
   - SSL: No / TLS: Sí

### 2c. Bot de Telegram (notificaciones en tu celular)

1. Abre Telegram en tu celular
2. Busca **@BotFather** → escribe `/newbot`
3. Ponle nombre: `La Cabaña Bot`
4. Copia el token que te da (parece: `123456789:ABCdefGHI...`)
5. Ahora busca **@userinfobot** en Telegram → te escribe tu Chat ID (número)
6. Anota ambos en el archivo `.env`

---

## PASO 3 — Importar los flujos

1. En n8n, clic en **"+"** (nuevo workflow) → **"Importar desde archivo"**
2. Importar en este orden:
   - `flujo1-web-lead.json` → activar con el toggle ▶️
   - `flujo2-remarketing-followup.json` → activar
   - `flujo3-facebook-lead-ad.json` → activar

---

## PASO 4 — Obtener las URLs de tus Webhooks

Después de activar los flujos, n8n genera URLs únicas. Las encuentras así:

1. Abre `flujo1-web-lead`
2. Clic en el nodo **"Webhook — Lead entra"**
3. Copia la **"Production URL"** — se ve así:
   ```
   http://localhost:5678/webhook/lacabana-lead
   ```

**Estas URLs son las que conectas con:**
- El formulario de tu sitio web (lacabanaeventos.com)
- El webhook de Facebook Lead Ads

---

## PASO 5 — Conectar el sitio web al Flujo 1

Pide al desarrollador del sitio que envíe los datos del formulario de contacto a esta URL via POST:

```
POST http://TU-IP:5678/webhook/lacabana-lead
Content-Type: application/json

{
  "nombre": "Nombre del cliente",
  "telefono": "7711234567",
  "email": "cliente@email.com",
  "tipo_evento": "Boda",
  "fecha": "2026-12-15",
  "personas": "150",
  "mensaje": "Mensaje opcional"
}
```

Si el sitio está en WordPress, usa el plugin **WPForms** o **Contact Form 7** con el add-on de Webhooks.

---

## PASO 6 — Conectar Facebook Lead Ads al Flujo 3

1. Ve a **Facebook Business Manager → Formularios de clientes potenciales**
2. Selecciona tu formulario → **"Integraciones"** → **"CRM"**
3. Selecciona **"Webhook"**
4. Pega la URL del Flujo 3:
   ```
   http://TU-IP:5678/webhook/lacabana-facebook-lead
   ```
5. O usa **HubSpot** directo (más fácil):
   - En HubSpot: Marketing → Anuncios → Conectar cuenta de Facebook
   - Los leads de Facebook van directo a HubSpot sin necesitar n8n

---

## PASO 7 — Hacer n8n accesible desde internet (para recibir leads externos)

n8n en `localhost` solo funciona desde tu computadora. Para recibir leads de Facebook o del sitio web, necesitas que sea accesible desde internet.

### Opción gratuita — ngrok (para pruebas):
```powershell
# Instalar ngrok
npm install -g ngrok

# Con n8n corriendo en otra ventana, ejecutar:
ngrok http 5678

# Ngrok te da una URL pública tipo:
# https://abc123.ngrok.io
# Usa esa URL en lugar de localhost:5678
```

### Opción permanente gratuita — Render.com o Railway.app:
- Ambos tienen tier gratuito
- Despliegan n8n en la nube con URL permanente
- n8n tiene guías oficiales para ambos en docs.n8n.io

---

## RESUMEN DEL FLUJO COMPLETO

```
Cliente llena formulario en lacabanaeventos.com
              ↓
    n8n Webhook recibe los datos
              ↓
    ┌─────────┬──────────┬──────────────┐
    ↓         ↓          ↓              
HubSpot  Telegram    Email al lead
(guarda  (te avisa   (bienvenida
 lead)   al celular)  automática)
    
    --- 2 días después (sin respuesta) ---
    
    n8n revisa HubSpot → Email recordatorio
    
    --- 5 días después (sin respuesta) ---
    
    n8n → Email de urgencia "sábados se llenan"
    
    --- 10 días después ---
    
    n8n → Marca lead como frío en HubSpot
```

---

## PROBLEMA COMÚN — n8n se apaga cuando cierras la PC

Para que n8n corra siempre en segundo plano como un servicio de Windows:

```powershell
# Instalar pm2 (process manager)
npm install -g pm2
npm install -g pm2-windows-startup

# Configurar n8n como servicio
pm2 start n8n --name "lacabana-n8n"
pm2 save
pm2-startup install

# A partir de ahora n8n inicia solo cuando prende la PC
```

Verificar que está corriendo:
```powershell
pm2 status
```

---
*Generado para La Cabaña Eventos · Mayo 2026*
