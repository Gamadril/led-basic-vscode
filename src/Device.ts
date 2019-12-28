'use strict';

import { QuickPickItem } from 'vscode';
import { ICommand, IDevice, IMetaData } from './Common';

/**
 * Device structure used for selection
 */
export class Device implements QuickPickItem, IDevice {
    public label: string;
    public detail?: string | undefined;
    public meta: IMetaData = {
        sysCode: 0
    };
    public commands!: ICommand[];

    constructor(name: string) {
        this.label = name;
    }
}
