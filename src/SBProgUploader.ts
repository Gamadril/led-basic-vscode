'use strict';
// tslint:disable: no-console no-unused-expression

import { StringDecoder } from 'string_decoder';
import { BaseDeviceUploader, CMD } from './BaseDeviceUploader';

const DEBUG = false;

const PROG_BAUD = 38400;

export class SBProgUploader extends BaseDeviceUploader {
    public reset(): Promise<string> {
        return new Promise((resolve, reject) => {
            const baud = 0x110000 + this.deviceInfo.meta.sysCode;

            let port = this.portFactory.createSerialPort(this.portInfo.name, {
                baudRate: baud + 2
            });

            port.openForUpload(true, true)
                .then(() => port.close())
                .then(() => {
                    DEBUG && console.log('[UPLOAD] reset - SB-Prog done');
                    port = this.portFactory.createSerialPort(this.portInfo.name, {
                        baudRate: baud
                    });
                    return port.openForUpload(true, false);
                })
                .then(() => port.close())
                .then(() => {
                    DEBUG && console.log('[UPLOAD] SB-Prog switched in terminal mode');
                    resolve('');
                })
                .catch(reject);
        });
    }

    public read(timeout?: number): Promise<Uint8Array> {
        timeout = timeout || 200;

        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this.port.read(timeout)
                    .then((response: Uint8Array) => {
                        const dv = new DataView(response.buffer);
                        const requestLength = dv.getUint16(2, true);
                        const data = response.slice(7 + requestLength);
                        resolve(data);
                    })
                    .catch(reject);
            }
        });
    }

    public open(): Promise<void> {
        return new Promise((resolve, reject) => {
            const baud = 0x110000 + this.deviceInfo.meta.sysCode + 2;

            let port = this.portFactory.createSerialPort(this.portInfo.name, {
                baudRate: baud
            });

            port.openForUpload(true, false)
                .then(() => port.close())
                .then(() => {
                    port = this.portFactory.createSerialPort(this.portInfo.name, {
                        baudRate: PROG_BAUD,
                        parity: 'even'
                    });
                    return port.openForUpload(false, true);
                })
                .then(() => {
                    return port.write(new Uint8Array([0x7F]));
                })
                .then(() => {
                    return port.read();
                })
                .then((response: Uint8Array) => {
                    if (response.length < 2) {
                        throw new Error('There is no connected device to SB-PROG');
                    }
                    const packet = {
                        cmd: CMD.CMD_BOOT_INF0,
                        data: new Uint8Array([])
                    };
                    this.port = port;
                    return this.sendPacket(packet);
                })
                .then((response: Uint8Array) => {
                    // String.fromCharCode.apply(null, response.slice(0, 4));
                    const sysCode = new StringDecoder('utf8').write(Buffer.from(response.slice(0, 4)));
                    if (this.deviceInfo.meta.sysCode !== parseInt(sysCode, 16)) {
                        throw new Error('Selected device does not match the connected device.');
                    }
                    resolve();
                })
                .catch((error: Error) => {
                    if (port.isOpen()) {
                        port.close()
                            .then(() => {
                                reject(error);
                            });
                    } else {
                        reject(error);
                    }
                });
        });
    }
}
