'use strict';
import { ReferenceProvider, TextDocument, Position, CancellationToken, ProviderResult, ReferenceContext, Location, Range } from "vscode";

export class LEDBasicReferenceProvider implements ReferenceProvider {
    public provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        var result = [];
        var label = '';
        var code = document.getText();
        var match;
        var reg: RegExp | null = null;

        // check for a label
        var wordRange = document.getWordRangeAtPosition(position, new RegExp('[0-9]+:', 'i'));
        if (wordRange) {
            label = document.getText(wordRange);
            label = label.substring(0, label.length - 1);
            reg = new RegExp('(?:goto|gosub|read)\\s\\b(' + label + ')\\b', 'ig');
        } else {
            // check variables
            wordRange = document.getWordRangeAtPosition(position, new RegExp('[a-zA-Z]', 'i'));
            if (wordRange) {
                label = document.getText(wordRange);
                reg = new RegExp('\\b(' + label + ')\\b', 'ig');
            }
        }

        if (reg) {
            while (match = reg.exec(code)) {
                let index = match.index + match[0].indexOf(match[1]);
                let start = document.positionAt(index);
                let end = document.positionAt(index + match[1].length);

                result.push(new Location(document.uri, new Range(start, end)));
            }
        }
        return result;
    }
}


