# Explicacion sencilla del sistema de tokens

Piensa que cada cliente recibe una pulserita unica para entrar a escoger su menu.

Esa pulserita se llama `token`.

Ejemplo:

```text
LC-1770000000000-ABC123
```

El link completo queda asi:

```text
https://n8n.lacabanaeventos.com/webhook/seleccion?token=LC-1770000000000-ABC123
```

## La idea con dibujitos

```text
TU llenas datos del evento
        |
        v
 [ n8n crea una pulserita ]
        |
        v
 [ Google Sheets la guarda como PENDIENTE ]
        |
        v
 [ Telegram te manda el link ]
        |
        v
 TU se lo mandas al cliente por WhatsApp
        |
        v
 CLIENTE abre el link y escoge menu
        |
        v
 [ n8n guarda la respuesta ]
        |
        v
 [ Google Sheets cambia PENDIENTE a COMPLETADO ]
```

## El candado del sistema

El sistema funciona como una puerta con guardia.

```text
Cliente llega con link
        |
        v
Guardia pregunta:
"A ver, ensename tu token"
        |
        v
Busca en Google Sheets
        |
        +--> Si NO existe: no pasa
        |
        +--> Si existe pero dice COMPLETADO: no pasa
        |
        +--> Si existe y dice PENDIENTE: si pasa
```

La regla de oro:

```text
TOKEN EXISTE + ESTADO PENDIENTE = FORMULARIO ABIERTO
```

Todo lo demas se rechaza.

## Flujo 4: La maquinita que fabrica links

Este flujo es como la persona de taquilla.

Tu le das:

- Nombre del cliente
- Email
- Telefono
- Fecha del evento
- Tipo de evento
- Paquete contratado

Y n8n hace esto:

```text
1. Crea token unico
2. Arma link
3. Guarda token en Google Sheets
4. Lo pone en estado PENDIENTE
5. Te manda el link por Telegram
```

Dibujito:

```text
[ Datos del cliente ]
          |
          v
[ Flujo 4 de n8n ]
          |
          +--> [ Google Sheets: token pendiente ]
          |
          +--> [ Telegram: aqui esta el link ]
```

## Flujo 5: La puerta del formulario

Este flujo no guarda respuestas. Solo decide si el cliente puede ver el formulario.

Cuando el cliente abre el link:

```text
https://n8n.lacabanaeventos.com/webhook/seleccion?token=TOKEN
```

n8n revisa:

```text
Ese token existe?
Ese token sigue pendiente?
```

Si la respuesta es si:

```text
Muestra el formulario bonito para elegir menu
```

Si la respuesta es no:

```text
Muestra: "Este link ya no esta disponible"
```

Dibujito:

```text
[ Cliente abre link ]
          |
          v
[ Flujo 5 revisa token ]
          |
          +--> Token malo/usado -> pantalla de rechazo
          |
          +--> Token pendiente -> formulario de menu
```

## Flujo 6: La caja registradora de la seleccion

Este flujo recibe lo que el cliente eligio.

Guarda:

- Menu elegido
- Numero de invitados
- Cocteleria
- Cerveza de barril
- Dietas especiales
- Notas
- Fecha de seleccion

Pero antes de guardar vuelve a preguntar:

```text
Ese token todavia esta pendiente?
```

Esto es importantisimo, porque alguien podria intentar mandar el formulario dos veces.

Dibujito:

```text
[ Cliente manda formulario ]
          |
          v
[ Flujo 6 revisa token otra vez ]
          |
          +--> Ya esta completado -> rechazar
          |
          +--> Sigue pendiente -> guardar respuesta
                                      |
                                      v
                         cambiar estado a COMPLETADO
                                      |
                                      v
                         mandar correo + Telegram
```

## Por que se bloquea despues de usarse

Antes de usarlo:

```text
token: LC-123
estado: pendiente
```

Despues de usarlo:

```text
token: LC-123
estado: completado
```

Entonces, si el cliente abre el mismo link otra vez:

```text
n8n mira Google Sheets
ve "completado"
y dice: ya no pasa
```

## Lo que ya probe

Probe un link con token falso:

```text
https://n8n.lacabanaeventos.com/webhook/seleccion?token=LC-TEST-CODEX-0001
```

Resultado:

```text
El sistema respondio:
"Este link ya no esta disponible"
```

Eso significa que la puerta del Flujo 5 si esta viva y si rechaza tokens que no existen.

## Donde puede estar fallando

Los problemas mas comunes son estos:

```text
Problema 1:
Flujo 4 guarda el token en una columna llamada Token
pero flujo 5 busca una columna llamada token.

Para Sheets y n8n eso puede ser diferente.
```

