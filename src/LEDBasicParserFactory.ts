import fs = require('fs');
import ohm = require('ohm-js');
// import { operation } from './LEDBasicEvalOperation';
import { operation } from './LEDBasicEvalOperationEx';
import { LEDBasicParser } from './LEDBasicParser';
import { getExtensionPath } from './utils';

const GRAMMAR_EX = 'grammar_ex.ohm';
// const GRAMMAR = 'grammar.ohm';

class ParserFactory {
    private parser: LEDBasicParser | null = null;

    public getParser(): LEDBasicParser {
        if (this.parser) {
            return this.parser;
        }

        const path = getExtensionPath() + 'res/' + GRAMMAR_EX;
        const grammar = fs.readFileSync(path).toString();
        this.parser = new LEDBasicParser(ohm, grammar, operation);
        return this.parser;
    }
}

export const LEDBasicParserFactory = new ParserFactory();
