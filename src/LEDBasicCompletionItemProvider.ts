'use strict';

import { CompletionItemProvider, TextDocument, CancellationToken, CompletionItem, ProviderResult, Position, CompletionContext } from 'vscode';
import { API } from './LEDBasicAPI';
import { deviceSelector } from './DeviceSelector';

export class LEDBasicCompletionItemProvider implements CompletionItemProvider {
    provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[]> {
        let commands = deviceSelector.selectedDevice().commands;
        let lineText = document.lineAt(position.line).text
        let lineTillCurrentPosition = lineText.substr(0, position.character)
        let parts = /([a-zA-Z]+).(\w*)$/g.exec(lineTillCurrentPosition);
        let result: CompletionItem[] = [];
        if (parts) {
            let libName = parts[1];
            let lib = API[libName];
            if (lib) {
                Object.keys(lib).forEach(func => {
                    if (commands.find(cmd => { return cmd.name === func })) {
                        result.push(new CompletionItem(func));
                    }
                });
            }
        }

        return result;
    }
}