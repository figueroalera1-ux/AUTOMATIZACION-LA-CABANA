# Sistema de Automatización de Leads y Marketing
## La Cabaña Eventos · Costo total: $0
**Fecha:** Mayo 2026 · **Stack:** n8n + HubSpot Free + Meta Business Suite + Facebook Pixel

---

## ARQUITECTURA GENERAL DEL SISTEMA

```
┌─────────────────────────────────────────────────────────────┐
│                    FUENTES DE LEADS                         │
│  Facebook Lead Ad · Sitio web · Instagram DM · WhatsApp    │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               n8n  (MOTOR DE AUTOMATIZACIÓN)                │
│   Recibe · Clasifica · Notifica · Registra · Responde       │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   ┌─────────────┐ ┌──────────┐ ┌────────────────┐
   │ HubSpot CRM │ │WhatsApp  │ │ Email automático│
   │  (pipeline) │ │(alerta   │ │ al lead        │
   │             │ │ al dueño)│ │                │
   └─────────────┘ └──────────┘ └────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   REMARKETING                               │
│      Facebook Pixel → Custom Audiences → Retargeting       │
└─────────────────────────────────────────────────────────────┘
```

---

## COMPONENTE 1 — CRM: HubSpot Free
### Por qué HubSpot y no local

| Criterio | HubSpot Free | EspoCRM local |
|---|---|---|
| Costo | $0 para siempre | $0 pero requiere servidor |
| Integración Facebook Lead Ads | ✅ Nativa, 1 clic | ⚠️ Requiere n8n o Zapier |
| App móvil | ✅ Excelente | ⚠️ Limitada |
| Pipeline visual | ✅ Drag & drop | ✅ Disponible |
| Email automático a leads | ✅ Incluido | ⚠️ Configuración compleja |
| Curva de aprendizaje | Baja | Media-Alta |
| Mantenimiento | Ninguno | Actualizaciones manuales |

**Recomendación:** HubSpot Free. Es el CRM más usado del mundo, funciona desde el navegador y el celular, y se conecta con Facebook Lead Ads de forma nativa sin tocar código.

Si en el futuro necesitas algo 100% en tu máquina sin internet: EspoCRM + XAMPP.

### Setup HubSpot (20 minutos)

1. Ir a **hubspot.com/es** → "Empieza gratis" → crear cuenta con tu email del negocio
2. En el menú: **Contactos → Importar → Conectar formulario web**
3. Agregar tu número de WhatsApp y correo del negocio
4. Crear pipeline de ventas: **CRM → Ventas → Negocios → Crear pipeline**

**Pipeline recomendado para La Cabaña:**
```
[Lead Nuevo] → [Cotización Enviada] → [Visita Agendada] → [Anticipo Recibido] → [Evento Confirmado] → [Evento Realizado]
```

5. Instalar **HubSpot App** en tu celular — cada lead nuevo te llega con notificación push

### Conectar Facebook Lead Ads a HubSpot (NATIVO, sin n8n)

1. En HubSpot: **Marketing → Anuncios → Conectar cuenta**
2. Seleccionar tu página de Facebook: **LaCabanaEventosMX**
3. Autorizar permisos
4. Cuando crees un Lead Ad en Facebook, en la sección "CRM" selecciona HubSpot
5. Listo — cada lead que llene el formulario de Facebook aparece automáticamente en HubSpot

---

## COMPONENTE 2 — n8n (Motor de automatización)
### Conecta todo lo que HubSpot no conecta nativamente

n8n es como un empleado invisible que trabaja 24/7: recibe un lead, lo guarda en el CRM, te manda WhatsApp y le responde al cliente al instante.

### Opción A — n8n Cloud (más fácil, gratis)
- Ir a **n8n.io** → "Start for free"
- 5,000 ejecuciones/mes gratis — suficiente para arrancar
- No requiere instalación ni servidor

### Opción B — n8n local en Windows (cero límites, para siempre gratis)
```powershell
# Requiere Node.js instalado (ya lo tienes de la agencia-marketing)
npx n8n
# Se abre en http://localhost:5678
```

