'use strict';

const SP = require("../blp-serial");
const USB_SP = require("../blp-serial-usb");

import { Disposable } from 'vscode';
//import { dump } from './utils';
import { ISerialPortOptions, ISerialPort, ISerialPortInfo } from './Common';

const DEBUG = false;
const DEFAULT_READ_TIMEOUT = 2000;
const BUFFER_SIZE = 1024;

export class SerialPort implements ISerialPort, Disposable {
    private _dataTimeout: number = 0;
    private _readCallTimerId: NodeJS.Timer | null = null;
    private _currentErrorCallback: any;
    private _inDataQueue: Uint8Array;
    private _inDataQueueOffset: number = 0;
    private _onResult: ((data: Uint8Array) => void) | null = null;
    private _port: any;
    private _portName: string;

    constructor(port: string, options?: ISerialPortOptions) {
        options = options || {
            baudRate: 9600,
        };
        this._portName = port;
        options.autoOpen = false;
        options.hupcl = false;

        if (this._portName.startsWith('usb')) {
            this._port = new USB_SP(this._portName, options);
        } else {
            this._port = new SP(this._portName, options);
        }

        this._inDataQueue = new Uint8Array(BUFFER_SIZE);

        this._port.on('data', (data: Buffer) => {
            DEBUG && console.log('[SERIAL] received ' + data.byteLength + ' bytes');
            //DEBUG && console.log('[SERIAL] <\n' + dump(data));
            if (this._inDataQueueOffset && !this._dataTimeout) {
                DEBUG && console.log('[SERIAL] CB - queue not empty, add new data to it');
                this._inDataQueue.set(new Uint8Array(data), this._inDataQueueOffset);
                this._inDataQueueOffset += data.byteLength;
            } else if (this._onResult) {
                if (this._dataTimeout) {
                    DEBUG && console.log('[SERIAL] CB - has a data timeout. pushing data to queue');
                    this._inDataQueue.set(new Uint8Array(data), this._inDataQueueOffset);
                    this._inDataQueueOffset += data.byteLength;
                } else {
                    DEBUG && console.log('[SERIAL] CB - calling callback function directly');
                    this._onResult(new Uint8Array(data));
                }
            } else {
                DEBUG && console.log('[SERIAL] CB - got data without read requested. pushing to queue');
                this._inDataQueue.set(new Uint8Array(data), this._inDataQueueOffset);
                this._inDataQueueOffset += data.byteLength;
            }
        });

        this._port.on('error', (error: Error) => {
            DEBUG && console.log('[SERIAL] error: ' + error.message);
            if (this._currentErrorCallback) {
                this._currentErrorCallback(error);
            }
        });
    }

    open(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] open ' + this._portName);

            this._port.open((error: any) => {
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

    openForUpload(brk?: boolean, dtr?: boolean): Promise<void> {
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
                .catch(reject)
        });
    }

    toggleBRK(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] toggle BRK');
            this.setOptions({ brk: true, dtr: false })
                .then(() => {
                    return this.setOptions({ brk: false, dtr: false });
                })
                .then(resolve)
                .catch(reject)
        });
    }

    toggleDTR(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] toggle DTR');
            this.setOptions({ dtr: true })
                .then(() => {
                    return this.setOptions({ dtr: false });
                })
                .then(resolve)
                .catch(reject)
        });
    }

    close(): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] close');
            this._inDataQueueOffset = 0;
            this._onResult = null;
            this._readCallTimerId = null;
            this._dataTimeout = 0;
            this._currentErrorCallback = null;

            this._port.close((error: Error) => {
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

    setReadListener(onData: ((data: Uint8Array) => void) | null) {
        this._onResult = onData;
    }

    private setReadTimeout(onTimeout: (data: Uint8Array) => void, onError: (error: Error) => void) {
        this._readCallTimerId = setTimeout(() => {
            this._readCallTimerId = null;
            this._onResult = null;
            let result = this._inDataQueue.slice(0, this._inDataQueueOffset);
            this._inDataQueueOffset = 0;
            if (this._dataTimeout) {
                DEBUG && console.log('[SERIAL] read timed out expectedly. resolving.');
                onTimeout(result);
            } else {
                DEBUG && console.log('[SERIAL] read timed out unexpectedly. rejecting.');
                onError(new Error('Device is not reponding. Check if you\'ve selected the right target device and correct serial port.'));
            }
        }, this._dataTimeout ? this._dataTimeout : DEFAULT_READ_TIMEOUT);
    }

    read(dataTimeout?: number): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] read');
            if (!this.isOpen()) {
                DEBUG && console.log('[SERIAL] read - not opened');
                reject(new Error('Serial Port is closed'));
            } else if (this._readCallTimerId) {
                DEBUG && console.log('[SERIAL] read in progress');
                reject(new Error('Previous read operation still waiting for data'));
            } else {
                this._dataTimeout = dataTimeout || 0;
                if (this._inDataQueueOffset && !dataTimeout) {
                    let data = this._inDataQueue.slice(0, this._inDataQueueOffset);
                    this._inDataQueueOffset = 0;
                    DEBUG && console.log('[SERIAL] read got data from queue');
                    resolve(data);
                } else {
                    this._onResult = (data: Uint8Array) => {
                        DEBUG && console.log('[SERIAL] read called from read CB');
                        if (this._readCallTimerId) {
                            clearTimeout(this._readCallTimerId);
                            this._readCallTimerId = null;
                        }
                        this._onResult = null;
                        resolve(data);
                    }

                    this.setReadTimeout((data: Uint8Array) => {
                        resolve(data);
                    }, (error: Error) => {
                        reject(error);
                    });
                }
            }
        });
    }

    write(data: Uint8Array): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] write');
            //DEBUG && console.log('[SERIAL] >\n' + dump(data));
            this._port.write(Buffer.from(data.buffer as ArrayBuffer), null, (error: Error) => {
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

    setOptions(options: any): Promise<void> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] set options');
            this._port.set(options, (error: any) => {
                if (error) {
                    DEBUG && console.log('[SERIAL] set options error: ' + error.message);
                    reject(error.message);
                } else {
                    DEBUG && console.log('[SERIAL] options set');
                    setTimeout(() => {
                        resolve();
                    }, 20)
                }
            });
        });
    }

    isOpen(): boolean {
        return this._port && this._port.isOpen;
    }

    dispose() {
        if (this.isOpen()) {
            this._port.close();
        }
        this._port = null;
    }

    static list(): Promise<ISerialPortInfo[]> {
        return new Promise((resolve, reject) => {
            let allPorts: ISerialPortInfo[] = [];
            SP.list()
                .then((foundPorts: Array<any>) => {
                    let ports: ISerialPortInfo[] = foundPorts.map((port: any) => {
                        return {
                            serialNumber: port.serialNumber,
                            name: port.comName,
                            deviceName: port.deviceName,
                            sysCode: port.bcdDevice
                        }
                    });
                    allPorts = allPorts.concat(ports);

                    if (process.platform !== 'win32') {
                        return Promise.resolve([]);
                    } else {
                        return USB_SP.list();
                    }
                })
                .then((foundPorts: Array<any>) => {
                    let ports: ISerialPortInfo[] = foundPorts.map((port: any) => {
                        return {
                            serialNumber: port.serialNumber,
                            name: port.comName,
                            deviceName: port.deviceName,
                            sysCode: port.bcdDevice
                        }
                    });
                    allPorts = allPorts.concat(ports);
                    resolve(allPorts);
                })
                .catch(reject);
        });
    }
}