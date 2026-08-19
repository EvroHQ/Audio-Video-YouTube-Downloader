# EvroHQ Downloader — 6 thèmes (couleurs + typo)

Spec d'implémentation. Toutes les couleurs sont en `oklch()`. Chaque thème = un jeu de variables CSS
sur `[data-theme="…"]` + 2 polices (une sans, une mono). La structure de l'UI ne change jamais,
seuls les tokens changent.

| id | nom | mode | sans | mono | accent |
|----|-----|------|------|------|--------|
| 1a | Graphite & Amber | dark | IBM Plex Sans | IBM Plex Mono | ambre `oklch(0.78 0.15 75)` |
| 1b | Carbon & Cyan | dark | Space Grotesk | JetBrains Mono | cyan `oklch(0.80 0.13 195)` |
| 1c | Paper & Rust | light | Instrument Sans | IBM Plex Mono | rouille `oklch(0.55 0.15 40)` |
| 1d | Bone & Forest | light | Manrope | Roboto Mono | vert `oklch(0.52 0.11 155)` |
| 2a | Obsidian & Electric Violet | dark | Sora | Space Mono | violet `oklch(0.62 0.20 305)` |
| 2b | Charcoal & Signal Red | dark | Archivo | DM Mono | rouge `oklch(0.58 0.22 27)` |

---

## 1. Polices — qui sert où

Deux familles par thème : `--font-sans` (interface) et `--font-mono` (données techniques).
La règle est identique pour les 6 thèmes.

### `--font-mono` (tout ce qui est machine / donnée)

| élément | taille | poids | couleur |
|---|---|---|---|
| champ URL (`youtube.com/playlist?…`) | 13px (12px en 2a) | 400 | `--text` |
| ligne de version de la bannière (`Installed … latest …`) | 12px | 400 | `--accent` |
| badge version `v2.0.0` | 11px | 400 | `--text-dim` |
| labels de section `FORMAT`, `OUTPUT FOLDER`, `PREVIEW` | 10px, `letter-spacing: 1.6px`, uppercase | 400 | `--text-faint` |
| sous-titres de format (`WAV · 44.1 kHz`, `MP4 · up to 4K`) | 11px | 400 | `--text-dim` |
| segmented qualité (`WAV · Lossless` / `MP3 · 320 kbps`) | 12px | 400/500 | `--text` / `--text-dim` |
| note désactivée (`Trimming is unavailable…`) | 12px | 400 | `--text-dim` |
| chemin du dossier de sortie | 12px | 400 | `--text` (légèrement atténué) |
| méta playlist (`8 tracks · 12h 38min`) | 12px | 400 | `--text-dim` |
| numéro de piste (`01`…`08`) | 11px | 400 | `--text-faint` |
| durée de piste (`1:46:18`) | 12px | 400 | `--text-dim` |
| barre de résumé (`6 of 8 selected · 9h 38min`) | 12px | 400 | `--text-dim` |
| taille estimée (`~5.8 GB WAV`) | 12px | 400 | `--accent` |
| statut + pourcentage (`Idle — ready to download`, `0.0%`) | 11px | 400 | `--text-faint` |

### `--font-sans` (tout le reste)

| élément | taille | poids |
|---|---|---|
| titre app `EvroHQ YouTube Downloader` | 16px, `letter-spacing: -0.3px` | 700 (600 en 2a, 800 en 1d) |
| sous-titre app | 12px | 400 |
| titre bannière `yt-dlp update available` | 14px | 600 (800 en 1d) |
| titre playlist `Shimza — Best Live Sets 2026` | 16px, `letter-spacing: -0.3px` | 700 |
| titres de piste | 13px | 500 (600 en 1d) |
| labels de format `Audio` / `Video` | 13px | 600 |
| libellé toggle `Embed metadata & cover art` | 13px | 400 |
| boutons (`Update now`, `Change`, `Select all`, `Playlist`…) | 12–13px | 500–600 |
| bouton principal `Download all (6 tracks)` | 15px | 700 |
| liens discrets (`Later`), footer (`made by @EvroHQ`) | 12–13px | 400 |

### Imports

```html
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Space+Grotesk:wght@400;500;700&family=JetBrains+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;800&family=Roboto+Mono:wght@400;500&family=Sora:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Archivo:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap">
```

---

## 2. Rôles des tokens

