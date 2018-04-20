import { ReferenceProvider, TextDocument, Position, CancellationToken, ProviderResult, ReferenceContext, Location, Range } from "vscode";

'use strict';

export class LEDBasicReferenceProvider implements ReferenceProvider {
    public provideReferences(document: TextDocument, position: Position, context: ReferenceContext, token: CancellationToken): ProviderResult<Location[]> {
        let wordRange = document.getWordRangeAtPosition(position);
        if (!wordRange) {
            return null;
        }

        let label = document.getText(wordRange);
        let code = document.getText();

        let reg = new RegExp('(' + label + ')', 'gi');
        let m;
        let result = [];
        while (m = reg.exec(code)) {
            let start = document.positionAt(m.index);
            let end = document.positionAt(m.index + m[1].length);

            result.push(new Location(document.uri, new Range(start, end)));
        }
        return result;
    }
}


