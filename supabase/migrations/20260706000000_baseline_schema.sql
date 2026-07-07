-- Migracion baseline: representa el esquema tal como existe hoy en el proyecto de Supabase
-- (creado manualmente desde el dashboard durante el Sprint 1-3).
--
-- IMPORTANTE: este archivo fue reconstruido a partir de src/types/database.ts y del README,
-- NO generado con `supabase db pull` contra el proyecto real. Antes de confiar en el como
-- fuente de verdad, hay que reemplazarlo corriendo:
--   supabase link --project-ref <ref>
--   supabase db pull
-- y revisar el diff contra este archivo (tipos exactos, defaults, indices, políticas RLS
-- reales pueden diferir de esta aproximación). Ver docs/MIGRACIONES.md.

create extension if not exists "uuid-ossp";

-- ==========================================================================
-- Usuarios (extiende auth.users)
-- ==========================================================================
create table if not exists public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null,
  apellido text not null,
  email text not null,
  rol text not null check (rol in ('admin', 'vendedor', 'bodega')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================================
-- Catalogos
-- ==========================================================================
create table if not exists public.categorias (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  descripcion text,
  icono text,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.unidades_medida (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  simbolo text not null,
  tipo text not null check (tipo in ('area', 'longitud', 'unidad', 'peso', 'volumen')),
  created_at timestamptz not null default now()
);

create table if not exists public.proveedores (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  contacto text,
  telefono text,
  email text,
  direccion text,
  nit text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================================
-- Inventario
-- ==========================================================================
create table if not exists public.items_inventario (
  id uuid primary key default uuid_generate_v4(),
  codigo text not null unique,
  nombre text not null,
  descripcion text,
  categoria_id uuid not null references public.categorias(id),
  unidad_medida_id uuid not null references public.unidades_medida(id),
  proveedor_id uuid references public.proveedores(id),
  stock_actual numeric not null default 0,
  stock_minimo numeric not null default 0,
  precio_costo numeric not null default 0,
  precio_venta numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movimientos_inventario (
  id uuid primary key default uuid_generate_v4(),
  item_id uuid not null references public.items_inventario(id),
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste', 'produccion')),
  cantidad numeric not null,
  cantidad_anterior numeric not null,
  cantidad_posterior numeric not null,
  motivo text,
  referencia text,
  usuario_id uuid not null references public.usuarios(id),
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- Productos (BOM)
-- ==========================================================================
create table if not exists public.tipos_producto (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null check (nombre in ('ventana', 'puerta', 'division', 'espejo', 'otro')),
  descripcion text,
  activo boolean not null default true
);

create table if not exists public.plantillas_producto (
  id uuid primary key default uuid_generate_v4(),
  tipo_producto_id uuid not null references public.tipos_producto(id),
  nombre text not null,
  descripcion text,
  requiere_medidas boolean not null default true,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plantilla_componentes (
  id uuid primary key default uuid_generate_v4(),
  plantilla_id uuid not null references public.plantillas_producto(id) on delete cascade,
  item_id uuid not null references public.items_inventario(id),
  formula text not null check (formula in ('area', 'perimetro', 'ancho', 'alto', 'fijo')),
  cantidad_fija numeric,
  desperdicio_pct numeric not null default 0,
  obligatorio boolean not null default true
);

-- Referencias de producto con formulas de corte (agregado en Sprint 3)
create table if not exists public.referencias_producto (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  descripcion text,
  tipo_producto_id uuid not null references public.tipos_producto(id),
  plantilla_id uuid not null references public.plantillas_producto(id),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referencias_corte (
  id uuid primary key default uuid_generate_v4(),
  referencia_id uuid not null references public.referencias_producto(id) on delete cascade,
  nombre_pieza text not null,
  formula text not null check (formula in (
    'ancho', 'alto', 'ancho_menos_margen', 'alto_menos_margen',
    'mitad_ancho', 'mitad_alto', 'fijo'
  )),
  margen_cm numeric not null default 0,
  cantidad_fija_cm numeric,
  cantidad_piezas integer not null default 1,
  orden integer not null default 0,
  created_at timestamptz not null default now()
);

-- ==========================================================================
-- Comercial
-- ==========================================================================
create table if not exists public.clientes (
  id uuid primary key default uuid_generate_v4(),
  nombre text not null,
  apellido text not null,
  empresa text,
  tipo text not null check (tipo in ('natural', 'juridico')),
  documento text,
  telefono text,
  email text,
  direccion text,
  ciudad text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cotizaciones (
  id uuid primary key default uuid_generate_v4(),
  numero text not null unique,
  cliente_id uuid not null references public.clientes(id),
  usuario_id uuid not null references public.usuarios(id),
  estado text not null check (estado in ('borrador', 'enviada', 'aprobada', 'rechazada', 'vencida')),
  fecha_emision timestamptz not null default now(),
  fecha_vencimiento timestamptz,
  subtotal numeric not null default 0,
  descuento_pct numeric not null default 0,
  iva_pct numeric not null default 0,
  total numeric not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cotizacion_items (
  id uuid primary key default uuid_generate_v4(),
  cotizacion_id uuid not null references public.cotizaciones(id) on delete cascade,
  plantilla_id uuid references public.plantillas_producto(id),
  descripcion text not null,
  ancho_cm numeric,
  alto_cm numeric,
  area_m2 numeric,
  cantidad numeric not null default 1,
  precio_unitario numeric not null default 0,
  precio_total numeric not null default 0,
  notas text
);

create table if not exists public.ordenes_trabajo (
  id uuid primary key default uuid_generate_v4(),
  numero text not null unique,
  cotizacion_id uuid references public.cotizaciones(id),
  cliente_id uuid not null references public.clientes(id),
  estado text not null check (estado in ('pendiente', 'en_produccion', 'lista', 'entregada', 'cancelada')),
  fecha_inicio timestamptz,
  fecha_entrega_estimada timestamptz,
  fecha_entrega_real timestamptz,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================================
-- Row Level Security
-- ==========================================================================
-- El README indica que RLS ya esta activo con politicas creadas manualmente en
-- el dashboard. Se habilita aqui por completitud, pero las politicas reales
-- deben traerse con `supabase db pull` (ver nota al inicio del archivo).
alter table public.usuarios enable row level security;
alter table public.categorias enable row level security;
alter table public.unidades_medida enable row level security;
alter table public.proveedores enable row level security;
alter table public.items_inventario enable row level security;
alter table public.movimientos_inventario enable row level security;
alter table public.tipos_producto enable row level security;
alter table public.plantillas_producto enable row level security;
alter table public.plantilla_componentes enable row level security;
alter table public.referencias_producto enable row level security;
alter table public.referencias_corte enable row level security;
alter table public.clientes enable row level security;
alter table public.cotizaciones enable row level security;
alter table public.cotizacion_items enable row level security;
alter table public.ordenes_trabajo enable row level security;
