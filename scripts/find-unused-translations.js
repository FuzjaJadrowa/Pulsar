import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '..');
const langsDir = path.join(rootDir, 'public', 'assets', 'langs');
const srcDir = path.join(rootDir, 'src');

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

function getAllFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath));
    } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx') || filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
      results.push(filePath);
    }
  });
  return results;
}

const srcFiles = getAllFiles(srcDir);
const fileContents = srcFiles.map(f => ({ file: path.relative(rootDir, f), text: fs.readFileSync(f, 'utf8') }));
const fullSrc = fileContents.map(f => f.text).join('\n');

const enJson = JSON.parse(fs.readFileSync(path.join(langsDir, 'en.json'), 'utf8').replace(/^\uFEFF/, ''));
const allKeys = getKeys(enJson);

const missingExact = allKeys.filter(k => !fullSrc.includes(k));

console.log('Keys missing exact string match in src:', missingExact.length);

missingExact.forEach(key => {
  console.log(`Key: "${key}"`);
});