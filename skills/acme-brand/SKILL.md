---
name: Acme Insurance Brand
description: Brand guidelines for Acme Insurance dashboards and reports. Use when styling any Acme deliverable.
---

# Acme Insurance — brand guidelines

Mothership reads this file to theme a dashboard. It understands:

1. a fenced `json` block with `colors`, `palette` and `fonts` (most precise, used first if present), or
2. plain lines such as "Primary: #0B3D91" and "Heading font: Montserrat".

## Colours

| Role        | Hex       | Use                                   |
|-------------|-----------|---------------------------------------|
| Primary     | #0B3D91   | Ribbon, links, key highlights         |
| Secondary   | #F2A900   | Secondary highlights                  |
| Accent      | #00A19A   | Call-outs, positive change            |
| Background  | #F7F8FA   | Page background                       |
| Surface     | #FFFFFF   | Cards                                 |
| Text        | #1A1F36   | Body text                             |
| Muted       | #5B6475   | Captions, axis labels                 |
| Border      | #E1E4EA   | Dividers, card borders                |

Chart palette (use in this order): #0B3D91, #F2A900, #00A19A, #E4572E, #76B041, #7E57C2

## Typography

- Heading font: Montserrat
- Body font: Open Sans

## Writing charts

Every chart has a **title** (what), a **subtitle** (units, period, source) and an **inference** (the "so what" in one sentence).

```json
{
  "name": "Acme Insurance",
  "colors": {
    "primary": "#0B3D91", "secondary": "#F2A900", "accent": "#00A19A",
    "background": "#F7F8FA", "surface": "#FFFFFF", "text": "#1A1F36",
    "muted": "#5B6475", "border": "#E1E4EA"
  },
  "palette": ["#0B3D91", "#F2A900", "#00A19A", "#E4572E", "#76B041", "#7E57C2"],
  "fonts": {
    "heading": "Montserrat, \"Segoe UI\", Arial, sans-serif",
    "body": "\"Open Sans\", \"Segoe UI\", Arial, sans-serif"
  }
}
```

To ship the real font files with the brand, zip this folder with a `fonts/` sub-folder of `.woff2` files and rename the zip to `acme-brand.skill`. Mothership embeds them, so they work offline.
