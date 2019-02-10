'use strict';
import { IEntry, API } from "./LEDBasicAPI";
import { extensions } from "vscode";

/**
 * Finds the function signature information
 * 
 * @param funcName - Function name to serach for
 */
export function findLibSignature(funcName: string): IEntry | null {
    let libNames = Object.keys(API);
    let result = null;

    libNames.some(lib => {
        let func = Object.keys(API[lib]).find(func => {
            return func === funcName;
        });
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
    let ext = extensions.getExtension('Gamadril.led-basic');
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
    var str = '';
    for (var index = 0; index < array.length; index++) {
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