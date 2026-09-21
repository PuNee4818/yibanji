import type { TextEdit } from 'vscode-html-languageservice';
import type { AstroVirtualCode } from '../../core/index.js';
export declare function isComponentImportSource(source: string | undefined): source is string;
export declare function stripAstroComponentSuffix(name: string): string;
export declare function rewriteComponentImportText(text: string): string;
export declare function getAlreadyImportedComponentSources(ts: typeof import('typescript'), documentText: string): Set<string>;
export declare function mapEdit(edit: TextEdit, code: AstroVirtualCode, languageId: string): TextEdit;
