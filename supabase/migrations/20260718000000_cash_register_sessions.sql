-- Sesiones de caja: apertura y cierre de turno.

create type public.estado_caja as enum ('open', 'closed');

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid not null references public.usuarios(id),
  closed_by uuid references public.usuarios(id),
  opening_amount numeric not null,
  expected_amount numeric,
  counted_amount numeric,
  difference numeric,
  status public.estado_caja not null default 'open',
  created_at timestamptz not null default now()
);

-- Solo puede existir una fila con status = 'open' a la vez (evita doble apertura,
-- incluso ante clics simultáneos, sin necesitar un trigger).
create unique index if not exists cash_register_sessions_one_open_idx
  on public.cash_register_sessions (status)
  where status = 'open';

alter table public.cash_register_sessions enable row level security;

create policy autenticados_select_caja on public.cash_register_sessions
  for select using (auth.uid() is not null);
create policy autenticados_insert_caja on public.cash_register_sessions
  for insert with check (auth.uid() is not null);
create policy autenticados_update_caja on public.cash_register_sessions
  for update using (auth.uid() is not null);
create policy admin_delete_caja on public.cash_register_sessions
  for delete using (get_user_rol() = 'admin'::rol_usuario);
