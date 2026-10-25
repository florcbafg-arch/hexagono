# Hexaflow — Diseño formal de Despiece y Seguimiento

## Principio general

- Pedido confirmado = demanda comercial congelada.
- Despiece = transforma esa demanda en necesidad técnica de materiales.
- Stock = informa disponibilidad real.
- Compras = resuelve el faltante.
- Seguimiento = observa el estado integral sin duplicar datos ni permitir editar estados que pertenecen a otros módulos.

## Lote de Despiece / Compra

Un lote puede reunir artículos provenientes de distintos Pedidos confirmados. Cada artículo se incorpora desde el snapshot inmutable del Pedido, no desde datos vivos editables.

El lote sirve para:
1. agrupar artículos que Compras desea procesar en conjunto;
2. medir total de artículos y pares;
3. ejecutar luego la explosión individual;
4. consolidar necesidades por material;
5. alimentar Stock y Compras sin mezclar responsabilidades.

## Clasificación de materiales/componentes para Despiece

La clasificación pertenece al USO del componente dentro del artículo, no al Maestro de Materiales.

### no_escalado
El material puede tener consumo/rinde diferente por talle, pero la unidad comprada no tiene una escala propia por talle.
Ejemplos típicos: cuero, gamuza, PU, textiles, goma espuma, adhesivos.

### escalado_alineado
El componente tiene escala propia y usa la misma correspondencia que el artículo a fabricar.
Ejemplo conceptual: artículo 37 -> componente 37.

### escalado_desalineado
El componente tiene escala propia, pero su talle no coincide necesariamente con el talle del artículo. Requiere una matriz explícita de equivalencias:
talle_articulo -> talle_componente.

Ejemplo documentado en el manual: transfer de plantilla por talle.

## Regla de bloqueo de escala

Todo uso escalado debe tener su escala confirmada antes de cerrar el Despiece.

Un componente con curva/escala pendiente debe generar:
- advertencia mientras se prepara el lote;
- bloqueo antes de consolidar/cerrar el Despiece.

## Trazabilidad matemática

Toda necesidad calculada debe poder explicarse hacia atrás:

Lote -> Pedido snapshot -> Artículo -> Talle -> Línea/componente -> Rinde o regla de consumo -> Cantidad resultante.

## Seguimiento como módulo independiente

Seguimiento será un módulo propio de solo lectura operativa.

No será fuente de verdad de estados. Consultará los módulos responsables:

- Pedido
- Ficha Técnica
- Patrón
- Rindes
- Despiece
- Stock
- Compras
- Programación
- Producción

Ejemplo de estado integral:

Pedido confirmado -> técnica apta -> despiece calculado -> faltante detectado -> en compras -> material completo -> apto para programación -> en producción -> completado.

Los estados automáticos deben derivarse de datos reales. Solo se permitirán observaciones manuales cuando representen información que no exista en otra fuente.
