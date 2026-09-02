# PropellingTech — Brand en esta app

Estética: **modern tech + executive reporting + premium minimalism**. Limpia, premium, minimalista.
Mucho espacio en blanco, jerarquía clara, bordes discretos, sobrio. Sin degradados ni sombras fuertes.

## Paleta (tokens Tailwind v4 en `src/app/globals.css`)

| Token | Hex | Uso | Clases |
|-------|-----|-----|--------|
| Pacer White | `#F4F5F5` | Fondo principal | `bg-pacer` |
| Surface | `#FFFFFF` | Tarjetas / tablas | `bg-surface` |
| Outer Space | `#292626` | Texto principal | `text-ink` |
| Muted | `#78756F` | Texto secundario | `text-muted` |
| Line | `#E6E6E3` | Bordes discretos | `border-line` |
| Tech Blue | `#2D3540` | Nav / headers | `bg-nav` |
| Propel Blue | `#6BD9DE` | Acento (fills, dots, hover, gráficas) | `bg-propel`, `border-propel` |
| Propel ink | `#218A8F` | Propel para **texto/iconos sobre blanco** | `text-propel-ink` |
| Solaris | `#F3E667` | Secundario (estado) | `text-solaris` |
| Nebula | `#0E966C` | Positivo / beneficio | `text-nebula` |
| Hot Lava | `#E36D57` | Negativo / alerta | `text-hotlava` |

**Regla de contraste:** Propel Blue es cian claro → NO usar como color de texto sobre blanco. Para
texto/iconos usar `text-propel-ink`. Propel Blue sí para fondos, puntos, bordes, hover, gráficas.

## Tipografía

**New Science** (corporativa), auto-hospedada con `next/font/local` (`layout.tsx`), pesos 400/500/600/700
en `src/fonts/`. Utilidad `font-sans` por defecto. Cifras tabulares activadas globalmente para tablas.

## Logo

En `public/brand/`: `logo-pacer-white.svg` (para fondos oscuros, p.ej. la nav Tech Blue),
`logo-outer-space.svg` (fondos claros), `logo-propel-blue.svg`.

## Principios de dashboard

- Fondo Pacer White; nav/headers Tech Blue; texto Outer Space.
- Propel Blue solo para lo interactivo/destacado; secundarios solo para estados (verde=positivo, rojo=negativo).
- Priorizar lectura rápida de KPIs, variaciones, tendencias y excepciones.
- Light-only (compromiso de marca).

Fuente completa de la marca: `~/Downloads/PRE CORP PT/Propelling Brand Strategy/`.
