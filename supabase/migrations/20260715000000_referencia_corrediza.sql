-- Marca si una referencia de producto es corrediza y qué piezas de corte deslizan

alter table public.referencias_producto
  add column es_corrediza boolean not null default false;

alter table public.referencia_cortes
  add column es_corredizo boolean not null default false;
