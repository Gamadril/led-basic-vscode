'use strict';

import { CompletionItemProvider, TextDocument, CancellationToken, CompletionItem, ProviderResult, Position, CompletionContext } from 'vscode';
import { API } from './LEDBasicAPI';

export class LEDBasicCompletionItemProvider implements CompletionItemProvider {
    private _deviceCommands: string[] = [];

    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[]> {

        let lineText = document.lineAt(position.line).text
        let lineTillCurrentPosition = lineText.substr(0, position.character)
        let parts = /([a-zA-Z]+).(\w*)$/g.exec(lineTillCurrentPosition);
        let result: CompletionItem[] = [];
        if (parts) {
            let libName = parts[1];
            let lib = API[libName];
            if (lib) {
                Object.keys(lib).forEach(func => {
                    if (this._deviceCommands.indexOf(func) !== -1) {
                        result.push(new CompletionItem(func));
                    }
                });
            }
        }

        return result;
    }

    public setSupportedCommands(commands: string[]) {
        this._deviceCommands = commands;
    }
}