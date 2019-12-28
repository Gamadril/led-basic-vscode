import { IError, IMatchResult, IParseResult } from './Common';

export class LEDBasicParser {
    private grammar: any;
    private semantics: any;

    constructor(ohmlib: any, grammar: string, operation: any) {
        this.grammar = ohmlib.grammar(grammar);
        this.semantics = this.grammar.createSemantics();
        this.semantics.addOperation('eval', operation);
    }

    /**
     * Checks if the provided code respects the grammar. Returns generated errors for the "PROBLEMS" view
     * @param text - source code
     */
    public match(text: string): IMatchResult {
        const result: IMatchResult = {
            success: true
        };

        const match = this.grammar.match(text);
        if (match.failed()) {
            result.success = false;
            const errors: IError[] = [];
            if (match.shortMessage) {
                const parts = /Line (\d+), col (\d+): (.*)/g.exec(match.shortMessage);
                if (parts) {
                    const pos = {
                        line: parseInt(parts[1], 10) - 1,
                        character: parseInt(parts[2], 10)
                    };
                    const error: IError = {
                        message: parts[3],
                        range: {
                            start: pos,
                            end: pos
                        }
                    };
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
    public build(text: string): IParseResult | null {
        const check = this.match(text);
        if (!check.success) {
            return null;
        }

        const result: IParseResult = this.semantics(this.grammar.match(text)).eval();
        return result;
    }
}
