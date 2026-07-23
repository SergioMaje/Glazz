-- Opciones adicionales del configurador: vidrio, chapa/cerradura y pelicula de seguridad.
--
-- 1) items_inventario: marca que items pueden elegirse como opcion al cotizar y, para
--    los vidrios, sus atributos para poder filtrarlos por tipo y calibre. Cuando estas
--    columnas quedan en null la app las infiere de la categoria y del nombre del item
--    (ver src/lib/opciones.ts), para no tener que recapturar el inventario existente.
alter table public.items_inventario
  add column if not exists rol_configurador text
    check (rol_configurador in ('vidrio', 'chapa', 'pelicula')),
  add column if not exists vidrio_tipo text
    check (vidrio_tipo in ('crudo', 'templado', 'laminado')),
  add column if not exists vidrio_calibre_mm numeric,
  add column if not exists vidrio_acabado text;

create index if not exists items_inventario_rol_configurador_idx
  on public.items_inventario (rol_configurador)
  where rol_configurador is not null;

-- 2) cotizacion_items: opciones elegidas al cotizar. Se guarda un snapshot del costo,
--    la formula de calculo y los atributos, para que la ficha impresa y el recalculo
--    de produccion no dependan del estado actual del inventario.
alter table public.cotizacion_items
  add column if not exists opciones jsonb not null default '[]'::jsonb;
