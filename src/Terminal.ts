'use strict';

import { SerialPort } from "./SerialPort";
import { portSelector } from "./PortSelector";
import { StatusBarItem, window, StatusBarAlignment, debug } from "vscode";

/**
 * Terminal state
 */
export enum TERM_STATE {
    CONNECTED,
    DISCONNECTED,
    DISABLED
};

const REG_ERROR = new RegExp('\\?ERROR ([0-9]+) IN LINE ([0-9]+)');

const ERROR_MAP: { [s: string]: string; } = {
    '11': 'Unknown token',
    '12': 'Wrong address',
    '13': 'Too many nested GOSUB commands',
    '14': 'RETURN wihtout GOSUB',
    '15': 'Value cannot be 0',
    '16': 'Too many nested FOR-NEXT loops',
    '17': 'Incorrect values at TO/DOWNTO',
    '18': 'Next variable is invalid',
    '19': 'Wrong value in LED command',
    '20': 'Wrong value in IO command'
};

class Terminal {
    private _state: TERM_STATE = TERM_STATE.DISABLED;
    private _statusBarItem: StatusBarItem;
    private _port: SerialPort | null = null;
    private _deviceName: string;

    constructor() {
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

            this._port = new SerialPort(selectedPort.name);
            this._port.open()
                .then(() => {
                    debug.activeDebugConsole.appendLine('\x1b[32mConnected to LED Basic device: \x1b[36m' + this._deviceName + '\x1b[0m\n');

                    if (this._port) {
                        this._port.setReadListener(data => {
                            let msg = String.fromCharCode.apply(null, data);
                            if (msg.startsWith('?ERROR')) {
                                debug.activeDebugConsole.appendLine('\x1b[31m' + msg + '\x1b[0m');

                                let match = REG_ERROR.exec(msg);
                                if (match) {
                                    let err = ERROR_MAP[match[1]];
                                    if (err) {
                                        window.showErrorMessage(err + ' in line ' + match[2]);
                                    }
                                }
                            } else {
                                debug.activeDebugConsole.appendLine(msg);
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
            debug.activeDebugConsole.appendLine('\x1b[32mDisconnected from \x1b[36m' + this._deviceName + '\x1b[0m\n');
            return this._port.close();
        }
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
    }
}

export const terminal = new Terminal();