### Flujo 1 — Lead del sitio web → CRM + WhatsApp

**Triggers:** Formulario de lacabanaeventos.com

```
[Webhook n8n]
     ↓
[Guardar en HubSpot] — crea contacto + negocio en pipeline "Lead Nuevo"
     ↓
[Enviar WhatsApp al dueño] — "🎉 Nuevo lead: [Nombre] · [Tipo evento] · [Fecha] · [Tel]"
     ↓
[Enviar email al lead] — plantilla de bienvenida (ver abajo)
```

**Plantilla de email automático al lead:**
```
Asunto: Recibimos tu solicitud — La Cabaña Eventos 🎉

Hola [Nombre],

Gracias por contactar a La Cabaña Eventos.

Recibimos tu solicitud para [tipo de evento] el [fecha].
Un asesor te contactará en las próximas horas en el número
que nos proporcionaste.

Mientras tanto, puedes ver todos nuestros paquetes en:
→ lacabanaeventos.com

¡Nos vemos pronto!
La Cabaña Eventos · 771 134 1559
San Pedro Huaquilpan, Hidalgo
```

### Flujo 2 — Lead de Instagram DM → CRM

```
[Instagram DM recibido en Meta Business Suite]
     ↓
[Webhook → n8n] (requiere Meta API — ver configuración avanzada)
     ↓
[HubSpot: crear contacto]
     ↓
[WhatsApp al dueño: "📩 DM en Instagram de [usuario]"]
```

### Flujo 3 — Lead frío → Remarketing automático (nurturing)

Para leads que llegaron pero no confirmaron:

```
[Día 0]  Lead entra → Email bienvenida + WhatsApp del dueño
[Día 2]  n8n revisa HubSpot: si sigue en "Lead Nuevo" → Email recordatorio
[Día 5]  Si sigue sin respuesta → Email con oferta o testimonio
[Día 10] Si sigue sin respuesta → Mover a "Lead Frío" en pipeline
[Día 30] Email de reactivación: "¿Aún buscas salón para tu evento?"
```

**Email Día 2 — Recordatorio:**
```
Asunto: ¿Pudiste ver nuestros paquetes? 📅

Hola [Nombre],

Hace 2 días nos escribiste sobre tu [tipo de evento].
¿Tuviste oportunidad de revisar nuestros paquetes?

El más solicitado es el Herradura:
✅ Menú 3 tiempos · Open bar · DJ · Invitación digital
📌 Desde $400 por persona

¿Tienes preguntas? Escríbenos directo:
→ wa.me/527711341559

La Cabaña Eventos · lacabanaeventos.com
```

**Email Día 5 — Urgencia:**
```
Asunto: Los sábados de julio se están llenando 📅

Hola [Nombre],

Queríamos avisarte que estamos recibiendo varias consultas
para los próximos meses.

Si tu evento es en 2026, te recomendamos apartar tu fecha
con anticipación. Solo necesitas un anticipo para asegurarla.

Agenda una visita sin compromiso:
→ lacabanaeventos.com
→ 771 134 1559

La Cabaña Eventos
```

---

## COMPONENTE 3 — Meta Business Suite
### Programación gratuita de Facebook + Instagram

Meta Business Suite es la herramienta oficial de Meta, completamente gratuita, sin límite de posts programados.

### Cómo usarlo:

1. Ir a **business.facebook.com** desde tu computadora
2. Seleccionar tu página **LaCabanaEventosMX**
3. En el menú izquierdo: **Contenido** → **Crear publicación**
4. Escribir el texto, subir la foto/video
5. Clic en la flecha junto a "Publicar" → **"Programar"**
6. Elegir fecha y hora → **Confirmar**

Se publica automáticamente en **Facebook e Instagram al mismo tiempo**.

### Flujo de trabajo semanal contigo como proveedor de material:

```
TÚ provides cada lunes:
 → 3–5 fotos/videos de la semana
 → Texto o idea para cada uno

YO (o tu community manager con este plan) programa:
 → Lunes: post de paquete destacado
 → Miércoles: reel del evento más reciente
 → Viernes: story de disponibilidad
 → Sábado: cobertura si hay evento
```

