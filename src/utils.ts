'use strict';
import { extensions } from 'vscode';
import { workspace } from 'vscode';
import { API, IEntry } from './LEDBasicAPI';

/**
 * Finds the function signature information
 *
 * @param funcName - Function name to serach for
 */
export function findLibSignature(funcName: string): IEntry | null {
    const libNames = Object.keys(API);
    let result = null;

    libNames.some((lib) => {
        const func = Object.keys(API[lib]).find((apiFunc) => apiFunc === funcName);
        if (func) {
            result = API[lib][func];
            return true;
        }
        return false;
    });

    return result;
}

/**
 * Returns the root path of the current extension
 */
export function getExtensionPath(): string {
    const ext = extensions.getExtension('Gamadril.led-basic');
    if (ext) {
        return ext.extensionPath + '/';
    }
    return '';
}

/**
 * Converts the provided array to a HEX string representation
 * @param array
 */
export function dump(array: Uint8Array): string {
    let str = '';
    for (let index = 0; index < array.length; index++) {
        str += ('0' + (Number(array[index]).toString(16))).slice(-2).toUpperCase();
        if (index % 16 === 15) {
            str += '\n';
        } else {
            str += ' ';
        }
    }
    return str;
}

export function dumpToFile(array: Uint8Array, path: string) {
    const fs = require('fs');
    fs.writeFileSync(path, array);
}

/**
 * Check the state of the strict mode
 */
export function isStrictMode() {
    const config = workspace.getConfiguration('led_basic');
    const strictMode = config && config.useStrictMode ? true : false;
    return strictMode;
}

export const labelIdentifierPattern = '[a-zA-Z0-9_]+';
export const variableIdentifierPattern = '[a-zA-Z][a-zA-Z0-9_]*';
