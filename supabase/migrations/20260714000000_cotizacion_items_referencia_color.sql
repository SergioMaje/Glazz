-- Persistir la referencia y el color de perfil elegidos en el configurador,
-- para que la orden de trabajo pueda recalcular cortes y materiales.
alter table public.cotizacion_items
  add column if not exists referencia_id uuid references public.referencias_producto(id),
  add column if not exists color_perfil text;
