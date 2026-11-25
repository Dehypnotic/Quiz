# Stilguide for quizspørsmål

Bruk denne guiden når du ber en LLM generere nye spørsmål i `src/data/questions/*.json`.

## Kvalitetskrav (Allmennkunnskap & Selskapslek)
1. **Nivå:** Allmennkunnskap som passer for et blandet selskap. Unngå obskure årstall, smale faguttrykk eller spørsmål bare én spesialist kan. Det skal være gøy å gjette eller resonnere seg frem til svaret.
2. **Språk:** Naturlig, muntlig norsk bokmål. Korte, tydelige setninger som er lette å lese høyt for oppleseren.
3. **Alternativer:** Nøyaktig 4 unike, troverdige alternativer i samme kategori (f.eks. 4 land, 4 artister, 4 årstall). Ingen åpenbare tullenavn, og kun én udiskutabel fasit.
4. **Batch-størrelse:** Generer **20–25 spørsmål per underkategori** om gangen for å unngå gjentakelser og synkende kvalitet.
5. **Unngå duplikater:** Sjekk eksisterende `id`-er og spørsmål i samme fil før du legger til nye.

## JSON-format for nye spørsmål
Legg til objekter med `correctIndex` (0–3), og kjør `npm run seal-questions` etterpå (da forsegles svaret i `answerToken`, og dagens `addedAt`-dato legges på automatisk uten å avsløre fasiten):

```json
{
  "id": "mus-80-3",
  "category": "Musikk",
  "subcategory": "80-tallshits",
  "question": "Hvem sang «Purple Rain» i 1984?",
  "options": ["Michael Jackson", "Prince", "George Michael", "Bono"],
  "correctIndex": 1
}
```
