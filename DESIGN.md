# Design System — Black Circle OS

Ce document décrit le système de design "Black Circle" tel qu'implémenté dans `src/app/globals.css`, les polices custom, et les composants UI/visuels du projet. Il sert de référence pour garder la cohérence visuelle entre les nouvelles pages/composants.

## 1. Identité visuelle

Thème unique **sombre, quasi-noir, avec accent ambre**. Pas de mode clair implémenté à ce jour (uniquement `.dark` shadcn en support technique, non utilisé en pratique — l'app tourne via les classes `.bc-*` custom).

## 2. Design tokens (`--bc-*`)

Définis dans `:root` de `src/app/globals.css`.

| Token | Valeur | Usage |
|---|---|---|
| `--bc-bg` | `#030303` | Fond général de l'app |
| `--bc-sidebar` | `#000000` | Fond de la sidebar |
| `--bc-surface` | `#0b0b0b` | Fond des cartes / mini-cards |
| `--bc-surface-2` | `#121212` | Fond secondaire (icônes, cellules, inputs) |
| `--bc-surface-3` | `#191919` | Fond tertiaire (hover menus) |
| `--bc-border` | `#1d1d1d` | Bordures standard |
| `--bc-text` | `#f2efe8` | Texte principal (blanc cassé) |
| `--bc-text-dim` | `#8c8a85` | Texte secondaire |
| `--bc-text-faint` | `#565550` | Texte tertiaire / labels |
| `--bc-amber` | `#e8b368` | Couleur d'accent principale (CTA, actif, highlights) |
| `--bc-amber-dim` | `#8a6e42` | Amber atténué (bordures "today", etc.) |
| `--bc-amber-glow` | `rgba(232,179,104,.14)` | Fonds translucides pour états actifs |
| `--bc-green` | `#7fae86` | Statut positif / succès |
| `--bc-red` | `#c1604a` | Statut négatif / erreur |
| `--bc-blue` | `#7fa3c4` | Accent secondaire (avatars équipe, stats) |
| `--bc-rose` | `#c08a9a` | Accent secondaire (stats) |
| `--bc-radius` | `18px` | Rayon de bordure de référence pour les cartes |

Ces tokens sont indépendants du thème shadcn (`--background`, `--primary`, etc. en `oklch`) qui reste le socle par défaut de `shadcn/ui` mais n'est pas la source de vérité visuelle de l'app — c'est la couche `.bc-*` qui pilote le rendu réel des pages.

### Radius dérivés (via `@theme inline`)
`--radius-sm/md/lg/xl/2xl/3xl/4xl` sont calculés en fractions de `--radius` (variable shadcn séparée de `--bc-radius`).

## 3. Typographie

Trois polices locales chargées dans `src/app/fonts/index.ts` (`next/font/local`, fichiers `.woff2`) :

| Police | Variable CSS | Usage |
|---|---|---|
| **Fraunces** (regular + italic) | `--font-fraunces` | Titres, logo, valeurs héro, section titles — l'italique porte l'identité de marque |
| **Inter** | `--font-inter` | Corps de texte, UI générale |
| **JetBrains Mono** | `--font-jbmono` | Labels, eyebrows, valeurs chiffrées (tabular nums), timestamps, badges |

Convention : les **chiffres/données** (montants, stats, dates) sont en JetBrains Mono avec `font-variant-numeric: tabular-nums` ; les **titres de section** sont en Fraunces italique ; le **texte courant** est en Inter.

## 4. Composants shadcn/ui (`src/components/ui/`)

Socle standard shadcn, style `base-nova`, `baseColor: neutral` (voir `components.json`) :

`avatar` · `badge` · `button` · `card` · `dialog` · `input` · `label` · `scroll-area` · `select` · `separator` · `sheet` · `table` · `tabs` · `tooltip`

Ce sont des primitives génériques réutilisables partout ; elles héritent du thème shadcn en `oklch` (background/foreground/border/ring...).

## 5. Composants métier/visuels custom

| Composant | Fichier | Rôle |
|---|---|---|
| `Sidebar` | `src/components/shared/Sidebar.tsx` | Navigation principale (desktop + off-canvas mobile) |
| `PeriodToggle` | `src/components/shared/PeriodToggle.tsx` | Sélecteur de période (Dashboard/Analytics) |
| `RingGauge` | `src/components/shared/RingGauge.tsx` | Jauge circulaire (`.bc-ring-tile`, `.bc-ring-track`, `.bc-ring-fill`) |
| `Sparkline` | `src/components/dashboard/Sparkline.tsx` | Mini-graphe de tendance |
| `KanbanBoard` | `src/components/pipeline/KanbanBoard.tsx` | Tableau Kanban du pipeline vidéo |
| `PipelineVideoModal` | `src/components/pipeline/PipelineVideoModal.tsx` | Modal de détail vidéo dans le pipeline |

## 6. Classes CSS "Black Circle" (bespoke, non-Tailwind)

Le bloc en bas de `globals.css` (§ *Black Circle OS component classes*) contient des classes CSS écrites à la main, **portées 1:1 depuis des maquettes statiques approuvées**, plutôt que des utilitaires Tailwind — objectif : rester pixel-perfect avec le design validé. Ne pas les réécrire en utilitaires Tailwind sans revalider visuellement.

Familles principales :

- **Layout d'app** : `.bc-shell`, `.bc-sidebar`, `.bc-main`, `.bc-topbar`, `.bc-mobile-topbar`, `.bc-sidebar-backdrop`
- **Navigation** : `.bc-nav`, `.bc-nav-btn` (+ `.active`), `.bc-nav-label`, `.bc-profile-switch`, `.bc-profile-menu`
- **Hero / stats** : `.bc-hero-glow` (glow radial + grain de points en pseudo-éléments), `.bc-hero-split`, `.bc-stat-badges`, `.bc-sb-icon` (variantes `.c-amber/.c-green/.c-blue/.c-rose`)
- **Cartes** : `.bc-card`, `.bc-mini-card` (variantes de valeur `.pos/.neg/.amber`), `.bc-client-card`, `.bc-team-card`
- **Listes** : `.bc-watch-row` (statuts `.dot-ok/.dot-warn/.dot-crit`), `.bc-report-row`
- **Grilles responsives** : `.bc-grid4`, `.bc-grid2b`, `.bc-client-grid` (breakpoint `1050px`)
- **Calendrier** : `.bc-cal-grid`, `.bc-cal-cell` (`.today`), `.bc-cal-chip`
- **Filtres/chips** : `.bc-plat-filter`, `.bc-plat-chip` (`.active`)
- **Heatmap** : `.bc-heatmap`, `.bc-hm-cell` (`.best`), `.bc-heatmap-legend`
- **Formulaires** : `.bc-form-grid`, focus ring en `--bc-amber`
- **Tableau de permissions** : `.bc-perm-table`, `.bc-perm-yes`, `.bc-perm-no`

### Statuts / sémantique couleur
Le code couleur des statuts est cohérent dans toute l'app :
- **vert** (`--bc-green`) = OK / positif
- **ambre** (`--bc-amber`) = attention / actif / accent de marque
- **rouge** (`--bc-red`) = critique / négatif
- **bleu / rose** = accents décoratifs secondaires (avatars, catégories de stats), pas de sémantique de statut

## 7. Responsive

Breakpoints actuellement gérés en CSS pur (pas de config Tailwind custom associée) :
- `max-width: 1050px` → grilles passent de 3–4 colonnes à 2 colonnes
- `max-width: 768px` → sidebar en off-canvas (`.bc-sidebar.open` + backdrop), topbar mobile avec hamburger, `.bc-main` avec padding réduit, `.bc-hero-split` en colonne, `.bc-stat-badges` en 2 colonnes, `.bc-form-grid` en 1 colonne

À vérifier/étendre : Kanban (`KanbanBoard`) et modals (`PipelineVideoModal`) n'ont pas de règles responsive dédiées identifiées à ce jour.

## 8. Conventions pour ajouter un nouveau composant visuel

1. Réutiliser les tokens `--bc-*` existants plutôt que des couleurs en dur.
2. Respecter la convention typographique (Fraunces pour titres/valeurs héro, JetBrains Mono pour données/labels, Inter pour le corps).
3. Réutiliser les patterns de statut vert/ambre/rouge pour toute UI d'état.
4. Ajouter une règle `@media (max-width: 768px)` si le composant est visible sur les pages dashboard/pipeline.
5. Préférer les primitives shadcn (`src/components/ui/`) pour tout élément interactif générique (dialog, select, tabs...) ; réserver les classes `.bc-*` aux éléments visuels sur-mesure alignés sur les maquettes approuvées.
