import { AstroFrontmatterStatus, type ConvertToTsxResult, type ExtractedScript, type ExtractedStyle } from '@astrojs/astro2tsx';
import type { CodeMapping } from '@volar/language-core';
import { Range } from '@volar/language-server';
export interface LSPTSXRanges {
    frontmatter: Range;
    body: Range;
    scripts: ExtractedScript[];
    styles: ExtractedStyle[];
    generatedComponentExport?: Range;
}
export declare function safeConvertToTSX(content: string, options: {
    filename?: string;
}): ConvertToTsxResult;
export declare function getTSXRangesAsLSPRanges(tsx: ConvertToTsxResult): LSPTSXRanges;
export declare function astro2tsx(input: string, fileName: string): {
    virtualCode: {
        id: string;
        languageId: string;
        snapshot: {
            getText: (start: number, end: number) => string;
            getLength: () => number;
            getChangeRange: () => undefined;
        };
        mappings: CodeMapping[];
        embeddedCodes: never[];
    };
    diagnostics: import("@astrojs/astro2tsx").AstroDiagnostic[];
    ranges: {
        generatedComponentExport: Range | undefined;
        frontmatter: Range;
        body: Range;
        scripts: ExtractedScript[];
        styles: ExtractedStyle[];
    };
    frontmatterStatus: AstroFrontmatterStatus;
    frontmatterSource: import("@astrojs/astro2tsx").Range;
};
