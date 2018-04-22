'use strict';

import { QuickPickItem } from "vscode";


export class Device implements QuickPickItem {
    label: string;
    detail?: string | undefined;
    sysCode: string = '';
    commands!: string[];

    constructor(name: string) {
        this.label = name;
    }
}