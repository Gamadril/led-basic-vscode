import { IError, IMatchResult, IParseResult } from './Common';

export class LEDBasicParser {
    private _grammar: any;
    private _semantics: any;

    constructor(ohmlib: any, grammar: string, operation: any) {
        this._grammar = ohmlib.grammar(grammar);
        this._semantics = this._grammar.createSemantics();
        this._semantics.addOperation('eval', operation);
    }

    /**
     * Checks if the provided code respects the grammar. Returns generated errors for the "PROBLEMS" view 
     * @param text - source code
     */
    match(text: string): IMatchResult {
        let result: IMatchResult = {
            success: true
        }

        let match = this._grammar.match(text);
        if (match.failed()) {
            result.success = false;
            let errors: IError[] = [];
            if (match.shortMessage) {
                let parts = /Line (\d+), col (\d+): (.*)/g.exec(match.shortMessage);
                if (parts) {
                    let pos = {
                        line: parseInt(parts[1]) - 1,
                        character: parseInt(parts[2])
                    };
                    let error: IError = {
                        message: parts[3],
                        range: {
                            start: pos,
                            end: pos
                        }
                    }
                    errors.push(error);
                    result.errors = errors;
                }
            }
        }

        return result;
    }

    /**
     * Generates tokenized code for the upload. Provides local configuration properties if detected in the code.
     * @param text - source code
     */
    build(text: string): IParseResult | null {
        var check = this.match(text);
        if (!check.success) {
            return null;
        }

        let result: IParseResult = this._semantics(this._grammar.match(text)).eval();
        return result;
    }
}