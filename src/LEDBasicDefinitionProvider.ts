import { DefinitionProvider, TextDocument, Position, CancellationToken, ProviderResult, Location } from "vscode";

'use strict';

export class LEDBasicDefinitionProvider implements DefinitionProvider {
    public provideDefinition(document: TextDocument, position: Position, token: CancellationToken): ProviderResult<Location> {
        let wordRange = document.getWordRangeAtPosition(position, new RegExp('(?:goto|gosub) ([0-9]+)', 'i'));
        if (!wordRange) {
            return null;
        }

        let label = document.getText(wordRange).replace('goto', '').replace('gosub', '').trim();
        let code = document.getText();

        let labelDef = new RegExp(label + ':').exec(code);
        if (labelDef) {
            let position = document.positionAt(labelDef.index);
            return new Location(document.uri, position);
        }
        return null;
    }
}