import { type LSPTSXRanges } from './astro2tsx.js';
export type AstroMetadata = {
    frontmatter: FrontmatterStatus;
    tsxRanges: LSPTSXRanges;
};
export interface Point {
    /** 1-based. */
    line: number;
    /** 1-based. */
    column: number;
    offset: number;
}
interface FrontmatterOpen {
    status: 'open';
    position: {
        start: Point;
        end: undefined;
    };
}
interface FrontmatterClosed {
    status: 'closed';
    position: {
        start: Point;
        end: Point;
    };
}
interface FrontmatterNull {
    status: 'doesnt-exist';
    position: undefined;
}
export type FrontmatterStatus = FrontmatterOpen | FrontmatterClosed | FrontmatterNull;
export declare function getFrontmatterStatus(status: 'closed' | 'open' | 'doesnt-exist', source: {
    start: number;
    end: number;
}, input: string): FrontmatterStatus;
export declare function getAstroMetadata(fileName: string, input: string): Omit<AstroMetadata, 'tsxRanges'>;
export {};
