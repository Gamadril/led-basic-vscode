'use strict';

import { CompletionItemProvider, TextDocument, CancellationToken, CompletionItem, ProviderResult, Position, CompletionContext } from 'vscode';
import { API } from './LEDBasicAPI';

export class LEDBasicCompletionItemProvider implements CompletionItemProvider {
    public provideCompletionItems(document: TextDocument, position: Position, token: CancellationToken, context: CompletionContext): ProviderResult<CompletionItem[]> {

        let lineText = document.lineAt(position.line).text
        let lineTillCurrentPosition = lineText.substr(0, position.character)
        let parts = /([a-zA-Z]+).(\w*)$/g.exec(lineTillCurrentPosition);
        if (parts) {
            let libName = parts[1];
            let lib = API[libName];
            if (lib) {
                return Object.keys(lib).map(func => {
                    return new CompletionItem(func);
                });
            }
        }

        return null;
    }
}