'use strict';

import { window, OutputChannel } from "vscode";

'use strict';

// all calls implemented as Promises, since calling them directly without timeout prevent the DOM from being updated - as a result all messages appear at once at the end.
class Output {
    private channel: OutputChannel;
    constructor() {
        this.channel = window.createOutputChannel('LED-Basic');
    }

    clear(): Promise<void> {
        return new Promise((resolve) => {
            this.channel.clear();
            setTimeout(resolve, 1);
        });
    }

    logInfo(message: string): Promise<void> {
        return new Promise((resolve) => {
            this.addLine('[INFO]  ' + message);
            setTimeout(resolve, 1);
        });
    }

    logError(message: string): Promise<void> {
        return new Promise((resolve) => {
            this.addLine('[ERROR] ' + message);      
            setTimeout(resolve, 1);
        });
    }

    private addLine(message: string) {
        this.channel.show();
        this.channel.appendLine(message);
    }
}

export const output = new Output();

