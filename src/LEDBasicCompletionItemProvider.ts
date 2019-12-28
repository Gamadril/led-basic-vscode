'use strict';

import { CancellationToken, CompletionContext, CompletionItem, CompletionItemProvider, Position, ProviderResult, TextDocument } from 'vscode';
import { deviceSelector } from './DeviceSelector';
import { API } from './LEDBasicAPI';

export class LEDBasicCompletionItemProvider implements CompletionItemProvider {
    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[]> {
        const commands = deviceSelector.selectedDevice().commands;
        const lineText = document.lineAt(position.line).text;
        const lineTillCurrentPosition = lineText.substr(0, position.character);
        const parts = /([a-zA-Z]+).(\w*)$/g.exec(lineTillCurrentPosition);
        const result: CompletionItem[] = [];
        if (parts) {
            const libName = parts[1];
            const lib = API[libName];
            if (lib) {
                Object.keys(lib).forEach((func) => {
                    if (commands.find((cmd) => cmd.name === func)) {
                        result.push(new CompletionItem(func));
                    }
                });
            }
        }

        return result;
    }
}
