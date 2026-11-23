import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUESTIONS_PATH = path.resolve(__dirname, '../src/data/questions.json');
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

const raw = fs.readFileSync(QUESTIONS_PATH, 'utf8');
const items = JSON.parse(raw);

if (!Array.isArray(items)) {
  console.error('Feil: questions.json må være en JSON-liste.');
  process.exit(1);
}

const seenIds = new Set();
const categoryCounts = new Map();
let sealedCount = 0;
let errors = 0;

const updatedItems = items.map((item, i) => {
  const prefix = `Spørsmål #${i + 1}`;
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

  let nextItem = { ...item };

  if (sealMode && typeof item.correctIndex === 'number') {
    if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex > 3) {
      console.error(`${prefix}: Ugyldig "correctIndex" (må være 0-3).`);
      errors++;
    } else {
      nextItem.answerToken = encodeToken(item.id, item.correctIndex);
      delete nextItem.correctIndex;
      sealedCount++;
    }
  } else if (typeof item.answerToken !== 'string' || decodeToken(item.answerToken, item.id) === null) {
    console.error(`${prefix}: Mangler gyldig "answerToken" (kjør npm run seal-questions hvis du la inn correctIndex).`);
    errors++;
  }

  if (typeof item.category === 'string' && item.category.trim()) {
    const cat = item.category.trim();
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1);
  }

  return nextItem;
});

if (errors > 0) {
  console.error(`\nValidering feilet med ${errors} feil.`);
  process.exit(1);
}

if (sealMode && sealedCount > 0) {
  fs.writeFileSync(QUESTIONS_PATH, JSON.stringify(updatedItems, null, 2) + '\n', 'utf8');
  console.log(`Forseglet ${sealedCount} spørsmål uten å vise fasit.`);
}

console.log(`OK! Totalt ${items.length} gyldige spørsmål fordelt på ${categoryCounts.size} kategorier:`);
for (const [cat, count] of [...categoryCounts.entries()].sort((a, b) => a[0].localeCompare(b[0], 'nb'))) {
  console.log(`  - ${cat}: ${count}`);
}
