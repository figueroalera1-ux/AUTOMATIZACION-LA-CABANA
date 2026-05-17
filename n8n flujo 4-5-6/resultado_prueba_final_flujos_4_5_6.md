# Resultado final de prueba - Flujos 4, 5 y 6

Fecha de prueba: 11 de mayo de 2026, aprox. 9:32 p.m.

## Lo que se probo

Se ejecuto el webhook publico del Flujo 6:

```text
POST https://n8n.lacabanaeventos.com/webhook/seleccion-guardar
```

Con el token:

```text
TEST-ANGEL-001
```

## Resultado

El Flujo 6 respondio con pantalla de seleccion confirmada.

Despues se reviso Google Sheets, pestana `Selecciones`, y el token quedo con:

```text
status = completado
fecha_seleccion = 11/5/2026, 9:32:10 p.m.
```

Despues se abrio otra vez:

```text
https://n8n.lacabanaeventos.com/webhook/seleccion?token=TEST-ANGEL-001
```

Resultado:

```text
BLOQUEADO: ya no abre el formulario
```

Eso confirma que el candado principal ya funciona:

```text
token + status pendiente = abre formulario
token + status completado = link no disponible
```

## Prueba con token falso

Tambien se probo un POST con:

```text
LC-CODEX-TOKEN-FALSO
```

Resultado:

```text
El Flujo 6 lo rechazo con pantalla de error.
```

## Hallazgo importante

En la hoja `Selecciones` aparecen filas duplicadas con el mismo token:

```text
TEST-ANGEL-001
```

Una fila quedo completada por la prueba final, pero tambien existe otra fila vieja con el mismo token y status pendiente.

Recomendacion:

```text
No debe haber tokens duplicados en Selecciones.
```

La limpieza recomendada es dejar solo una fila por token. Si se conserva un duplicado historico, debe quedar como:

```text
status = completado
```

o moverse a una pestana de archivo.

## Conclusion

Los flujos 5 y 6 ya validan correctamente el candado cuando el token usado por Sheets esta en `completado`.

El riesgo restante no es la logica del flujo, sino los duplicados en Google Sheets. Para evitar problemas futuros, la columna `token` debe ser unica.
