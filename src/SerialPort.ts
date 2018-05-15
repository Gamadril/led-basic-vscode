'use strict';

const SP = require("../blp-serial").SerialPort;

import { Disposable } from 'vscode';

interface ISerialPortOptions { baudRate: number, autoOpen?: boolean }
export interface ISerialPortInfo {
    name: string,
    serialNumber: string,
    deviceName: string,
    sysCode: number
}

const DEBUG = false;

export class SerialPort implements Disposable {
    private _readCallTimerId: NodeJS.Timer | null = null;
    private _currentErrorCallback: any;
    private _inDataQueue: Uint8Array[];
    private _onResult: ((data: Uint8Array) => void) | null = null;
    private _port: any;
    private _portName: string;

    constructor(port: string, options?: ISerialPortOptions) {
        options = options || {
            baudRate: 9600,
        };
        this._portName = port;
        options.autoOpen = false;
        this._port = new SP(this._portName, options);

        this._inDataQueue = [];

        this._port.on('data', (data: Buffer) => {
            DEBUG && console.log('[SERIAL] received ' + data.byteLength + ' bytes');
            if (this._inDataQueue.length) {
                DEBUG && console.log('[SERIAL] CB - queue not empty, add new data to it');
                this._inDataQueue.push(new Uint8Array(data));
            } else if (this._onResult) {
                DEBUG && console.log('[SERIAL] CB - queue empty, call listener directly');
                if (this._readCallTimerId) {
                    clearTimeout(this._readCallTimerId);
                    this._readCallTimerId = null;
                }
                this._onResult(new Uint8Array(data));
            }
        });

        this._port.on('error', (error: Error) => {
            DEBUG && console.log('[SERIAL] error: ' + error.message);
            if (this._currentErrorCallback) {
                this._currentErrorCallback(error);
            }
        });
    }

    open(): Promise<null> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] open ' + this._portName);
            this._port.open((error: any) => {
                if (error) {
                    DEBUG && console.log('[SERIAL] error opening: ' + error.message);
                    reject(error);
                } else {
                    DEBUG && console.log('[SERIAL] port opened');
                    resolve();
                }
            });
        });
    }

    openForUpload(): Promise<null> {
        return new Promise((resolve, reject) => {
            this.open()
                .then(() => {
                    return this.setOptions({ brk: true });
                })
                .then(() => {
                    return this.setOptions({ brk: false });
                })
                .then(resolve)
                .catch(reject)
        });
    }


    close(): Promise<null> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] close');

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

    setReadListener(onData: (data: Uint8Array) => void) {
        this._onResult = onData;
    }

    read(): Promise<Uint8Array> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] read');
            if (!this.isOpen()) {
                DEBUG && console.log('[SERIAL] read - not opened');
                reject(new Error('Serial Port is closed'));
            } else if (this._readCallTimerId) {
                DEBUG && console.log('[SERIAL] read in progress');
                reject(new Error('Previous read operation still waiting for data'));
            } else {
                if (this._inDataQueue.length) {
                    let data = this._inDataQueue.shift();
                    DEBUG && console.log('[SERIAL] read got data from queue');
                    resolve(data);
                    return;
                } else {
                    this._onResult = (data: Uint8Array) => {
                        DEBUG && console.log('[SERIAL] read called from read CB');
                        this._onResult = null;
                        resolve(data);
                    }
                    this._readCallTimerId = setTimeout(() => {
                        DEBUG && console.log('[SERIAL] read timed out. rejecting.');
                        this._readCallTimerId = null;
                        this._onResult = null;
                        reject(new Error('Device is not reponding. Check if you\'ve selected the right target device and correct serial port.'));
                    }, 2000);
                }

            }
        });
    }

    write(data: Uint8Array): Promise<null> {
        return new Promise((resolve, reject) => {
            DEBUG && console.log('[SERIAL] write');
            this._port.write(Buffer.from(data.buffer), null, (error: Error) => {
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

    private setOptions(options: any): Promise<null> {
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
                    }, 10)
                }
            });
        });
    }

    isOpen(): boolean {
        return this._port && this._port.isOpen();
    }

    dispose() {
        if (this.isOpen()) {
            this._port.close();
        }
        this._port = null;
    }

    static list(): Promise<ISerialPortInfo[]> {
        return new Promise((resolve, reject) => {
            SP.list((error: string, foundPorts: Array<any>) => {
                if (error) {
                    reject(error);
                } else {
                    let ports: ISerialPortInfo[] = foundPorts.map((port: any) => {
                        return {
                            serialNumber: port.serialNumber,
                            name: port.comName,
                            deviceName: port.deviceName,
                            sysCode: port.bcdDevice
                        }
                    });
                    resolve(ports);
                }
            });
        });
    }
}