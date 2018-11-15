'use strict';

import { QuickPickItem } from "vscode";
import { IDevice, IMetaData, ICommand } from "./Common";

/**
 * Device structure used for selection
 */
export class Device implements QuickPickItem, IDevice {
    label: string;
    detail?: string | undefined;
    meta: IMetaData = {
        sysCode: 0
    };
    commands!: ICommand[];

    constructor(name: string) {
        this.label = name;
    }
}