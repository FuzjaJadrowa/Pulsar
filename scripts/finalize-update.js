import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const version = process.env.VERSION;
const rootDir = path.resolve(__dirname, '..');
const updateJsonPath = path.join(rootDir, 'update.json');

const sigFiles = {
    'windows-x86_64': 'Pulsar-win64.sig',
    'darwin-aarch64': 'Pulsar-MacOS.sig'
};

function decodeSignatureText(signature) {
    try {
        return Buffer.from(signature, 'base64').toString('utf8');
    } catch (_) {
        return '';
    }
}

function expectedSignatureFileHint(platform, currentVersion) {
    if (platform === 'windows-x86_64') {
        return `file:Pulsar_${currentVersion}_x64-setup.exe`;
    }
    if (platform === 'darwin-aarch64') {
        return 'file:Pulsar.app.tar.gz';
    }
    return '';
}

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    console.error('VERSION must be set to a release version such as 3.2.0');
    process.exit(1);
}

if (!fs.existsSync(updateJsonPath)) {
    console.error('update.json not found');
    process.exit(1);
}

const signatures = {};
for (const platform of Object.keys(sigFiles)) {
    const sigPath = path.join(rootDir, 'sigs', sigFiles[platform]);
    if (!fs.existsSync(sigPath)) {
        console.error(`Required signature file not found: ${sigPath}`);
        process.exit(1);
    }

    const signature = fs.readFileSync(sigPath, 'utf8').trim();
    const decodedSignature = decodeSignatureText(signature);
    const expectedHint = expectedSignatureFileHint(platform, version);
    if (!decodedSignature || !decodedSignature.includes(expectedHint)) {
        console.error(`Invalid ${platform} signature: expected signed file hint ${expectedHint}.`);
        process.exit(1);
    }
    signatures[platform] = signature;
}

const updateData = JSON.parse(fs.readFileSync(updateJsonPath, 'utf8'));
const baseUrl = `https://github.com/FuzjaJadrowa/Pulsar/releases/download/v${version}`;
for (const [platform, signature] of Object.entries(signatures)) {
    if (!updateData.platforms[platform]) {
        console.error(`Platform entry not found in update.json: ${platform}`);
        process.exit(1);
    }

    updateData.platforms[platform].signature = signature;
    const fileName = platform === 'windows-x86_64' ? `Pulsar-${version}-win64.exe` :
        `Pulsar-${version}-MacOS.app.tar.gz`;
    updateData.platforms[platform].url = `${baseUrl}/${fileName}`;
}
updateData.version = version;
updateData.pub_date = new Date().toISOString();

fs.writeFileSync(updateJsonPath, JSON.stringify(updateData, null, 2));
console.log(`update.json updated with validated ${version} signatures.`);