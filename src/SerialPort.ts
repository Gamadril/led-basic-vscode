'use strict';
// tslint:disable: no-unused-expression no-console

const SP = require('../blp-serial');

import { Disposable } from 'vscode';
// import { dump } from './utils';
import { ISerialPort, ISerialPortInfo, ISerialPortOptions } from './Common';

const DEBUG = false;
const DEFAULT_READ_TIMEOUT = 2000;
const BUFFER_SIZE = 1024;

export class SerialPort implements ISerialPort, Disposable {

    public static list(): Promise<ISerialPortInfo[]> {
        return new Promise((resolve, reject) => {
            SP.list()
                .then((foundPorts: any[]) => {
                    const ports: ISerialPortInfo[] = foundPorts.map((port: any) => {
                        return {
                            serialNumber: port.serialNumber,
                            name: port.comName,
                            deviceName: port.deviceName,
                            sysCode: port.bcdDevice
                        };
                    });
                    resolve(ports);
                })
                .catch(reject);
        });
    }

    private dataTimeout: number = 0;
    private readCallTimerId: NodeJS.Timer | null = null;
    private currentErrorCallback: any;
    private inDataQueue: Uint8Array;
    private inDataQueueOffset: number = 0;
    private onResult: ((data: Uint8Array) => void) | null = null;
    private port: any;
    private portName: string;

    constructor(port: string, options?: ISerialPortOptions) {
        options = options || {
            baudRate: 9600,
        };
        this.portName = port;
        options.autoOpen = false;
        options.hupcl = false;

        this.port = new SP(this.portName, options);

        this.inDataQueue = new Uint8Array(BUFFER_SIZE);

        this.port.on('data', (data: Buffer) => {
            DEBUG && console.log('[SERIAL] received ' + data.byteLength + ' bytes');
            // DEBUG && console.log('[SERIAL] <\n' + dump(data));
            if (this.inDataQueueOffset && !this.dataTimeout) {
                DEBUG && console.log('[SERIAL] CB - queue not empty, add new data to it');
                this.inDataQueue.set(new Uint8Array(data), this.inDataQueueOffset);
                this.inDataQueueOffset += data.byteLength;
            } else if (this.onResult) {
                if (this.dataTimeout) {
                    DEBUG && console.log('[SERIAL] CB - has a data timeout. pushing data to queue');
                    this.inDataQueue.set(new Uint8Array(data), this.inDataQueueOffset);
                    this.inDataQueueOffset += data.byteLength;
                } else {
                    DEBUG && console.log('[SERIAL] CB - calling callback function directly');
                    this.onResult(new Uint8Array(data));
                }
            } else {
                DEBUG && console.log('[SERIAL] CB - got data without read requested. pushing to queue');
                this.inDataQueue.set(new Uint8Array(data), this.inDataQueueOffset);
                this.inDataQueueOffset += data.byteLength;
            }
        });

        this.port.on('error', (error: Error) => {
            DEBUG && console.log('[SERIAL] error: ' + error.message);
            if (this.currentErrorCallback) {
                this.currentErrorCallback(error);
            }
        });
    }

    public open(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] open ' + this.portName);

