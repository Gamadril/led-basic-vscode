import { DefinitionProvider, TextDocument, Position, CancellationToken, ProviderResult, Location } from "vscode";

'use strict';

export class LEDBasicDefinitionProvider implements DefinitionProvider {
    provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location> {
        var result: Location | null = null;
        var code = document.getText();

        // check for jumps to label
        let wordRange = document.getWordRangeAtPosition(position, new RegExp('(?:goto|gosub)\\s([0-9]+)', 'i'));
        if (wordRange) {
            let label = document.getText(wordRange).replace('goto', '').replace('gosub', '').trim();
            let match = new RegExp(label + ':').exec(code);
            if (match) {
                let position = document.positionAt(match.index);
                result = new Location(document.uri, position);
            }
        } else {
            // check for data read
            wordRange = document.getWordRangeAtPosition(position, new RegExp('(?:read)\\s([0-9]+)', 'i'));
            if (wordRange) {
                let label = document.getText(wordRange).replace('read', '').trim();
                let match = new RegExp(label + ':').exec(code);
                if (match) {
                    let position = document.positionAt(match.index);
                    result = new Location(document.uri, position);
                }
            } else {
                // check for variable
                wordRange = document.getWordRangeAtPosition(position, new RegExp('\\b([a-zA-Z])\\b', 'i'));
                if (wordRange) {
                    let variable = document.getText(wordRange);
                    let match;
                    let reg = new RegExp('^[ ]*\\b' + variable + '\\b\\s?=', 'gim');
                    match = reg.exec(code);
                    if (match) {
                        let position = document.positionAt(match.index);
                        result = new Location(document.uri, position);
                    }
                }
            }
        }

        return result;
    }
}