| token | usage |
|---|---|
| `--bg` | fond de la fenêtre |
| `--surface` | bannière update, champ URL, ligne toggle, en-tête |
| `--sunken` | segmented, note désactivée, champ dossier, carte format non sélectionnée |
| `--panel` | panneau Preview (droite) |
| `--panel-footer` | barre de résumé en bas du panneau Preview |
| `--footer` | barre `made by @EvroHQ` |
| `--border` | bordures par défaut (1px) |
| `--border-strong` | bordures de cases à cocher vides, petits carrés |
| `--control` | boutons secondaires pleins (`Change`, `Select all`, onglet actif du segmented) |
| `--control-alt` | boutons tertiaires (`Deselect all`), fond du segmented |
| `--text` | texte principal |
| `--text-dim` | texte secondaire |
| `--text-faint` | labels de section, numéros, statut |
| `--accent` | bouton principal, toggle actif, cases cochées, onglet Playlist, bordure gauche de la bannière, `~5.8 GB WAV` |
| `--on-accent` | texte/icône posé sur `--accent` |
| `--accent-surface` | fond de la carte format sélectionnée (bordure = `--accent`, 1.5px) |

Géométrie commune aux 6 thèmes : rayons 6px (badges) / 7–8px (boutons) / 10px (champs, cartes) /
12px (panneau) / 14px (fenêtre) ; grille `462px 1fr`, gap 22px, padding 20px ; ombre de fenêtre
`0 24px 60px rgba(0,0,0,.28)` (0.16 pour les thèmes clairs).

---

## 3. Les 6 thèmes en CSS

