# Setup Google Sheets CRM — La Cabaña
## Tiempo total: 20 minutos

---

## PASO 1 — Crear el Google Sheet (3 min)

1. Ir a sheets.google.com → Crear nueva hoja
2. Nombrarla: **La Cabaña — Leads**
3. En la primera hoja, renombrar la pestaña a: **Leads**
4. Poner estos encabezados exactos en la fila 1 (A1 a K1):

```
id | nombre | telefono | email | evento | fecha_evento | personas | fuente | status | fecha_captura | ultimo_email
```

5. Copiar el ID del Sheet desde la URL:
   - URL: `https://docs.google.com/spreadsheets/d/` **1abc...xyz** `/edit`
   - Ese string largo es tu ID

---

## PASO 2 — Conectar Google Sheets en n8n (5 min)

1. En n8n ir a **Settings → Credentials → New**
2. Buscar: **Google Sheets OAuth2**
3. Nombre: `Google Sheets account`
4. Hacer clic en **Connect** → se abre ventana de Google
5. Iniciar sesión con la cuenta de Google del negocio
6. Autorizar permisos → listo

---

## PASO 3 — Importar los 3 flujos (5 min)

En n8n, para cada archivo:
1. **New Workflow** → menú (⋮) → **Import from file**
2. Seleccionar el archivo `.json`
3. En cada nodo de Google Sheets, reemplazar `TU_GOOGLE_SHEET_ID` con el ID del paso 1
4. Verificar que el credential `Google Sheets account` esté seleccionado
5. Activar el flujo (toggle arriba a la derecha)

Archivos a importar:
- `flujo1-web-lead.json` — leads del sitio web
- `flujo3-facebook-lead-ad.json` — leads de Facebook
- `flujo2-remarketing-followup.json` — follow-up automático

---

## PASO 4 — Probar (2 min)

En n8n, abrir **Flujo 1** → botón **Test Webhook** → copiar la URL → hacer POST con:

```json
{
  "nombre": "Prueba Funcionamiento",
  "telefono": "7711234567",
  "email": "tumail@gmail.com",
  "tipo_evento": "Boda",
  "fecha": "2026-10-15",
  "personas": "150"
}
```

Si funciona: aparece fila nueva en el Sheet + mensaje en Telegram.

---

## Pipeline de status (actualizar manualmente en el Sheet)

| Status | Significado |
|---|---|
| `nuevo` | Lead recién llegado |
| `contactado` | Ya le llamaste o escribiste |
| `cotizacion` | Le enviaste precio |
| `anticipo` | Pagó anticipo |
| `confirmado` | Evento confirmado |
| `realizado` | Evento ya pasó |
| `frio` | Sin respuesta 10+ días |

El **Flujo 2** actualiza status automáticamente para `contactado` y `frio`.
Los demás los mueves tú a mano en el Sheet.
