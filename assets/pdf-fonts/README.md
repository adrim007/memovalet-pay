# PDF fonts

Noto Sans families downloaded from the official Google Fonts repository on 2026-09-11:
https://github.com/google/fonts/tree/main/ofl

Families: Noto Sans, Arabic, Hebrew, Devanagari, Sinhala, Tamil, Thai, SC, JP, KR.
Each bundled font has its corresponding SIL Open Font License alongside it.
These server-only assets are embedded as subsets in exported PDFs; they are not website fonts.

Tests: `node --test tests/pdf-unicode.test.cjs` checks sample glyph coverage in all 21 configured languages and PDF generation. Native-speaker review is still needed for linguistic accuracy and complex mixed-direction content.
