# Product prices from screencapture `C:\Users\email\Downloads\screencapture-office-threeinternational-shopping-products-2026-07-30-07_26_46.pdf`

OCR source: `docs/three-product-screenshot-docling.txt` plus `easyocr` read.
Capture dataset used for ingest:
- [D:\momentum-creation-system-v2\docs\three-shopping-product-capture-2026-07-30-ocr.json](/D:/momentum-creation-system-v2/docs/three-shopping-product-capture-2026-07-30-ocr.json)
- [D:\THREE\products\three-shopping-product-capture-2026-07-30-ocr.json](/D:/THREE/products/three-shopping-product-capture-2026-07-30-ocr.json)

Confidence is mixed. GLP pack values are strongest; all other products are captured as low-confidence OCR artifacts for later verification.

## GLP THREE packs (screenshot values)

| Pack | Price (USD) | PV | Source confidence |
|---|---:|---:|---|
| GLP THREE 4 Pack | $259.00 (note: separate product page checks showed either $259 or $289) | 130 PV | low |
| GLP THREE 8 Pack | $509.00 | 250 PV | medium |
| GLP THREE 12 Pack | $759.00 | 380 PV | medium |
| GLP THREE 16 Pack | $999.00 | 500 PV | medium |

## Simple Six (screenshot values)

| Pack | Price (USD) | PV | Source confidence |
|---|---:|---:|---|
| Simple Six Starter | $525.00 | 100 PV | low |
| Simple Six Boost | $5399.00 | 170 PV | low |
| Simple Six Elite | $5699.00 | 350 PV | low |
| Simple Six Ultimate | $5999.00 | 900 PV | low |

## Other items captured on screenshot (low-confidence OCR)

- Kynetik Premium / Kynetik Starter / Kynetik Clean Caffeine Berry: prices were not reliably parsed
- Visage and skin/skincare line (Super Serum, Creme Caviar, Radiant Toner, etc.): OCR values were noisy and should be rechecked from official docs
- Revive / Purifi / Imune / Love Three Donation: OCR values were noisy and should be rechecked from official docs

## Why this matters for bonuses

Using the existing compensation formula (from the current training material in app), these GLP PV anchors can be used directly in the known PIB logic.
Formula currently used in this guide:

- 20–199 PV: 25%
- 200–299 PV: 28%
- 300+ PV: 33%

Estimated PIB from this capture:

| Pack | PV | Estimated PIB |
|---|---:|---:|
| GLP THREE 4 Pack | 130 | $36.40 |
| GLP THREE 8 Pack | 250 | $82.50 |
| GLP THREE 12 Pack | 380 | $125.40 |
| GLP THREE 16 Pack | 500 | $165.00 |

Use this as the source of truth for this capture only; verify in source docs before publishing any agent-facing compensation examples.
