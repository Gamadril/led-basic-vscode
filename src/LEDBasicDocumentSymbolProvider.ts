'use strict';
import { CancellationToken, DocumentSymbol, DocumentSymbolProvider, ProviderResult, Range, SymbolKind, TextDocument } from 'vscode';
import { labelIdentifierPattern } from './utils';

export class LEDBasicDocumentSymbolProvider implements DocumentSymbolProvider {
    public provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<DocumentSymbol[]> {
        const result = [];
        const code = document.getText();
        let match;
        let reg: RegExp | null = null;
        let label = '';

        const regCommentLine = '^\'([^\r\n]+)\r?\n';

        // check for data labels
        reg = new RegExp('(?:' + regCommentLine + ')?[^\'\r\na-zA-Z0-9_]*(' + labelIdentifierPattern + ':)(?=\\s*data)', 'igm');

        // tslint:disable-next-line: no-conditional-assignment
        while (match = reg.exec(code)) {
            const index = match.index + match[0].indexOf(match[2]);
            const start = document.positionAt(index);
            const end = document.positionAt(index + match[2].length);

            label = match[2];
            let desc = '';
            if (match[1]) {
                desc = match[1].trim();
            }

            result.push(new DocumentSymbol(label, desc, SymbolKind.Field, new Range(start, end), new Range(start, end)));
        }

        // check for method labels
        reg = new RegExp('(?:' + regCommentLine + ')?^[^\'\r\na-zA-Z0-9_]*(' + labelIdentifierPattern + ':)(?!\\s*data)', 'igm');

        // tslint:disable-next-line: no-conditional-assignment
        while (match = reg.exec(code)) {
            const index = match.index + match[0].indexOf(match[2]);
            const start = document.positionAt(index);
            const end = document.positionAt(index + match[2].length);

            label = match[2];
            let desc = '';
            if (match[1]) {
                desc = match[1].trim();
            }

            result.push(new DocumentSymbol(label, desc, SymbolKind.Method, new Range(start, end), new Range(start, end)));
        }

        return result;
    }
}
