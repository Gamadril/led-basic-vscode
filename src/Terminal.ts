'use strict';

import { SerialPort } from "./SerialPort";
import { portSelector } from "./PortSelector";
import { debug } from "vscode";

class Terminal {
    private _port: SerialPort | null = null;

    start(): Promise<null> {
        return new Promise((resolve, reject) => {
            if (this._port) {
                resolve();
                return;
            }

            let selectedPort = portSelector.selectedPort();
            if (!selectedPort) {
                reject(new Error('Serial port not selected.'));
                return;
            }

            this._port = new SerialPort(selectedPort.name);
            this._port.open()
                .then(() => {
                    if (this._port) {
                        var debugOut = debug.activeDebugConsole;
                        this._port.setReadListener((data) => {
                            debugOut.appendLine(String.fromCharCode.apply(null, data));
                        });                            
                    }
                    resolve();
                })
                .catch(reject);
        });
    }

    stop() {
        if (!this._port) {
            return;
        }

        this._port.close();
    }
}

export const terminal = new Terminal();