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

if (!fs.existsSync(updateJsonPath)) {
    console.error('update.json not found');
    process.exit(1);
}

let updateData = JSON.parse(fs.readFileSync(updateJsonPath, 'utf8'));
updateData.version = version;
updateData.pub_date = new Date().toISOString();

Object.keys(sigFiles).forEach(platform => {
    const sigPath = path.join(rootDir, 'sigs', sigFiles[platform]);
    if (fs.existsSync(sigPath)) {
        const signature = fs.readFileSync(sigPath, 'utf8').trim();
        const decodedSignature = decodeSignatureText(signature);
        const expectedHint = expectedSignatureFileHint(platform, version);
        if (!decodedSignature || (expectedHint && !decodedSignature.includes(expectedHint))) {
            console.warn(`Skipping ${platform} signature update: signature payload does not match expected file hint (${expectedHint}).`);
            return;
        }
        if (updateData.platforms[platform]) {
            updateData.platforms[platform].signature = signature;
            const baseUrl = `https://github.com/FuzjaJadrowa/Pulsar/releases/download/v${version}`;
            const fileName = platform === 'windows-x86_64' ? `Pulsar-${version}-win64.exe` :
                `Pulsar-${version}-MacOS.app.tar.gz`;
            updateData.platforms[platform].url = `${baseUrl}/${fileName}`;
        }
    }
});

fs.writeFileSync(updateJsonPath, JSON.stringify(updateData, null, 2));
console.log('update.json updated with signatures!');