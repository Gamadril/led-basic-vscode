'use strict';

import { CancellationToken, DefinitionProvider, Location, Position, ProviderResult, TextDocument } from 'vscode';
import { labelIdentifierPattern, variableIdentifierPattern } from './utils';

export class LEDBasicDefinitionProvider implements DefinitionProvider {
    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location> {
        let result: Location | null = null;
        const code = document.getText();

        // check for jumps to label
        const lip = labelIdentifierPattern;
        let wordRange = document.getWordRangeAtPosition(position, new RegExp('(?:goto|gosub)\\s(' + lip + ')', 'i'));
        if (wordRange) {
            const label = document.getText(wordRange).replace('goto', '').replace('gosub', '').trim();
            const match = new RegExp(label + ':').exec(code);
            if (match) {
                const pos = document.positionAt(match.index);
                result = new Location(document.uri, pos);
            }
        } else {
            // check for data read
            wordRange = document.getWordRangeAtPosition(position, new RegExp('(?:read)\\s(' + labelIdentifierPattern + ')', 'i'));
            if (wordRange) {
                const label = document.getText(wordRange).replace('read', '').trim();
                const match = new RegExp(label + ':').exec(code);
                if (match) {
                    const pos = document.positionAt(match.index);
                    result = new Location(document.uri, pos);
                }
            } else {
                // check for variable
                wordRange = document.getWordRangeAtPosition(position, new RegExp('\\b(' + variableIdentifierPattern + ')\\b', 'i'));
                if (wordRange) {
                    const variable = document.getText(wordRange);
                    let match;
                    const reg = new RegExp('^[^\\n]*\\b' + variable + '\\b\\s?=', 'gim');
                    match = reg.exec(code);
                    if (match) {
                        const pos = document.positionAt(match.index);
                        result = new Location(document.uri, pos);
                    }
                }
            }
        }

        return result;
    }
}
