# VocabCrafter UI Practices & Design Guidelines

This document defines the shared UI architecture, layout conventions, accessibility baseline, and review heuristics used across VocabCrafter (`/lessons`, `/settings`, `/tense-detector`, global header/menus, and future pages).

---

## 1. How We Evaluate & Judge UI Changes

Every screen or component update is evaluated against five practical criteria:

1. **Cognitive Load & Visual Hierarchy**
   - Keep one clear primary action per region. Remove duplicate controls (for example, don't put two Reset buttons or repeat a setting across both a header menu and a local card unless one is the primary 1-click shortcut).
   - Hide or move secondary preferences out of crowded menus into `/settings`.
   - Favor concise explanations and scannable chips over multi-paragraph prose inside workspace cards.

2. **Spatial & Vertical Stability (Zero Layout Shift)**
   - Switching tabs, tenses, filters, or AI feedback states must **never** push primary interactive canvases (calendars, graphs, tables) up or down.
   - Reserve dedicated horizontal space or lock desktop container heights (`lg:h-[160px]`) paired with `h-full min-h-0` grid children and `min-h-0 flex-1 overflow-y-auto` bodies.
   - Move asynchronous feedback panels (AI checks, validation banners) into fixed slots when interactive canvases sit directly underneath.

3. **Flow-Based Alignment Over Fragile Absolute Positioning**
   - Avoid `position: absolute` for adjacent header controls that can collide with variable-length dynamic titles or badges on medium viewports.
   - Prefer Flexbox (`flex flex-wrap items-center justify-between gap-3`) or named CSS Grid tracks (`grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]`) so neighboring elements naturally wrap or stay aligned.

4. **Action Placement Hierarchy**
   - **Top Header Bar (`src/components/layout/header.tsx`)**: Global, 1-click ambient tools used from any page (`Ask Assistant`, `How It Works`, `HeaderThemeControls` for Color Palette + Light/Dark mode, and `UserMenu`).
   - **Quick Profile Menu (`src/components/layout/user-menu.tsx`)**: Strictly account & session essentials (`Membership & Billing`, `App language`, `Sign out`).
   - **Sidebar (`src/components/layout/nav-links.tsx`)**: Route navigation, including `/settings`.
   - **Settings Page (`src/app/(platform)/settings/page.tsx`)**: Persistent configuration (profile, study languages, CEFR level, AI Voice engine toggle & voice selector).

5. **Interactive Board Clarity**
   - Remove unnecessary chrome on teaching whiteboards (e.g., omit redundant TTS buttons or duplicate status badges inside headers when the same signal already lives inside the interactive card or feedback panel).
   - Connect abstract theory directly to the student's example by highlighting the matching **time marker** and **active grammatical function** in place.

---

## 2. Standard Layout Patterns

### A. Page Header (`LessonsPageHeader` / `BillingPageHeader` Convention)
Use the standard bottom-bordered responsive header row:

```tsx
<div className="flex flex-col gap-4 border-b border-border/50 pb-4 lg:flex-row lg:items-center lg:justify-between">
  <div className="space-y-1">
    <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
  </div>
  <div className="flex flex-wrap items-center gap-2.5">
    {/* Segmented section tabs or primary page action */}
  </div>
</div>
```

### B. Segmented Controls & Header Pill Containers
Match `LessonsSectionTabs` and `HeaderThemeControls`:
- Shell: `inline-flex items-center gap-1 rounded-xl border border-border/70 bg-card/70 p-1 shadow-xs`
- Active pill/tab: `bg-primary text-primary-foreground shadow-xs` (or shared `motion.span` with `layoutId` and spring transition).
- Inactive pill/tab: `text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground`.

### C. Stable-Height Symmetric Grids (Dashboards & Whiteboards)
When presenting contextual panels of varying length (such as time markers, tense functions, and AI feedback) above a primary visualization:
- Header Row 1: Left-aligned identity (`Clock` icon + `CardTitle` + highlighted `Структура` badge) with workspace action (`Скинути`) on the far right via `justify-between`.
- Header Row 2: Fixed desktop height (`lg:h-[160px]`) symmetric grid:
  - Equal outer columns (`minmax(0,1fr)`) frame a centered middle column (`minmax(0,1.15fr)`).
  - Every card uses `flex h-full min-h-0 flex-col rounded-xl border border-border/60 bg-background/45 px-3.5 py-2.5`.
  - Use `my-auto` inside a flex scrollport (`flex min-h-0 w-full flex-1 overflow-y-auto`) when content should stay centered when short and scroll safely from the top when taller than the panel.

### D. Structured Settings Forms (`SettingsSection` + `SettingsFieldRow`)
On desktop views (`src/app/(platform)/settings/page.tsx`):
- Group related preferences into sections with hairline dividers (`divide-y divide-border/60 border-y border-border/60`).
- Pair a `220px` left label/description column with a flexible control column (`md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:gap-8`) and keep the Save action sticky in a right aside (`xl:sticky xl:top-24`).

---

## 3. Theming, Color Tokens & Semantic Cues

- **Theme Parity**: All surfaces must work seamlessly across Light/Dark modes and all 5 curated palettes (`forest`, `slate-emerald`, `midnight-indigo`, `warm-terracotta`, `deep-ocean`). Rely on semantic CSS variables (`bg-background`, `bg-card`, `border-border/60`, `text-foreground`, `text-muted-foreground`, `text-primary`) defined in `src/app/globals.css`.
- **Hydration-Safe Theme Reading**: Client theme controls must gate DOM theme attributes/resolved theme reads with `useSyncExternalStore` (see `HeaderThemeControls` and `ThemeToggle`) to avoid hydration mismatches and React Compiler lint violations.
- **Semantic Teaching Highlights** (pair translucent fills with readable text contrast in both light and dark modes):
  - **Emerald** (`border-emerald-500/... bg-emerald-500/... text-emerald-700 dark:text-emerald-300`): Primary verb forms, active grammatical functions (`У реченні`), positive validation (`Правильно`).
  - **Sky** (`border-sky-500/... bg-sky-500/... text-sky-700 dark:text-sky-300`): Matched time markers (`На графіку`) and `"ДО"` cutoff boundaries.
  - **Amber** (`border-amber-500/... bg-amber-500/... text-amber-700 dark:text-amber-300`): Conditional `IF` clauses, grammar corrections (`Виправлено`), and stative verb notices.
  - **Destructive** (`border-destructive/40 bg-destructive/10 text-destructive`): Validation or API errors.

---

## 4. Motion & Animation Rules

1. **GPU-Composited Properties Only**: Animate `transform` (`x`, `y`, `scale`) and `opacity` — never animate CSS layout properties (`left`, `top`, `width`, `height`) on sliding timeline markers or overlays.
2. **Coordinate Centering**: Wrap sliding markers in `inset-x-0 flex justify-center` layers and animate `x: "${pct - 50}%"` instead of fragile negative percentage offsets.
3. **Transition Rhythm**:
   - Interactive drag tracking: responsive spring (`stiffness: 680, damping: 40, mass: 0.5`).
   - Snap / tab switches: calm spring (`stiffness: 340, damping: 30, mass: 0.75`).
   - Contextual panel crossfades: `<AnimatePresence mode="wait" initial={false}>` with a short easing curve (`duration: 0.16`).
4. **Reduced Motion**: Always check `useReducedMotion()` and degrade animated transitions to `{ duration: 0 }` when enabled.

---

## 5. Accessibility (WCAG 2.1 AA) Baseline

- **Focus Indicators**: Interactive buttons, sliders, and pills must include explicit `focus-visible` rings (`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`). Use `onMouseDown={(e) => e.preventDefault()}` only on full-height decorative canvas hit-targets where click focus rings obscure dragging, while preserving keyboard `Tab` focus.
- **Custom Controls & Sliders**: Timeline markers expose `role="slider"`, `aria-label`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-valuetext`, and handle `ArrowLeft`, `ArrowRight`, `Home`, and `End` keys.
- **Live Announcements**: Asynchronous AI feedback uses `role="status" aria-live="polite"` for results and `role="alert"` for error states.
- **State Labeling**: Every toggle/pill group exposes `role="group"`, `aria-label`, and `aria-pressed` (or native Radix/Shadcn ARIA roles). Icon-only buttons always provide descriptive `aria-label` (and `title`) text matching the active app language.

---

## 6. Pre-Ship UI Review Checklist

Before marking a UI change complete:
1. Does the header follow the `LessonsPageHeader` / segmented pill convention?
2. Is there zero vertical layout shift when switching tabs, empty vs. populated states, or receiving async results?
3. Are adjacent header items laid out with Flex/Grid rather than collision-prone `absolute` offsets?
4. Does the Quick Menu stay focused on account actions while 1-click theme controls live in the Header and deep preferences live in `/settings`?
5. Do all text/badge combinations remain legible across both Light & Dark themes and all 5 color palettes?
6. Are all animations compositor-only (`transform` / `opacity`) and gated by `useReducedMotion()`?
7. Are all icon-only controls labeled (`aria-label`) and keyboard-reachable with visible `focus-visible` rings?
8. Does `npx tsc --noEmit && npx eslint ...` pass cleanly with zero warnings or errors?
