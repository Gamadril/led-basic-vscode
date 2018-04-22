# LED Basic extension changelog

## 1.0.1 - 22.04.2018
- Added device selection in the status bar
- Improved code completion suggesting only functions supported by selected device
- Improved code validation. Function calls not supported by currently selected device will be reported in the problems view
- Bugfix: added missing `phex` and `pdez` commands

## 1.0.0 - 20.04.2018
- Initial release
- LED Basic V15.1.14 support
- Basic Syntax highlighting
- Two code snippets `for` and `ford` for generating a `for-to-next` and `for-downto-next` blocks
- Smart Bracket support for function calls
- Shows information about symbol that's below the mouse cursor
- Code completion support
- Intial diagnostics support based on code validation using language grammar parser
- Shows details about function signatures
- Shows definition of labels allowing direct jumps to label definition by clicking on the label number in goto/gosub statement
- Shows all references to a label in the code