### Bandeja unificada de mensajes:

En Meta Business Suite → **Bandeja de entrada** → Ves TODOS los mensajes de Facebook e Instagram en un solo lugar. Puedes responder desde ahí o desde el celular con la app.

**Respuestas automáticas en Meta Business Suite (sin n8n):**
- Facebook: Configuración de página → Mensajería → Respuesta instantánea
- Activar: "Enviar respuesta instantánea a quien envíe un mensaje"

```
Texto de respuesta automática:
¡Hola! 👋 Gracias por contactar a La Cabaña Eventos.

Para darte tu cotización necesitamos 3 datos:
📅 ¿Cuál es la fecha del evento?
👥 ¿Cuántas personas aproximadamente?
🎉 ¿Qué tipo de evento es?

Te respondemos en horario Lun–Sáb 9am–7pm ✅
lacabanaeventos.com
```

---

## COMPONENTE 4 — TikTok Creator Studio
### Programación gratuita de TikTok

1. Ir a **studio.tiktok.com**
2. Iniciar sesión con tu cuenta **@lacabanaeventosmx**
3. **Subir** → seleccionar video → agregar texto, hashtags
4. Clic en **"Programar"** → elegir fecha y hora
5. El video se publica solo a la hora elegida

**Horarios óptimos para TikTok en México:**
- Lunes a viernes: **7:00 PM – 9:00 PM**
- Sábados: **11:00 AM – 1:00 PM**
- Domingos: **3:00 PM – 6:00 PM**

---

## COMPONENTE 5 — Facebook Pixel (Remarketing gratuito)

El Pixel es un código que se instala en tu sitio web. Registra quién lo visita y te permite mostrarles anuncios de Facebook después. Es gratis — solo pagas cuando decides hacer el anuncio.

### Instalar el Pixel en lacabanaeventos.com:

1. Ir a **business.facebook.com** → **Administrador de eventos** → **Conectar fuentes de datos** → **Web**
2. Nombrar el pixel: "La Cabaña Pixel"
3. Copiar el código que genera Facebook
4. Pegarlo en el `<head>` del sitio web (pedirle al desarrollador del sitio o hacerlo en el CMS)
5. Verificar en **Meta Pixel Helper** (extensión de Chrome gratuita)

### Qué hace el Pixel por ti automáticamente:

```
Usuario visita lacabanaeventos.com
         ↓
Pixel registra: "Esta persona vio la página de paquetes"
         ↓
Facebook guarda a ese usuario en tu "Audiencia personalizada"
         ↓
Cuando actives un anuncio → ese usuario ve tu anuncio en Facebook/Instagram
(aunque nunca te haya escrito)
```

### Audiencias automáticas que crea el Pixel:

| Audiencia | Quiénes son | Cuándo usarla |
|---|---|---|
| **Visitantes del sitio** | Todos los que entraron al sitio | Remarketing general |
| **Vieron paquetes** | Los que vieron /paquetes o /cotizar | Anuncio de precio directo |
| **Rebotaron rápido** | Entraron y salieron en <10 seg | Anuncio de contenido educativo |
| **Lookalike 1%** | Personas similares a tus visitantes | Expansión de alcance |

---

## COMPONENTE 6 — CAMPAÑA DE FACEBOOK SIN "ANTES Y DESPUÉS"
### La estrategia más efectiva sin historial de eventos

Dado que no tienes eventos pasados fotografiados aún, la campaña se basa en **Facebook Lead Ads** — el formato más eficiente para captar contactos sin necesitar contenido elaborado.

### Por qué Lead Ads es ideal para tu situación:

- El usuario **no sale de Facebook** — llena un formulario dentro de la app
- Facebook **pre-llena** nombre, teléfono y email del usuario automáticamente
- No necesitas landing page, ni video elaborado, ni antes/después
- Costo por lead en México para salones: **$15–$60 MXN por lead** (estimado)
- Con $300–$500 MXN/semana puedes generar **8–20 leads semanales**

