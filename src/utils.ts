import * as vscode from 'vscode';
import { IEntry, API } from "./LEDBasicAPI";

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
    let ext = vscode.extensions.getExtension('Gamadril.led-basic');
    if (ext) {
        return ext.extensionPath + '/';    
    }
    return '';
}