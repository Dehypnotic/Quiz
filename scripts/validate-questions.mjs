import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_DIR = path.resolve(__dirname, '../src/data/questions');
const sealMode = process.argv.includes('--seal');

function encodeToken(id, correctIndex) {
  return Buffer.from(`${id}:${correctIndex}`, 'utf8').toString('base64');
}

function decodeToken(token, expectedId) {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const sep = decoded.lastIndexOf(':');
    if (sep === -1) return null;
    const id = decoded.slice(0, sep);
    const idx = Number(decoded.slice(sep + 1));
    if (id !== expectedId || !Number.isInteger(idx) || idx < 0 || idx > 3) {
      return null;
    }
    return idx;
  } catch {
    return null;
  }
}

const files = fs
  .readdirSync(QUESTIONS_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error('Feil: Fant ingen .json-filer i src/data/questions/.');
  process.exit(1);
}

const seenIds = new Set();
const categoryStats = new Map();
let totalQuestions = 0;
let totalSealed = 0;
let errors = 0;

for (const file of files) {
  const filePath = path.join(QUESTIONS_DIR, file);
  const items = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (!Array.isArray(items)) {
    console.error(`${file}: Må være en JSON-liste.`);
    errors++;
    continue;
  }

  let fileSealed = 0;
  const updatedItems = items.map((item, i) => {
    const prefix = `${file} #${i + 1}`;
    if (!item || typeof item !== 'object') {
      console.error(`${prefix}: Ugyldig objekt.`);
      errors++;
      return item;
    }
    if (typeof item.id !== 'string' || !item.id.trim()) {
      console.error(`${prefix}: Mangler gyldig "id".`);
      errors++;
    } else if (seenIds.has(item.id)) {
      console.error(`${prefix}: Duplikat id "${item.id}".`);
      errors++;
    } else {
      seenIds.add(item.id);
    }

    if (typeof item.category !== 'string' || !item.category.trim()) {
      console.error(`${prefix}: Mangler "category".`);
      errors++;
    }
    if (typeof item.subcategory !== 'string' || !item.subcategory.trim()) {
      console.error(`${prefix}: Mangler "subcategory".`);
      errors++;
    }
    if (typeof item.question !== 'string' || !item.question.trim()) {
      console.error(`${prefix}: Mangler "question".`);
      errors++;
    }
    if (!Array.isArray(item.options) || item.options.length !== 4) {
      console.error(`${prefix}: "options" må ha nøyaktig 4 alternativer.`);
      errors++;
    } else {
      const trimmed = item.options.map((o) => (typeof o === 'string' ? o.trim() : ''));
      if (trimmed.some((o) => !o) || new Set(trimmed).size !== 4) {
        console.error(`${prefix}: Alle 4 svaralternativer må være unike og ikke-tomme.`);
        errors++;
      }
    }

    const nextItem = { ...item };
    if (sealMode && typeof item.correctIndex === 'number') {
      if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3) {
        console.error(`${prefix}: Ugyldig "correctIndex" (må være 0-3).`);
        errors++;
      } else {
        nextItem.answerToken = encodeToken(item.id, item.correctIndex);
        delete nextItem.correctIndex;
        fileSealed++;
        totalSealed++;
      }
    } else if (
      typeof item.answerToken !== 'string' ||
      decodeToken(item.answerToken, item.id) === null
    ) {
      console.error(
        `${prefix}: Mangler gyldig "answerToken" (kjør npm run seal-questions hvis du la inn correctIndex).`
      );
      errors++;
    }

    if (typeof item.category === 'string' && item.category.trim()) {
      const cat = item.category.trim();
      const sub =
        typeof item.subcategory === 'string' && item.subcategory.trim()
          ? item.subcategory.trim()
          : 'Generelt';
      if (!categoryStats.has(cat)) categoryStats.set(cat, new Map());
      const subMap = categoryStats.get(cat);
      subMap.set(sub, (subMap.get(sub) ?? 0) + 1);
    }

    totalQuestions++;
    return nextItem;
  });

  if (sealMode && fileSealed > 0 && errors === 0) {
    fs.writeFileSync(filePath, JSON.stringify(updatedItems, null, 2) + '\n', 'utf8');
  }
}

if (errors > 0) {
  console.error(`\nValidering feilet med ${errors} feil.`);
  process.exit(1);
}

if (sealMode && totalSealed > 0) {
  console.log(`Forseglet ${totalSealed} spørsmål uten å vise fasit.`);
}

console.log(`OK! Totalt ${totalQuestions} gyldige spørsmål i ${categoryStats.size} hovedkategorier:`);
for (const [cat, subMap] of [...categoryStats.entries()].sort((a, b) =>
  a[0].localeCompare(b[0], 'nb')
)) {
  const catTotal = [...subMap.values()].reduce((s, n) => s + n, 0);
  console.log(`  - ${cat} (${catTotal}):`);
  for (const [sub, count] of [...subMap.entries()].sort((a, b) =>
    a[0].localeCompare(b[0], 'nb')
  )) {
    console.log(`      • ${sub}: ${count}`);
  }
}
