# Cómo trabajar con migraciones de Supabase

Este documento explica el flujo diario para cambiar el esquema de la base de datos
del proyecto Glazz cuando se trabaja en equipo. Reemplaza la práctica anterior de
editar tablas directamente desde el dashboard de Supabase.

## Por qué migraciones y no el dashboard

Con un solo desarrollador, cambiar una tabla desde el dashboard de Supabase funcionaba
porque solo existía una fuente de verdad. Con dos personas trabajando en paralelo, eso
genera problemas:

- Un desarrollador no se entera de que el otro cambió una columna hasta que su código
  falla en producción.
- No hay historial de qué cambió, cuándo ni por qué (los commits de git sí lo dan).
- No hay forma de reproducir el esquema en un entorno local o de pruebas.

Las migraciones son archivos `.sql` versionados en `supabase/migrations/`, cada uno con
un cambio incremental. Git se vuelve la fuente de verdad del esquema, igual que ya lo es
del código.

## Setup inicial (una sola vez por persona)

1. Instalar la Supabase CLI: https://supabase.com/docs/guides/cli/getting-started
2. Iniciar sesión:
   ```bash
   supabase login
   ```
3. Conectar el repo local al proyecto remoto de Supabase (pide el `project-ref`, visible
   en Settings → General del proyecto en el dashboard):
   ```bash
   supabase link --project-ref <ref>
   ```
4. (Opcional pero recomendado) Instalar Docker Desktop para poder correr Supabase
   localmente y probar migraciones antes de aplicarlas al proyecto remoto compartido.

## Si acabas de clonar el repo

El repo ya trae `supabase/migrations/20260706000000_baseline_schema.sql`, una
aproximación del esquema actual. Antes de confiar en ella:

```bash
supabase link --project-ref <ref>
supabase db pull
```

Esto trae el esquema real del proyecto remoto y genera (o corrige) las migraciones
locales para que coincidan exactamente con lo que ya existe en producción. Revisa el
diff y commitea el resultado si `db pull` genera cambios sobre el baseline.

## Crear una migración nueva

Cada vez que necesites cambiar el esquema (nueva tabla, columna, índice, política RLS,
etc.):

1. Crea el archivo de migración:
   ```bash
   supabase migration new agregar_columna_descuento_clientes
   ```
   Esto genera `supabase/migrations/<timestamp>_agregar_columna_descuento_clientes.sql`.
2. Escribe el SQL a mano en ese archivo. Ejemplo:
   ```sql
   alter table public.clientes
     add column descuento_pct numeric not null default 0;
   ```
3. Pruébala localmente (requiere Docker):
   ```bash
   supabase start        # levanta Postgres local con todas las migraciones existentes
   supabase db reset     # reaplica TODAS las migraciones desde cero, incluida la nueva
   ```
   Si `db reset` falla, tu migración tiene un error — corrígela antes de seguir. Esto es
   lo que hubiera detectado, por ejemplo, un error de sintaxis al crear en su momento
   las tablas `referencias_producto` / `referencias_corte`.
4. Commitea el archivo `.sql` junto con el código que lo usa (mismo PR). El código de
   la app y el esquema que necesita deben viajar juntos.

## Aplicar la migración al proyecto remoto compartido

Las migraciones se aplican al remoto **solo cuando el PR ya fue aprobado y mergeado a
`master`**, nunca antes — así se evita que alguien pruebe algo a medias contra la base
de datos que usan ambos.

```bash
git checkout master
git pull
supabase db push
```

Quien mergea el PR es quien corre `db push`. Avisar en el chat del equipo antes de
correrlo, para que no coincida con el otro desarrollador aplicando otra migración al
mismo tiempo.

## Si ambos crean una migración en paralelo

El nombre del archivo empieza con un timestamp (`YYYYMMDDHHMMSS_...`), así que Supabase
las aplica en orden cronológico. Si ambos crearon migraciones en ramas distintas:

1. El primero en mergear a `master` hace su `db push` normalmente.
2. El segundo, antes de mergear, hace `git pull origin master` en su rama para traer la
   migración del otro, corre `supabase db reset` localmente para confirmar que las dos
   migraciones (la ya mergeada + la suya) conviven sin conflicto, y luego mergea.
3. Si hay conflicto real de esquema (ej. ambos agregaron una columna con el mismo
   nombre pero distinto tipo), se resuelve conversando — no hay forma automática de
   fusionar cambios de esquema contradictorios.

## Buenas prácticas

- **Una migración = un cambio lógico.** No mezcles "agregar tabla X" con "renombrar
  columna Y" en el mismo archivo si son cambios independientes.
- **Nunca edites una migración ya commiteada y mergeada a `master`.** Si el proyecto
  remoto ya la aplicó, editarla localmente no la vuelve a aplicar — vas a tener que
  crear una migración nueva que corrija lo que haga falta.
- **Nombres descriptivos**: `agregar_indice_items_categoria`, no `fix` o `cambios`.
- **Evita cambios destructivos sin avisar** (`drop table`, `drop column`): si alguien
  más tiene datos de prueba o código que depende de esa columna, coordina antes en el
  equipo.
- Referencia rápida de comandos: `supabase migration new`, `supabase db reset` (local),
  `supabase db pull` (traer remoto → local), `supabase db push` (aplicar local → remoto).
