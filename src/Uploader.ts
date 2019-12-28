'use strict';
// tslint:disable: no-console no-unused-expression
import { IDevice, IDevUploader, ISerialPortFactory, ISerialPortInfo } from './Common';
import { DeviceUploader } from './DeviceUploader';
import { SBProgUploader } from './SBProgUploader';

const SBPROG_SYSCODE = 0x4470;

const DEBUG = false;

export class Uploader {
    private devUploader: IDevUploader;

    constructor(portInfo: ISerialPortInfo, device: IDevice, portFactory: ISerialPortFactory) {
        if (portInfo.sysCode === SBPROG_SYSCODE) {
            this.devUploader = new SBProgUploader(portInfo, device, portFactory);
        } else {
            this.devUploader = new DeviceUploader(portInfo, device, portFactory);
        }
    }

    public upload(file: Uint8Array): Promise<string> {
        return new Promise((resolve, reject) => {
            this.devUploader.open()
                .then(() => this.devUploader.sendData(file))
                .then(() => this.devUploader.close())
                .then(() => this.devUploader.reset())
                .then((error) => {
                    if (error) {
                        DEBUG && console.log('[UPLOAD] upload - received error from device');
                    }
                    if (this.devUploader.isOpen()) {
                        this.devUploader.close()
                            .then(() => {
                                resolve(error);
                            });
                    } else {
                        resolve(error);
                    }
                })
                .catch((error) => {
                    if (this.devUploader.isOpen()) {
                        this.devUploader.close()
                            .then(() => reject(error));
                    } else {
                        reject(error);
                    }
                });
        });
    }

    public dispose() {
        this.devUploader.close();
    }
}
