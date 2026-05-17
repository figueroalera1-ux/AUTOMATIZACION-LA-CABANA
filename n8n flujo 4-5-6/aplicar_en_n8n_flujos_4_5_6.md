# Aplicacion exacta en n8n para flujos 4, 5 y 6

## Estado real encontrado

El webhook publico del Flujo 5 esta vivo.

Prueba con token falso:

```text
https://n8n.lacabanaeventos.com/webhook/seleccion?token=LC-TEST-CODEX-0001
```

Resultado:

```text
Este link ya no esta disponible
```

Pero el token de prueba:

```text
TEST-ANGEL-001
```

sigue abriendo el formulario publico. Ese es el bug principal que hay que quitar dentro de n8n.

## Flujo 4: Generar Enlace de Seleccion de Menu

Nodos recomendados:

```text
Webhook / Formulario interno
        |
        v
Code - Generar token y link
        |
        v
IF - datos validos?
        |
        +--> false: Responder error
        |
        +--> true: Google Sheets - Agregar fila en Selecciones
                         |
                         v
                    Telegram - Enviar link
                         |
                         v
                    Responder exito
```

En el nodo `Code - Generar token y link`, pegar el contenido de:

```text
n8n_flujo4_generar_token.js
```

Google Sheets debe guardar en la pestana `Selecciones` con estas columnas:

```text
token
nombre
email
telefono
fecha_evento
tipo_evento
paquete_asignado
status
menu_elegido
num_invitados
cocteleria
cerveza_barril
dietas_especiales
notas_cliente
fecha_creacion
fecha_seleccion
link_seleccion
```

El campo mas importante es:

```text
status = pendiente
```

## Flujo 5: Servir Formulario de Seleccion

Nodos correctos:

```text
Webhook - Abrir formulario
        |
        v
Sheets - Leer selecciones
        |
        v
Code - Construir formulario HTML
        |
        v
Respond to Webhook - Responder con HTML
```

Webhook:

```text
Metodo: GET
Path: seleccion
Produccion: https://n8n.lacabanaeventos.com/webhook/seleccion
```

En el nodo `Code - Construir formulario HTML`, pegar el contenido de:

```text
n8n_flujo5_construir_formulario.js
```

Debe quedar eliminada cualquier regla especial para:

```text
TEST-ANGEL-001
```

La validacion correcta es:

```text
token existe en Sheets + status = pendiente
```

Todo lo demas se rechaza.

## Flujo 6: Guardar Seleccion de Menu

Nodos correctos:

```text
Webhook - Recibir seleccion
        |
        v
Sheets - Leer para validar
        |
        v
Code - Validar token y extraer datos
        |
        v
IF - Token valido?
        |
        +--> false: Respond to Webhook - Token invalido
        |
        +--> true: Google Sheets - Guardar seleccion
                         |
                         v
                    Email - Confirmacion al cliente
                         |
                         v
                    Telegram - Alerta seleccion
                         |
                         v
                    Respond to Webhook - Exito
```

Webhook:

```text
Metodo: POST
Path: seleccion-guardar
Produccion: https://n8n.lacabanaeventos.com/webhook/seleccion-guardar
```

En el nodo `Code - Validar token y extraer datos`, pegar el contenido de:

```text
n8n_flujo6_validar_guardar.js
```

El nodo `Google Sheets - Guardar seleccion` debe usar:

```text
Operacion: Append or Update Row
Columna para empatar: token
Valor para empatar: {{$json.token}}
```

Y debe escribir:

```text
status = completado
menu_elegido = {{$json.menu_elegido}}
num_invitados = {{$json.num_invitados}}
cocteleria = {{$json.cocteleria}}
cerveza_barril = {{$json.cerveza_barril}}
dietas_especiales = {{$json.dietas_especiales}}
notas_cliente = {{$json.notas_cliente}}
fecha_seleccion = {{$json.fecha_seleccion}}
```

## Prueba final obligatoria

1. Ejecutar Flujo 4 con un cliente de prueba.
2. Confirmar que Sheets crea una fila en `Selecciones`.
3. Confirmar que `status` queda como `pendiente`.
4. Abrir el link generado.
5. Confirmar que Flujo 5 muestra el formulario.
6. Enviar una seleccion.
7. Confirmar que Flujo 6 actualiza la misma fila.
8. Confirmar que `status` cambia a `completado`.
9. Abrir otra vez el mismo link.
10. Confirmar que ahora muestra `Este link ya no esta disponible`.

Si esos 10 pasos pasan, el candado del sistema ya quedo bien.

