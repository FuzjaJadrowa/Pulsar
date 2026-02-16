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
const updateJsonPath = path.join(rootDir, 'update.json');

console.log(`Updating version to: ${newVersion}...`);

filesToUpdate.forEach(file => {
    if (fs.existsSync(file.path)) {
        let content = fs.readFileSync(file.path, 'utf8');

        if (file.type === 'json') {
            const regex = /("version"\s*:\s*)"[^"]+"/;
            if (regex.test(content)) {
                content = content.replace(regex, `$1"${newVersion}"`);
            }
        } else if (file.type === 'toml') {
            const regex = /^version\s*=\s*".*"/m;
            if (regex.test(content)) {
                content = content.replace(regex, `version = "${newVersion}"`);
            }
        }

        fs.writeFileSync(file.path, content);
        console.log(`Updated: ${path.relative(rootDir, file.path)}`);
    } else {
        console.warn(`File not found: ${file.path}`);
    }
});

updateUpdateJson(newVersion);
console.log('Updated!');

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function bumpVersionInUrl(url, oldVersion, nextVersion) {
    if (!url || typeof url !== 'string') return url;
    let updated = url;

    if (oldVersion) {
        const withVOld = `v${oldVersion}`;
        const withVNew = `v${nextVersion}`;
        updated = updated.replace(new RegExp(escapeRegExp(withVOld), 'g'), withVNew);
        updated = updated.replace(new RegExp(escapeRegExp(oldVersion), 'g'), nextVersion);
    }

    return updated;
}

function updateUpdateJson(nextVersion) {
    if (!fs.existsSync(updateJsonPath)) {
        console.warn(`File not found: ${path.relative(rootDir, updateJsonPath)}`);
        return;
    }

    let data;
    try {
        data = JSON.parse(fs.readFileSync(updateJsonPath, 'utf8'));
    } catch (err) {
        console.error('Failed to parse update.json', err);
        return;
    }

    const previousVersion = data.version || '';
    data.version = nextVersion;
    data.pub_date = new Date().toISOString();

    if (data.platforms && typeof data.platforms === 'object') {
        Object.keys(data.platforms).forEach(platform => {
            const entry = data.platforms[platform];
            if (!entry || typeof entry !== 'object') return;
            if (entry.url) {
                entry.url = bumpVersionInUrl(entry.url, previousVersion, nextVersion);
            }
            if (previousVersion !== nextVersion && typeof entry.signature === 'string') {
                entry.signature = '';
            }
        });
    }

    fs.writeFileSync(updateJsonPath, JSON.stringify(data, null, 2));
    console.log(`Updated: ${path.relative(rootDir, updateJsonPath)}`);
}