```text
Problema 2:
El estado se guarda como Pendiente, pero el IF busca pendiente.

Mejor usar siempre:
pendiente
completado
cancelado
```

```text
Problema 3:
Flujo 5 busca el token en body.token,
pero el token viene en la URL:
?token=...

En flujo 5 debe leerse desde query.token.
```

```text
Problema 4:
El formulario no manda el token escondido al flujo 6.

Debe llevar algo asi:
<input type="hidden" name="token" value="TOKEN">
```

```text
Problema 5:
Flujo 6 guarda una fila nueva,
pero no actualiza la fila original del token.

Lo correcto es actualizar la misma fila donde estaba el token pendiente.
```

```text
Problema 6:
El workflow esta probado en modo test,
pero no esta activado en n8n.

El link publico solo funciona bien si el workflow esta activo.
```

## Como deben estar los nodos

### Flujo 5

```text
Webhook GET /seleccion
        |
        v
Leer token de query
        |
        v
Buscar token en Google Sheets / Selecciones
        |
        v
IF: existe y estado = pendiente?
        |
        +--> Si: responder HTML del formulario
        |
        +--> No: responder link no disponible
```

### Flujo 6

```text
Webhook POST /seleccion
        |
        v
Leer token del body
        |
        v
Buscar token en Google Sheets / Selecciones
        |
        v
IF: existe y estado = pendiente?
        |
        +--> No: rechazar
        |
        +--> Si: actualizar fila
                    |
                    v
              estado = completado
                    |
                    v
              correo + Telegram
```

## Como debe verse la hoja Selecciones

La pestana `Selecciones` deberia tener columnas parecidas a estas:

```text
token
estado
nombre_cliente
email
telefono
fecha_evento
tipo_evento
paquete
menu_elegido
invitados
cocteleria
cerveza_barril
dietas_especiales
notas
fecha_seleccion
```

La columna mas importante es:

```text
token + estado
```

Ese es el candado.

## Como ordenar el CRM

Para que no sea un relajo, el Google Sheet deberia quedar asi:

```text
CRM
Eventos
Selecciones
Menus
Catalogos
Bitacora
```

### CRM

Aqui va lo principal para ver rapido al cliente:

```text
Cliente | Telefono | Fecha evento | Tipo evento | Paquete | Estado | Pendiente
```

### Eventos

Aqui va lo operativo:

```text
Fecha | Cliente | Invitados | Horario | Paquete | Anticipo | Saldo | Observaciones
```

### Selecciones

Aqui vive el sistema de tokens:

```text
Token | Estado | Cliente | Menu | Invitados | Fecha seleccion
```

### Menus

Aqui pones las opciones que puede elegir el cliente:

```text
Paquete | Entrada | Plato fuerte | Guarnicion | Bebida | Activo
```

### Catalogos

Aqui van listas para desplegables:

```text
Estados
Tipos de evento
Paquetes
Opciones de cocteleria
Opciones de cerveza
```

### Bitacora

Aqui se guarda lo que hizo el robot:

```text
Fecha | Flujo | Token | Accion | Resultado | Error
```

## Que haria yo cuando n8n abra

```text
1. Entrar al workflow del Flujo 4
2. Generar un token real
3. Ver si aparece en Selecciones como pendiente
4. Abrir el link del cliente
5. Confirmar que Flujo 5 muestre formulario
6. Enviar una seleccion de prueba
7. Confirmar que Flujo 6 guarde datos
8. Confirmar que el estado cambie a completado
9. Abrir el mismo link otra vez
10. Confirmar que ya lo rechace
```

Si esos 10 pasos pasan, el sistema esta funcionando.

## Sobre n8n atorado

Ahora mismo n8n esta en la pantalla de login. Los campos aparecen llenos, pero el boton de entrar esta deshabilitado.

Eso normalmente pasa por una de estas razones:

```text
1. El navegador lleno los campos, pero n8n no detecto que fueron escritos.
2. Falta activar algun evento de teclado.
3. La pagina se quedo medio cargada.
4. Hay un problema temporal de sesion/cookies.
```

Prueba rapida:

```text
1. Borra una letra del email y vuelve a escribirla.
2. Borra una letra de la contrasena y vuelve a escribirla.
3. Espera a que el boton se active.
4. Si no se activa, recarga la pagina.
5. Si sigue igual, abre n8n en una pestana nueva.
```

## Conclusion sencilla

El token es la pulserita.

Google Sheets es la lista del guardia.

n8n es el guardia y tambien el ayudante que guarda la respuesta.

Telegram es el mensajero que te avisa.

El cliente solo puede escoger una vez porque, despues de usar su pulserita, Google Sheets cambia de:

```text
pendiente
```

a:

```text
completado
```

y con eso el link queda cerrado.

