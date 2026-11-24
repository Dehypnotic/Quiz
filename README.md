# SelskapsQuiz

En mobilvennlig, norsk selskapsquiz uten ekstern serverlagring. Vertens mobil fungerer som spillserver via WebRTC (PeerJS), og gjester blir med via QR-kode eller romkode.

## Kom i gang

```bash
npm install
npm run dev
```

For å teste på flere mobiler i samme rom kan du enten kjøre `npm run dev -- --host` på lokalnettet, eller publisere statisk bygg (`npm run build` -> `dist/`) til f.eks. GitHub Pages eller Netlify.

## Slik legger en LLM til nye spørsmål uten å avsløre fasit

Spørsmålene ligger fordelt på én fil per hovedkategori i `src/data/questions/*.json` (f.eks. `musikk.json`, `historie.json`). Hvert spørsmål har `id`, `category`, `subcategory`, `question`, `options` (4 alternativer) og et forseglet `answerToken`-felt (Base64-kodet `<id>:<correctIndex>`), slik at riktig svar ikke står i klartekst.

Når du ber en LLM legge til nye spørsmål:
1. Be LLM-en legge til nye objekter i ønsket fil i `src/data/questions/` med `id`, `category`, `subcategory`, `question`, `options` (4 alternativer) og `correctIndex` (0–3).
2. Kjør kommandoen under **uten** å åpne filen:
   ```bash
   npm run seal-questions
   ```
3. Skriptet konverterer `correctIndex` til `answerToken` og validerer alle filene, og skriver kun ut antall spørsmål per hovedkategori og underkategori (aldri spørsmålstekst eller fasit).
