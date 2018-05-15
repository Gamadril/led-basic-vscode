'use strict';

import { QuickPickItem } from "vscode";

/**
 * Color order constants
 */
export enum COLOR_ORDER {
    RGB = 0xE4,
    GRB = 0xB4
};

/**
 * Command structure
 */
export interface ICommand {
    name: string,
    argcount: number
}

/**
 * Device specific meta data 
 */
interface IMetaData {
    sysCode: number;
    basver?: number;
    ledcnt?: number;
    default_ledcnt?: number;
    color_order?: COLOR_ORDER;
    cfg?: number;
    mbr?: number;
    led_type?: number;
    spi_rate?: number;
}

/**
 * Device structure used for selection
 */
export class Device implements QuickPickItem {
    label: string;
    detail?: string | undefined;
    meta: IMetaData = {
        sysCode: 0,
    };
    commands!: ICommand[];

    constructor(name: string) {
        this.label = name;
    }
}