# Guía de contribución — Glazz

Este documento define cómo trabajamos en el repo ahora que somos dos personas. El
objetivo es evitar pisarse cambios (de código y de base de datos) y mantener `master`
siempre en un estado funcional.

## Setup local

1. `git clone <url-del-repositorio>`
2. `npm install`
3. Copia `.env.example` a `.env.local` y completa las credenciales de Supabase
   (Settings → API en el dashboard).
4. `npm run dev`

Si es la primera vez que trabajas con el esquema de base de datos versionado, sigue
también el setup de Supabase CLI en [docs/MIGRACIONES.md](docs/MIGRACIONES.md).

## Flujo de ramas (GitHub Flow)

- `master` siempre debe quedar en un estado desplegable. **Nunca se hace push directo
  a `master`.**
- Todo cambio se hace en una rama nueva desde `master` actualizado:
  ```bash
  git checkout master
  git pull origin master
  git checkout -b feature/nombre-corto   # o fix/nombre-corto
  ```
- Al terminar, se abre un Pull Request hacia `master`. El otro desarrollador revisa
  (aunque sea una pasada rápida) antes de mergear.
- El PR debe pasar el check de CI (lint + build) antes de mergearse.
- Después de mergear, borrar la rama.

## Convención de commits

Seguimos el estilo ya usado en el historial del proyecto (conventional commits ligero):

- `feat: ...` — funcionalidad nueva
- `fix: ...` — corrección de bug
- `refactor: ...` — cambio interno sin alterar comportamiento
- `docs: ...` — solo documentación
- `chore: ...` — configuración, dependencias, tareas de mantenimiento

Mensajes en español, en modo imperativo, describiendo el porqué cuando no sea obvio.

## Cambios al esquema de base de datos

El esquema se maneja con migraciones versionadas de Supabase CLI, no editando el
dashboard directamente. Ver la guía completa en
[docs/MIGRACIONES.md](docs/MIGRACIONES.md). En resumen:

- Todo cambio de esquema va en una migración `.sql` dentro de `supabase/migrations/`,
  commiteada en el mismo PR que el código que la necesita.
- La migración se aplica al proyecto remoto (`supabase db push`) solo después de que
  el PR se mergeó a `master`.

## Variables de entorno

- Nunca commitear `.env.local` (ya está en `.gitignore`).
- Si agregas una variable de entorno nueva, actualiza también `.env.example`.

## Checklist para invitar al compañero (una sola vez)

Esto lo hace quien administra el repo y el proyecto de Supabase (no se automatiza
porque son cambios de configuración de servicios compartidos):

- [ ] GitHub → Settings → Collaborators → invitar al compañero.
- [ ] GitHub → Settings → Branches → agregar regla de protección para `master`:
      requerir Pull Request antes de mergear, requerir que pase el check de CI.
- [ ] Supabase → Settings → Team → invitar al compañero al proyecto (para que pueda
      hacer `supabase link` con sus propias credenciales).
- [ ] Compartir el `project-ref` de Supabase (no es secreto, pero se necesita para
      `supabase link`).