            this.port.open((error: any) => {
                if (error) {
                    DEBUG && console.log('[SERIAL] error opening:', error.message);
                    reject(error);
                } else {
                    DEBUG && console.log('[SERIAL] port opened');
                    resolve();
                }
            });
        });
    }

    public openForUpload(brk?: boolean, dtr?: boolean): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] openForUpload with BRK:', brk, ', DTR:', dtr);
            this.open()
                .then(() => {
                    if (brk) {
                        return this.toggleBRK();
                    }
                    return Promise.resolve();
                })
                .then(() => {
                    if (dtr) {
                        return this.toggleDTR();
                    }
                    return Promise.resolve();
                })
                .then(() => {
                    DEBUG && console.log('[SERIAL] openForUpload resolving');
                    resolve();
                })
                .catch(reject);
        });
    }

    public toggleBRK(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] toggle BRK');
            this.setOptions({ brk: true, dtr: false })
                .then(() => {
                    return this.setOptions({ brk: false, dtr: false });
                })
                .then(resolve)
                .catch(reject);
        });
    }

    public toggleDTR(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] toggle DTR');
            this.setOptions({ dtr: true })
                .then(() => {
                    return this.setOptions({ dtr: false });
                })
                .then(resolve)
                .catch(reject);
        });
    }

    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] close');
            this.inDataQueueOffset = 0;
            this.onResult = null;
            this.readCallTimerId = null;
            this.dataTimeout = 0;
            this.currentErrorCallback = null;

            this.port.close((error: Error) => {
                if (error) {
                    DEBUG && console.log('[SERIAL] error closing: ' + error.message);
                    reject(error);
                } else {
                    DEBUG && console.log('[SERIAL] port closed');
                    resolve();
                }
            });
        });
    }

    public setReadListener(onData: ((data: Uint8Array) => void) | null) {
        this.onResult = onData;
    }

    public read(dataTimeout?: number): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] read');
            if (!this.isOpen()) {
                DEBUG && console.log('[SERIAL] read - not opened');
                reject(new Error('Serial Port is closed'));
            } else if (this.readCallTimerId) {
                DEBUG && console.log('[SERIAL] read in progress');
                reject(new Error('Previous read operation still waiting for data'));
            } else {
                this.dataTimeout = dataTimeout || 0;
                if (this.inDataQueueOffset && !dataTimeout) {
                    const data = this.inDataQueue.slice(0, this.inDataQueueOffset);
                    this.inDataQueueOffset = 0;
                    DEBUG && console.log('[SERIAL] read got data from queue');
                    resolve(data);
                } else {
                    this.onResult = (data: Uint8Array) => {
                        DEBUG && console.log('[SERIAL] read called from read CB');
                        if (this.readCallTimerId) {
                            clearTimeout(this.readCallTimerId);
                            this.readCallTimerId = null;
                        }
                        this.onResult = null;
                        resolve(data);
                    };

                    this.setReadTimeout((data: Uint8Array) => {
                        resolve(data);
                    }, (error: Error) => {
                        reject(error);
                    });
                }
            }
        });
    }

    public write(data: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] write');
            // DEBUG && console.log('[SERIAL] >\n' + dump(data));
            this.port.write(Buffer.from(data.buffer as ArrayBuffer), null, (error: Error) => {
                if (error) {
                    DEBUG && console.log('[SERIAL] error writing: ' + error.message);
                    reject(error.message);
                } else {
                    DEBUG && console.log('[SERIAL] sent ' + data.byteLength + ' bytes');
                    resolve();
                }
            });
        });
    }

    public setOptions(options: any): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] set options');
            this.port.set(options, (error: any) => {
                if (error) {
                    DEBUG && console.log('[SERIAL] set options error: ' + error.message);
                    reject(error.message);
                } else {
                    DEBUG && console.log('[SERIAL] options set');
                    setTimeout(() => {
                        resolve();
                    }, 20);
                }
            });
        });
    }

    public isOpen(): boolean {
        return this.port && this.port.isOpen;
    }

    public dispose() {
        if (this.isOpen()) {
            this.port.close();
        }
        this.port = null;
    }

    private setReadTimeout(onTimeout: (data: Uint8Array) => void, onError: (error: Error) => void) {
        this.readCallTimerId = setTimeout(() => {
            this.readCallTimerId = null;
            this.onResult = null;
            const result = this.inDataQueue.slice(0, this.inDataQueueOffset);
            this.inDataQueueOffset = 0;
            if (this.dataTimeout) {
                DEBUG && console.log('[SERIAL] read timed out expectedly. resolving.');
                onTimeout(result);
            } else {
                DEBUG && console.log('[SERIAL] read timed out unexpectedly. rejecting.');
                onError(new Error('Device is not reponding. Check if you\'ve selected the right target device and correct serial port.'));
            }
        }, this.dataTimeout ? this.dataTimeout : DEFAULT_READ_TIMEOUT);
    }
}
