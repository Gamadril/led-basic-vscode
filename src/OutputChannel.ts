'use strict';

import { window, OutputChannel } from "vscode";

class Output {
    private channel: OutputChannel;
    constructor() {
        this.channel = window.createOutputChannel('LED-Basic');
    }

    clear() {
        this.channel.clear();
    }

    logInfo(message: string) {
        var line = '[INFO]\t' + message;
        this.addLine(line);
    }

    logError(message: string) {
        var line = '[ERROR]\t' + message;
        this.addLine(line);
    }

    private addLine(message: string) {
        this.channel.show();
        this.channel.appendLine(message);
    }
}

export const output = new Output();

