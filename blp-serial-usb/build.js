const fs = require('fs');
const path = require('path');
const http = require('https');
const AdmZip = require('adm-zip');
const rimraf = require('rimraf');
const {
    exec
} = require('child_process');

const ARCH = "x64";
const TARGET = "3.1.2";
const LIB_USB_ZIP = 'https://codeload.github.com/libusb/libusb/zip/v1.0.22';

console.log('Get libusb sources');
if (fs.existsSync('libusb.zip')) {
    fs.unlinkSync('libusb.zip');    
}
rimraf.sync('libusb');
rimraf.sync('build');

getFile(LIB_USB_ZIP)
    .then(file => {
        return extractFile(file, path.join(__dirname, '.'));
    })
    .then((dir) => {
        fs.renameSync(dir, 'libusb');
        return runNodeGyp(TARGET, ARCH);
    })
    .then((res) => {
        console.log('Built native module for', res.arch);
        let out_path = path.join('lib','native','blp-serial-usb_' + process.platform + '_' + TARGET + '_' + res.arch + '.node');
        fs.renameSync(res.path, out_path);
        console.log('Generated', out_path);
    })

function runNodeGyp(target, arch) {
    return new Promise((resolve, reject) => {
        let gyp = path.join('node_modules','.bin','node-gyp');
        exec(gyp + ' rebuild --target=' + target + ' --arch=' + arch + ' --dist-url="https://atom.io/download/electron"', (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            resolve({
                'path': path.join(__dirname, 'build', 'Release', 'blp-serial-usb.node'),
                'arch': arch
            });
        });
    })
}

function getFile(url) {
    return new Promise((resolve, reject) => {
        let fp = path.join(__dirname, 'libusb.zip')
        let file = fs.createWriteStream(fp);
        http.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(() => {
                    resolve(fp);
                });
            });
        });
    });
}

function extractFile(file, dest) {
    return new Promise((resolve, reject) => {
        try {
            var zip = new AdmZip(file);
            zip.extractAllTo(dest, true);
            resolve(path.join(dest, zip.getEntries()[0].entryName));
        } catch (ex) {
            reject(ex);
        }
    });
}