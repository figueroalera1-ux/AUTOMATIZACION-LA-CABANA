# Configurar landing interna con imagenes

Archivo listo:

```text
landing_formulario_generar_token.html
```

## Que hace

La pagina sirve para operacion interna:

```text
1. Buscar cliente por ID interno.
2. Capturar o corregir datos del cliente.
3. Agregar observaciones.
4. Agregar un servicio adicional.
5. Subir imagenes JPG/PNG de notas o transferencias.
6. Mandar todo al Flujo 4.
7. Flujo 4 genera token y link de seleccion.
```

## Espacio del logo

En el HTML busca:

```html
COLOCA AQUI EL LOGO
```

Y cambialo por:

```html
<img src="logo-la-cabana.png" alt="La Cabana Eventos">
```

El archivo `logo-la-cabana.png` debe estar en la misma carpeta o en la ruta donde subas la pagina.

## Webhooks que necesita n8n

Dentro del HTML hay dos URLs:

```javascript
const WEBHOOK_FLUJO_4 = 'https://n8n.lacabanaeventos.com/webhook/generar-link-seleccion';
const WEBHOOK_BUSCAR_CLIENTE = 'https://n8n.lacabanaeventos.com/webhook/buscar-cliente-id';
```

Si tus workflows tienen otro path, solo cambia esas dos lineas.

## Flujo 4 recomendado

El Flujo 4 debe quedar asi:

```text
Webhook POST /generar-link-seleccion
        |
        v
Guardar imagenes en Google Drive
        |
        v
Generar token y link
        |
        v
Google Sheets - Guardar/actualizar Selecciones
        |
        v
Telegram - Mandar link y resumen
        |
        v
Responder a landing
```

El webhook debe aceptar:

```text
multipart/form-data
```

porque la pagina manda imagenes.

## Flujo para buscar ID

El boton `Buscar ID` usa:

```text
GET /buscar-cliente-id?cliente_id=ID
```

Ese flujo debe:

```text
1. Leer cliente_id.
2. Buscarlo en Google Sheets o CRM.
3. Responder JSON.
```

Ejemplo de respuesta si existe:

```json
{
  "found": true,
  "cliente_id": "LC-2026-0015",
  "nombre": "Angel Figueroa",
  "telefono": "7711341559",
  "email": "cliente@gmail.com",
  "fecha_evento": "2026-07-15",
  "tipo_evento": "Boda",
  "paquete_asignado": "Herradura",
  "num_invitados_estimado": "120",
  "servicio_adicional": "Cocteleria",
  "observaciones": "Cliente pidio confirmar anticipo"
}
```

Ejemplo si no existe:

```json
{
  "found": false
}
```

## Campos que manda la landing

```text
cliente_id
nombre
telefono
email
fecha_evento
tipo_evento
paquete_asignado
num_invitados_estimado
servicio_adicional
observaciones
evidencias
origen
```

`evidencias` puede traer varias imagenes.

## Recomendacion importante

Esta pagina debe subirse como herramienta interna, no publica para clientes. Si la subes a tu web, ponla protegida con contrasena, ruta privada o acceso solo para tu equipo.
