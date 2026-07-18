-- Agrega el estado 'vendida' al ciclo de vida de cotizaciones, para la venta
-- de cotizaciones aprobadas desde la sección de Caja.

alter type public.estado_cotizacion add value if not exists 'vendida';