### Estructura de la campaña mínima:

```
CAMPAÑA: "La Cabaña — Cotizaciones"
│
├── CONJUNTO DE ANUNCIOS A: "XV Años y Bodas — Pachuca/Hidalgo"
│   Segmentación:
│   · Radio: 20 km desde Zapotlán de Juárez
│   · Edad: 25–50 años
│   · Intereses: Bodas, XV años, quinceañera, fiestas, eventos
│   · Presupuesto: $200 MXN/día o $1,400/semana
│
└── CONJUNTO DE ANUNCIOS B: "Graduaciones y eventos — Jóvenes"
    Segmentación:
    · Radio: 25 km desde Zapotlán de Juárez
    · Edad: 18–35 años
    · Intereses: Graduación, fiesta de graduados, universidad
    · Presupuesto: $100 MXN/día o $700/semana
```

### Creativo del anuncio SIN antes/después (3 opciones):

**Opción 1 — Solo imagen del salón + texto fuerte:**
```
IMAGEN: La foto más impactante del salón (pista LED, gran angular)

TEXTO PRINCIPAL:
¿Buscas el salón perfecto para tu evento en Hidalgo?

✅ Hasta 250 personas
✅ Pista LED efecto galaxia
✅ DJ + menú + open bar desde $400/persona
✅ A 15 min de Pachuca

📅 Fechas disponibles para 2026

[COMPLETAR FORMULARIO]

TITULAR: "La Cabaña Eventos · Desde $13,900"
DESCRIPCIÓN: "Cotiza gratis · Respuesta en menos de 24 hrs"
```

**Opción 2 — Video de 15 seg de la pista LED:**
```
VIDEO: Pista LED encendida, 15 segundos
TEXTO: (mismo que opción 1)
→ Este formato tiene 2–3x más alcance que imagen estática
→ No necesitas edición profesional — grabado con celular funciona
```

**Opción 3 — Carrusel de paquetes:**
```
Diapositiva 1: Foto del salón · "Salón de eventos en Hidalgo"
Diapositiva 2: "Solo Salón desde $13,900"
Diapositiva 3: "Paquete Herradura $400/persona — DJ + menú + open bar"
Diapositiva 4: "Paquete Mayoral $500/persona — El más popular"
Diapositiva 5: "La Cabaña Premium $700/persona — Todo incluido"
Diapositiva 6: CTA · "Cotiza gratis hoy"
```

### Formulario del Lead Ad (configurar en Facebook):

```
Preguntas a incluir:
1. Nombre completo (automático — Facebook lo llena solo)
2. Teléfono (automático)
3. Email (automático)
4. ¿Cuál es tu evento? (opción múltiple)
   [ ] Boda
   [ ] XV Años
   [ ] Graduación
   [ ] Fiesta infantil
   [ ] Corporativo
   [ ] Otro
5. ¿Cuántas personas aproximadamente? (opción múltiple)
   [ ] Menos de 100
   [ ] 100–150
   [ ] 150–200
   [ ] Más de 200
6. ¿Cuándo es el evento? (fecha)

Pantalla de confirmación:
"¡Gracias! Te contactamos en menos de 24 horas.
Mientras tanto visita: lacabanaeventos.com"
```

### Flujo automático del Lead Ad (con HubSpot + n8n):

```
Usuario llena formulario de Facebook Lead Ad
         ↓
HubSpot crea contacto automáticamente (integración nativa)
         ↓
n8n detecta contacto nuevo en HubSpot
         ↓
WhatsApp al dueño: "🎉 LEAD FACEBOOK: [Nombre] · [Tel] · [Evento] · [Fecha]"
         ↓
Email automático al lead: plantilla de bienvenida
         ↓
Lead entra al pipeline: "Lead Nuevo"
         ↓
Si no hay respuesta en 2 días → email recordatorio automático (Flujo 3)
```

---

## REMARKETING — Sin pagar hasta tener el Pixel listo

