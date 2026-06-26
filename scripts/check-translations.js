const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const langsDir = path.join(rootDir, 'src', 'assets', 'langs');

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

const enPath = path.join(langsDir, 'en.json');
const plPath = path.join(langsDir, 'pl.json');

if (!fs.existsSync(enPath) || !fs.existsSync(plPath)) {
  console.error('Translation files en.json and pl.json must exist.');
  process.exit(1);
}

const enContent = fs.readFileSync(enPath, 'utf8').replace(/^\uFEFF/, '');
const plContent = fs.readFileSync(plPath, 'utf8').replace(/^\uFEFF/, '');

const en = JSON.parse(enContent);
const pl = JSON.parse(plContent);

const enKeys = new Set(getKeys(en));
const plKeys = new Set(getKeys(pl));

let hasErrors = false;

// Check for keys in en but not in pl
for (const key of enKeys) {
  if (!plKeys.has(key)) {
    console.error(`Missing translation key in pl.json: "${key}"`);
    hasErrors = true;
  }
}

// Check for keys in pl but not in en
for (const key of plKeys) {
  if (!enKeys.has(key)) {
    console.error(`Missing translation key in en.json: "${key}"`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
}

console.log('Translation keys check passed successfully!');