```css
:root { --font-sans: 'IBM Plex Sans', sans-serif; --font-mono: 'IBM Plex Mono', monospace; }

/* 1a — Graphite & Amber (dark, gris chaud) */
[data-theme="graphite-amber"] {
  --font-sans: 'IBM Plex Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --bg: oklch(0.19 0.006 80);
  --surface: oklch(0.23 0.006 80);
  --sunken: oklch(0.21 0.006 80);
  --panel: oklch(0.22 0.006 80);
  --panel-footer: oklch(0.24 0.006 80);
  --footer: oklch(0.16 0.006 80);
  --border: oklch(0.28 0.008 80);
  --border-strong: oklch(0.34 0.008 80);
  --control: oklch(0.30 0.008 80);
  --control-alt: oklch(0.26 0.008 80);
  --text: oklch(0.95 0.006 80);
  --text-dim: oklch(0.66 0.006 80);
  --text-faint: oklch(0.60 0.006 80);
  --accent: oklch(0.78 0.15 75);
  --on-accent: oklch(0.22 0.05 75);
  --accent-surface: oklch(0.24 0.010 80);
}

/* 1b — Carbon & Cyan (dark, gris neutre) */
[data-theme="carbon-cyan"] {
  --font-sans: 'Space Grotesk', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --bg: oklch(0.18 0.004 265);
  --surface: oklch(0.22 0.004 265);
  --sunken: oklch(0.20 0.004 265);
  --panel: oklch(0.21 0.004 265);
  --panel-footer: oklch(0.23 0.004 265);
  --footer: oklch(0.15 0.004 265);
  --border: oklch(0.27 0.004 265);
  --border-strong: oklch(0.34 0.004 265);
  --control: oklch(0.29 0.004 265);
  --control-alt: oklch(0.25 0.004 265);
  --text: oklch(0.96 0.004 265);
  --text-dim: oklch(0.66 0.004 265);
  --text-faint: oklch(0.60 0.004 265);
  --accent: oklch(0.80 0.13 195);
  --on-accent: oklch(0.20 0.04 200);
  --accent-surface: oklch(0.235 0.022 215);
}

/* 1c — Paper & Rust (light, papier chaud) */
[data-theme="paper-rust"] {
  --font-sans: 'Instrument Sans', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --bg: oklch(0.95 0.010 85);
  --surface: oklch(0.99 0.004 85);
  --sunken: oklch(0.93 0.012 85);
  --panel: oklch(0.98 0.005 85);
  --panel-footer: oklch(0.94 0.010 85);
  --footer: oklch(0.92 0.012 85);
  --border: oklch(0.87 0.015 85);
  --border-strong: oklch(0.80 0.015 85);
  --control: oklch(0.93 0.012 85);
  --control-alt: oklch(0.96 0.008 85);
  --text: oklch(0.25 0.02 60);
  --text-dim: oklch(0.52 0.02 60);
  --text-faint: oklch(0.58 0.02 60);
  --accent: oklch(0.55 0.15 40);
  --on-accent: oklch(0.99 0.01 60);
  --accent-surface: oklch(0.97 0.015 60);
}

/* 1d — Bone & Forest (light, gris froid) */
[data-theme="bone-forest"] {
  --font-sans: 'Manrope', sans-serif;
  --font-mono: 'Roboto Mono', monospace;
  --bg: oklch(0.94 0.005 200);
  --surface: oklch(0.99 0.003 200);
  --sunken: oklch(0.92 0.006 200);
  --panel: oklch(0.985 0.003 200);
  --panel-footer: oklch(0.94 0.006 200);
  --footer: oklch(0.91 0.006 200);
  --border: oklch(0.86 0.008 200);
  --border-strong: oklch(0.80 0.008 200);
  --control: oklch(0.92 0.006 200);
  --control-alt: oklch(0.96 0.004 200);
  --text: oklch(0.24 0.012 200);
  --text-dim: oklch(0.53 0.012 200);
  --text-faint: oklch(0.58 0.012 200);
  --accent: oklch(0.52 0.11 155);
  --on-accent: oklch(0.99 0.005 155);
  --accent-surface: oklch(0.96 0.015 160);
}

/* 2a — Obsidian & Electric Violet (dark, noir violacé) */
[data-theme="obsidian-violet"] {
  --font-sans: 'Sora', sans-serif;
  --font-mono: 'Space Mono', monospace;
  --bg: oklch(0.155 0.012 300);
  --surface: oklch(0.19 0.014 300);
  --sunken: oklch(0.18 0.012 300);
  --panel: oklch(0.185 0.013 300);
  --panel-footer: oklch(0.21 0.014 300);
  --footer: oklch(0.125 0.012 300);
  --border: oklch(0.25 0.016 300);
  --border-strong: oklch(0.33 0.016 300);
  --control: oklch(0.27 0.016 300);
  --control-alt: oklch(0.23 0.016 300);
  --text: oklch(0.96 0.005 300);
  --text-dim: oklch(0.66 0.010 300);
  --text-faint: oklch(0.60 0.010 300);
  --accent: oklch(0.62 0.20 305);
  --on-accent: oklch(0.99 0.01 305);
  --accent-quiet: oklch(0.72 0.16 305); /* texte accent sur fond sombre (bannière) */
  --accent-surface: oklch(0.22 0.03 305);
}

/* 2b — Charcoal & Signal Red (dark, gris neutre chaud) */
[data-theme="charcoal-red"] {
  --font-sans: 'Archivo', sans-serif;
  --font-mono: 'DM Mono', monospace;
  --bg: oklch(0.16 0.006 20);
  --surface: oklch(0.20 0.008 20);
  --sunken: oklch(0.18 0.006 20);
  --panel: oklch(0.19 0.007 20);
  --panel-footer: oklch(0.21 0.008 20);
  --footer: oklch(0.125 0.006 20);
  --border: oklch(0.25 0.008 20);
  --border-strong: oklch(0.32 0.008 20);
  --control: oklch(0.27 0.008 20);
  --control-alt: oklch(0.23 0.008 20);
  --text: oklch(0.95 0.004 20);
  --text-dim: oklch(0.66 0.006 20);
  --text-faint: oklch(0.60 0.006 20);
  --accent: oklch(0.58 0.22 27);
  --on-accent: oklch(0.99 0.015 27);
  --accent-surface: oklch(0.24 0.045 25);
}
```

## 4. Notes d'implémentation

- Sur les thèmes sombres, le texte accent en petit corps (ligne de version de la bannière) utilise
  `--accent` sauf en 2a où le violet plein manque de contraste : utiliser `--accent-quiet`.
- Pistes non sélectionnées : `opacity: 0.45` sur toute la ligne (pas de couleur dédiée).
- Case cochée = fond `--accent` + `✓` en `--on-accent` ; case vide = `1.5px solid --border-strong`.
- Toggle actif : piste `--accent`, pastille `oklch(0.99 …)` — sauf 2b où l'accent est foncé,
  la pastille reste blanche.
- Vignettes/placeholders : `repeating-linear-gradient(45deg, --control 0 6px, --control-alt 6px 12px)`.
- En 2a, Space Mono est large : réduire le champ URL à 12px + `white-space:nowrap; overflow:hidden; text-overflow:ellipsis`.
