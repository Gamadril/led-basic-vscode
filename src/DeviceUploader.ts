'use strict';

// tslint:disable: no-console no-unused-expression

import { StringDecoder } from 'string_decoder';
import { BaseDeviceUploader, CMD } from './BaseDeviceUploader';

const DEBUG = false;

const ERROR_GET_TIMEOUT = 200;

export class DeviceUploader extends BaseDeviceUploader {
    public reset(): Promise<string> {
        return new Promise((resolve, reject) => {
            let error = '';
            const rstPacket = {
                cmd: CMD.CMD_RESET,
                data: new Uint8Array([0x01, 0x02])
            };

            DEBUG && console.log('[UPLOAD] resetDevice start');

            this.open()
                .then(() => this.sendPacket(rstPacket))
                .then(() => this.read(ERROR_GET_TIMEOUT)) // get a possible error
                .then((data: Uint8Array) => {
                    if (data.length) {
                        // error = String.fromCharCode.apply(null, data);
                        error = new StringDecoder('utf8').write(Buffer.from(data));
                    }
                    return Promise.resolve();
                })
                .then(() => this.close())
                .then(() => {
                    DEBUG && console.log('[UPLOAD] resetDevice done');
                    resolve(error);
                })
                .catch(reject);
        });
    }

    public read(timeout?: number): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            if (!this.port || !this.port.isOpen()) {
                reject(new Error('Port not opened'));
            } else {
                this.port.read(timeout)
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    public open(): Promise<void> {
        this.port = this.portFactory.createSerialPort(this.portInfo.name, {
            baudRate: 0x100000 + this.deviceInfo.meta.sysCode
        });
        return this.port.openForUpload(true, false);
    }
}
