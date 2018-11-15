import { LEDBasicParser } from "./LEDBasicParser"
import { getExtensionPath } from "./utils";
import { workspace } from 'vscode';
import { operation } from './LEDBasicEvalOperation';
import fs = require('fs');
import ohm = require('ohm-js')

const GRAMMAR_EX = 'grammar_ex.ohm';
const GRAMMAR = 'grammar.ohm';


class ParserFactory {
    parser: LEDBasicParser | null = null;
    getParser() : LEDBasicParser {
        if (this.parser) {
            return this.parser;
        }

        let config = workspace.getConfiguration('led_basic');
        let strictMode = config && config.useStrictMode ? true : false;
        let path = getExtensionPath() + 'res/' + (strictMode ? GRAMMAR : GRAMMAR_EX);
        let grammar = fs.readFileSync(path).toString();
        //let op = strictMode ? operation : operation_ex;
        let op = operation;
        this.parser = new LEDBasicParser(ohm, grammar, op);
        return this.parser;
    }
}

export const LEDBasicParserFactory = new ParserFactory();