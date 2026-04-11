const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const mainJsPath = path.join(rootDir, 'src', 'assets', 'scripts', 'main.js');

if (!fs.existsSync(mainJsPath)) {
    console.error(`Missing file: ${path.relative(rootDir, mainJsPath)}`);
    process.exit(1);
}

const source = fs.readFileSync(mainJsPath, 'utf8');
let hasError = false;

function reportError(message) {
    console.error(message);
    hasError = true;
}

const domReadyMatches = source.match(/document\.addEventListener\(\s*['"]DOMContentLoaded['"]/g) || [];
if (domReadyMatches.length !== 1) {
    reportError(
        `Expected exactly 1 DOMContentLoaded handler in src/assets/scripts/main.js, found ${domReadyMatches.length}.`
    );
}

const elementListenerPattern =
    /document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)\?\.\s*addEventListener\(\s*['"]([^'"]+)['"]/g;
const listenerCounts = new Map();
let match;

while ((match = elementListenerPattern.exec(source)) !== null) {
    const key = `${match[1]}::${match[2]}`;
    listenerCounts.set(key, (listenerCounts.get(key) || 0) + 1);
}

const duplicatedBindings = [...listenerCounts.entries()].filter(([, count]) => count > 1);
if (duplicatedBindings.length > 0) {
    reportError('Duplicate DOM event bindings detected in main.js:');
    duplicatedBindings.forEach(([key, count]) => {
        console.error(`- ${key} appears ${count} times`);
    });
}

if (hasError) {
    process.exit(1);
}

console.log('DOM event checks passed.');
