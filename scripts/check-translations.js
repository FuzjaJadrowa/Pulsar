import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const langsDir = path.join(rootDir, 'public', 'assets', 'langs');

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys = keys.concat(getKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
  }
  return keys;
}

if (!fs.existsSync(langsDir)) {
  console.error(`Translations directory does not exist: ${langsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(langsDir).filter(file => file.endsWith('.json'));

if (files.length === 0) {
  console.error(`No JSON translation files found in ${langsDir}`);
  process.exit(1);
}

let hasErrors = false;
const langKeysMap = new Map();

for (const file of files) {
  const filePath = path.join(langsDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    const json = JSON.parse(content);
    const keys = new Set(getKeys(json));
    langKeysMap.set(file, keys);
  } catch (err) {
    console.error(`Error reading or parsing ${file}: ${err.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

const referenceFile = files.includes('en.json') ? 'en.json' : files[0];
const referenceKeys = langKeysMap.get(referenceFile);

for (const file of files) {
  if (file === referenceFile) continue;

  const currentKeys = langKeysMap.get(file);

  for (const key of referenceKeys) {
    if (!currentKeys.has(key)) {
      console.error(`Missing translation key in ${file}: "${key}" (present in ${referenceFile})`);
      hasErrors = true;
    }
  }

  for (const key of currentKeys) {
    if (!referenceKeys.has(key)) {
      console.error(`Extra translation key in ${file}: "${key}" (not in ${referenceFile})`);
      hasErrors = true;
    }
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log(`Translation keys check passed successfully for ${files.length} language file(s): ${files.join(', ')}!`);