**Fase 1 (ahora, gratis):** Instalar Pixel y dejar que acumule datos de visitantes. Mínimo necesitas 100 visitantes únicos antes de poder hacer remarketing. Con el tráfico orgánico de redes se llega en 2–4 semanas.

**Fase 2 (cuando tengas 100+ visitas):** Crear audiencia de remarketing en Facebook:
- Ve a Administrador de anuncios → Audiencias → Crear audiencia personalizada → Tráfico del sitio web → Últimos 30 días
- Usa esta audiencia para mostrar el anuncio de Lead Ads a personas que ya visitaron tu sitio pero no convirtieron

**Fase 3 (audiencia Lookalike):** Cuando tengas 20+ leads en HubSpot:
- Exportar lista de contactos de HubSpot como CSV
- Subir a Facebook → Audiencias → Audiencia personalizada → Lista de clientes
- Crear Lookalike 1% → Facebook busca personas similares a tus leads en Hidalgo
- Esta audiencia convierte 3–5x mejor que intereses genéricos

---

## RESUMEN DEL STACK COMPLETO

| Herramienta | Función | Costo | Dónde acceder |
|---|---|---|---|
| **HubSpot Free** | CRM + pipeline + emails automáticos | $0 | hubspot.com/es |
| **n8n** | Motor de automatización (flujos entre apps) | $0 | n8n.io o localhost:5678 |
| **Meta Business Suite** | Programar posts FB + IG + bandeja unificada | $0 | business.facebook.com |
| **TikTok Creator Studio** | Programar TikToks | $0 | studio.tiktok.com |
| **Facebook Pixel** | Remarketing / audiencias personalizadas | $0 | Administrador de eventos |
| **Facebook Lead Ads** | Captura de leads dentro de Facebook | $0 setup / pago por anuncio | Administrador de anuncios |
| **MailerLite Free** | Email marketing masivo (12k emails/mes) | $0 | mailerlite.com |

**Costo mensual total del sistema:** $0
**Costo de la campaña mínima de Facebook:** $300–$1,400 MXN/semana (opcional, cuando quieras acelerar)

---

## ORDEN DE INSTALACIÓN (hazlo en este orden)

### Hoy — 1.5 horas total:
- [ ] **1.** Crear cuenta HubSpot Free en hubspot.com/es (20 min)
- [ ] **2.** Crear pipeline "La Cabaña" con las 6 etapas (10 min)
- [ ] **3.** Conectar página de Facebook a HubSpot (5 min)
- [ ] **4.** Activar respuesta automática en Meta Business Suite (5 min)
- [ ] **5.** Configurar mensaje de bienvenida y ausencia en WhatsApp Business (10 min)
- [ ] **6.** Instalar Facebook Pixel en el sitio web (10 min — necesitas acceso al CMS)
- [ ] **7.** Crear cuenta n8n.io gratuita (5 min)

### Esta semana:
- [ ] **8.** Configurar Flujo 1 en n8n: formulario web → HubSpot + WhatsApp
- [ ] **9.** Crear el primer Lead Ad en Facebook con foto del salón
- [ ] **10.** Programar los primeros 2 posts en Meta Business Suite

### Cuando tengas el primer material (fotos/videos de esta semana):
- [ ] **11.** Subir los 9 posts de apertura a Instagram (programados en Meta Business Suite)
- [ ] **12.** Subir primer TikTok de la pista LED

---

## TU ROL VS EL SISTEMA

```
TÚ provees:                          EL SISTEMA hace:
─────────────────                    ──────────────────────────────
Material visual                  →   Meta Business Suite lo publica
(fotos, videos, 1x/semana)           según el calendario

El cliente escribe                →  HubSpot lo registra
                                     n8n te notifica en WhatsApp
                                     Email automático al cliente

El cliente visita el sitio        →  Pixel lo captura
                                     Audiencia de remarketing crece

Confirmas un evento               →  Mueves el lead en el pipeline
                                     (drag & drop en HubSpot)
```

---

*Sistema diseñado con herramientas open source y planes gratuitos de nivel empresarial. Mayo 2026.*
