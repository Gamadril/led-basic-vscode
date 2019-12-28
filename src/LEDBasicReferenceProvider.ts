'use strict';
import { CancellationToken, Location, Position, ProviderResult, Range, ReferenceContext, ReferenceProvider, TextDocument } from 'vscode';
import { labelIdentifierPattern, variableIdentifierPattern } from './utils';

export class LEDBasicReferenceProvider implements ReferenceProvider {
    public provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        const result = [];
        let label = '';
        const code = document.getText();
        let match;
        let reg: RegExp | null = null;

        // check for a label
        let wordRange = document.getWordRangeAtPosition(position, new RegExp(labelIdentifierPattern + ':', 'i'));
        if (wordRange) {
            label = document.getText(wordRange);
            label = label.substring(0, label.length - 1);
            reg = new RegExp('(?:goto|gosub|read)\\s\\b(' + label + ')\\b', 'ig');
        } else {
            // check variables
            wordRange = document.getWordRangeAtPosition(position, new RegExp(variableIdentifierPattern, 'i'));
            if (wordRange) {
                label = document.getText(wordRange);
                reg = new RegExp('\\b(' + label + ')\\b', 'ig');
            }
        }

        if (reg) {
            // tslint:disable-next-line: no-conditional-assignment
            while (match = reg.exec(code)) {
                const index = match.index + match[0].indexOf(match[1]);
                const start = document.positionAt(index);
                const end = document.positionAt(index + match[1].length);

                result.push(new Location(document.uri, new Range(start, end)));
            }
        }
        return result;
    }
}
