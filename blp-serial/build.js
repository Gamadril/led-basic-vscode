const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const {
    exec
} = require('child_process');

const ARCH_64 = "x64";
const TARGET = "9.2.1";

rimraf.sync('build');
runNodeGyp(TARGET, ARCH_64)
    .then((res) => {
        console.log('Built native module for', res.arch);
        let out_path = path.join('lib', 'bindings', 'native', 'blp-serial_' + process.platform + '_' + TARGET + '_' + res.arch + '.node');
        fs.renameSync(res.path, out_path);
        console.log('Generated', out_path);
        return Promise.resolve();
    })

function runNodeGyp(target, arch) {
    return new Promise((resolve, reject) => {
        let gyp = path.join('node_modules', '.bin', 'node-gyp');
        exec(gyp + ' rebuild --target=' + target + ' --arch=' + arch + ' --dist-url=https://atom.io/download/electron', (err, stdout, stderr) => {
            if (err) {
                reject(err);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
            resolve({
                'path': path.join(__dirname, 'build', 'Release', 'blp-serial.node'),
                'arch': arch
            });
        });
    })
}