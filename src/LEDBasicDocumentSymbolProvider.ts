'use strict';
import { DocumentSymbolProvider, TextDocument, CancellationToken, ProviderResult, Range, DocumentSymbol, SymbolKind } from "vscode";

export class LEDBasicDocumentSymbolProvider implements DocumentSymbolProvider {
    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<DocumentSymbol[]> {
        var result = [];
        var code = document.getText();
        var match;
        var reg: RegExp | null = null;
        var label = '';

        const regCommentLine = '^\'([^\r\n]+)\r?\n';

        // check for method labels
        reg = new RegExp('(?:' + regCommentLine + ')?^[^\'\r\n0-9]*([0-9]+:)(?!\\s*data)', 'igm');

        while (match = reg.exec(code)) {
            let index = match.index + match[0].indexOf(match[2]);
            let start = document.positionAt(index);
            let end = document.positionAt(index + match[2].length);
            
            label = match[2];
            let desc = '';
            if (match[1]) {
                desc = match[1].trim();
                label += ' - ' + desc;
            }

            result.push(new DocumentSymbol(label, desc, SymbolKind.Method, new Range(start, end), new Range(start, end)));
        }

        // check for data labels
        reg = new RegExp('(?:' + regCommentLine + ')?[^\'\r\n0-9]*([0-9]+:)(?=\\s*data)', 'igm');

        while (match = reg.exec(code)) {
            let index = match.index + match[0].indexOf(match[2]);
            let start = document.positionAt(index);
            let end = document.positionAt(index + match[2].length);
            
            label = match[2];
            let desc = '';
            if (match[1]) {
                desc = match[1].trim();
                label += ' - ' + desc;
            }

            result.push(new DocumentSymbol(label, desc, SymbolKind.Field, new Range(start, end), new Range(start, end)));
        }
        
        return result;
    }
}


