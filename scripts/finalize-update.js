const fs = require('fs');
const path = require('path');

const version = process.env.VERSION;
const rootDir = path.resolve(__dirname, '..');
const updateJsonPath = path.join(rootDir, 'update.json');

const sigFiles = {
    'windows-x86_64': 'Pulsar-win64.sig',
    'darwin-aarch64': 'Pulsar-MacOS.sig'
};

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