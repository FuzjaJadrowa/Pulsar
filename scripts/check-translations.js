import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'assets', 'locales.toml');
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const tables = new Map();
const missing = new Map();
let currentTable = null;
const errors = [];

for (const [index, rawLine] of lines.entries()) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const tableMatch = line.match(/^\[([\w.-]+)\]$/);
  if (tableMatch) {
    currentTable = tableMatch[1];
    if (tables.has(currentTable)) errors.push(`Line ${index + 1}: duplicate table [${currentTable}]`);
    tables.set(currentTable, new Map());
    continue;
  }
  const entryMatch = line.match(/^([\w-]+)\s*=\s*("(?:\\.|[^"\\])*")\s*$/);
  if (!currentTable || !entryMatch) {
    errors.push(`Line ${index + 1}: invalid TOML entry: ${rawLine}`);
    continue;
  }
  try {
    const values = tables.get(currentTable);
    if (values.has(entryMatch[1])) errors.push(`Line ${index + 1}: duplicate language '${entryMatch[1]}' in [${currentTable}]`);
    values.set(entryMatch[1], JSON.parse(entryMatch[2]));
  } catch {
    errors.push(`Line ${index + 1}: invalid string value in [${currentTable}]`);
  }
}

const languageTable = tables.get('language.name');
if (!languageTable?.has('en')) errors.push('Missing English language name in [language.name]');
const languages = [...(languageTable?.keys() || [])];
if (!languages.length) errors.push('No languages found in [language.name]');

for (const [key, values] of tables) {
  if (key === 'language.name') continue;
  for (const locale of languages) {
    if (!values.has(locale)) {
      const list = missing.get(locale) || [];
      list.push(key);
      missing.set(locale, list);
    }
  }
  for (const locale of values.keys()) {
    if (!languages.includes(locale)) errors.push(`[${key}] uses '${locale}', which is not declared in [language.name]`);
  }
}

if (errors.length) console.error(errors.join('\n'));
for (const [locale, keys] of missing) {
  console.error(`\nMissing translations for ${languageTable.get(locale)} (${locale}):`);
  for (const key of keys) console.error(`  - ${key}`);
}

if (errors.length || missing.size) process.exit(1);
console.log(`All ${languages.length} languages have translations for every key in ${path.relative(root, file)}.`);