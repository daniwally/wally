# Wally Gastos

Dashboard personal de finanzas con parser automático de mails (Gmail) y bot de Telegram para aprobar pagos en tiempo real.

## Stack

- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind 4
- **DB + Auth:** Supabase (Postgres + Realtime) — *pendiente*
- **Mail parser:** Gmail API (OAuth2) + Pub/Sub push — *pendiente*
- **Bot:** Telegram Bot API webhook — *pendiente*
- **Hosting:** Vercel · dominio `gastos.wtf-agency.works`

## Estado actual — Step 1 ✅

- Dashboard clásico con diseño sketchy (Caveat + Kalam, paper tones, charts hand-drawn SVG)
- KPIs del mes, evolución 7 meses, pendientes de aprobar, breakdown por categoría, insights
- Navegación top con tabs Dashboard / Telegram / Mail / Admin (placeholders)
- Datos dummy en `lib/mock-data.ts` (Abril 2026, cifras ARS/USD realistas)

## Próximos steps

1. **Step 2 — Supabase:** tablas `users/accounts/rules/categories/budgets/expenses/reminders/insights` + reemplazar dummy data por queries
2. **Step 3 — Gmail parser:** OAuth connect + extractor (regex + LLM fallback) + Edge Function en Pub/Sub push
3. **Step 4 — Telegram bot:** webhook en API route, inline buttons Pagar/Posponer/Ignorar
4. **Step 5 — Cron digest diario:** Vercel Cron 9am local
5. **Step 6 — Mail parser view + Admin + variante Novel**

## Dev local

```bash
npm install
npm run dev
# http://localhost:3000
```

## Build

```bash
npm run build
```

## Deploy

Auto-deploy en Vercel al push a `main`. Dominio custom: `gastos.wtf-agency.works`.

## Estructura

```
app/                     rutas del App Router
  page.tsx               dashboard (/)
  telegram|mail|admin/   tabs placeholder
components/
  TopNav.tsx
  charts/                SketchyLineChart, SketchyBars, wobbly helper
  dashboard/             KPICard, PendienteRow, InsightCard
lib/
  mock-data.ts           datos dummy
  format.ts              fmtARS, fmtUSD, fmtDateShort, diasHasta
app/globals.css          design tokens + sketchy primitives
```

## Diseño

Aesthetic intencional: **cuaderno sketchy / handwritten**. No "normalizar" a un dashboard estándar. Fuentes Caveat/Kalam, charts wobbly, chips con border-radius asimétricos, tape/sticky-notes decorativos.

Referencia completa en el bundle original de Claude Design (`design_handoff_wally_gastos/`).
