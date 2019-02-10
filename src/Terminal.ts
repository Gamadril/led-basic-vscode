'use strict';

import { SerialPort } from "./SerialPort";
import { portSelector } from "./PortSelector";
import { StatusBarItem, window, StatusBarAlignment, OutputChannel } from "vscode";

/**
 * Terminal state
 */
export enum TERM_STATE {
    CONNECTED,
    DISCONNECTED,
    DISABLED
};

class Terminal {
    private _channel: OutputChannel;
    private _state: TERM_STATE = TERM_STATE.DISABLED;
    private _statusBarItem: StatusBarItem;
    private _port: SerialPort | null = null;
    private _deviceName: string;

    constructor() {
        this._channel = window.createOutputChannel('BLP-Device-Output');
        this._statusBarItem = window.createStatusBarItem(StatusBarAlignment.Left, 2);
        this._statusBarItem.command = 'led_basic.terminal';
        this._statusBarItem.show();
        this._deviceName = '';
        this.update();
    }

    start(): Promise<void> {
        if (this._state === TERM_STATE.DISABLED) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            if (this._port && this._port.isOpen()) {
                resolve();
                return;
            }
                                                                                                                                                                                                                                                                                    
            let selectedPort = portSelector.selectedPort();
            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }
            this._deviceName = selectedPort.deviceName;

            this._port = new SerialPort(selectedPort.name, {
                baudRate: 115200
            });
            this._port.open()
                .then(() => {
                    this.addLine('> Connected to LED Basic device: ' + this._deviceName);

                    if (this._port) {
                        this._port.setReadListener(data => {
                            let msg = String.fromCharCode.apply(null, data);
                            if (msg.startsWith('?ERROR')) {
                                this.addLine(msg);
                            } else {
                                this.addLine(msg);
                            }
                        });
                    }
                    this._state = TERM_STATE.CONNECTED;
                    this.update();
                    resolve();
                })
                .catch(reject);
        });
    }

    stop(): Promise<void> {
        if (!this._port || !this._port.isOpen() || this._state !== TERM_STATE.CONNECTED) {
            return Promise.resolve();
        } else {
            this._state = TERM_STATE.DISCONNECTED;
            this.update();
            this.addLine('> Disconnected from ' + this._deviceName);
            return this._port.close();
        }
    }

    private addLine(message: string) {
        this._channel.show();
        this._channel.appendLine(message);
    }

    get state(): TERM_STATE {
        return this._state;
    }

    enable() {
        this._state = TERM_STATE.DISCONNECTED;
        this.update();
    }

    disable() {
        this._state = TERM_STATE.DISABLED;
        this.update();
    }

    private update() {
        let label = 'Terminal';

        if (this._state === TERM_STATE.CONNECTED) {
            label = '$(link) ' + label;
        } else if (this._state === TERM_STATE.DISCONNECTED) {
            label = '$(zap) ' + label;
        } else {
            label = '$(circle-slash) ' + label;
        }

        this._statusBarItem.text = label;
    }

    dispose() {
        this._statusBarItem.dispose();
        this._channel.dispose();
    }
}

export const terminal = new Terminal();