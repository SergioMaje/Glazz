-- Venta de cotizaciones aprobadas desde la sección de Caja.

create type public.metodo_pago_venta as enum ('efectivo', 'tarjeta', 'transferencia');

create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  cotizacion_id uuid not null unique references public.cotizaciones(id),
  session_id uuid not null references public.cash_register_sessions(id),
  metodo_pago public.metodo_pago_venta not null,
  monto numeric not null,
  usuario_id uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

alter table public.ventas enable row level security;

create policy autenticados_select_ventas on public.ventas
  for select using (auth.uid() is not null);
create policy autenticados_insert_ventas on public.ventas
  for insert with check (auth.uid() is not null);
create policy admin_delete_ventas on public.ventas
  for delete using (get_user_rol() = 'admin'::rol_usuario);
