const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];

if (!newVersion) {
    console.error('Give version!');
    process.exit(1);
}

const rootDir = path.resolve(__dirname, '..');
const filesToUpdate = [
    { path: path.join(rootDir, 'package.json'), type: 'json' },
    { path: path.join(rootDir, 'src-tauri/tauri.conf.json'), type: 'json' },
    { path: path.join(rootDir, 'src-tauri/Cargo.toml'), type: 'toml' }
];

console.log(`Updating version to: ${newVersion}...`);

filesToUpdate.forEach(file => {
    if (fs.existsSync(file.path)) {
        let content = fs.readFileSync(file.path, 'utf8');

        if (file.type === 'json') {
            const regex = /("version"\s*:\s*)"[^"]+"/;
            if (regex.test(content)) {
                content = content.replace(regex, `$1"${newVersion}"`);
                updated = true;
            }
        } else if (file.type === 'toml') {
            const regex = /^version\s*=\s*".*"/m;
            if (regex.test(content)) {
                content = content.replace(regex, `version = "${newVersion}"`);
                updated = true;
            }
        }

        fs.writeFileSync(file.path, content);
        console.log(`Updated: ${path.relative(rootDir, file.path)}`);
    } else {
        console.warn(`File not found: ${file.path}`);
    }
});

console.log('Updated!');