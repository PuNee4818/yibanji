"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFrontmatterStatus = getFrontmatterStatus;
exports.getAstroMetadata = getAstroMetadata;
const astro2tsx_js_1 = require("./astro2tsx.js");
function pointAt(input, offset) {
    let line = 1;
    let lineStart = 0;
    for (let index = 0; index < offset && index < input.length; index++) {
        if (input[index] === '\n') {
            line++;
            lineStart = index + 1;
        }
    }
    return { line, column: offset - lineStart + 1, offset };
}
function getFrontmatterStatus(status, source, input) {
    switch (status) {
        case 'closed':
            return {
                status: 'closed',
                position: { start: pointAt(input, source.start), end: pointAt(input, source.end) },
            };
        case 'open':
            return {
                status: 'open',
                position: { start: pointAt(input, source.start), end: undefined },
            };
        case 'doesnt-exist':
            return { status: 'doesnt-exist', position: undefined };
    }
}
function getAstroMetadata(fileName, input) {
    const tsx = (0, astro2tsx_js_1.astro2tsx)(input, fileName);
    return {
        frontmatter: getFrontmatterStatus(tsx.frontmatterStatus, tsx.frontmatterSource, input),
    };
}
//# sourceMappingURL=parseAstro.js.map