"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ECIES_CONFIG = exports.Config = void 0;
const consts_js_1 = require("./consts.js");
class Config {
    constructor() {
        this.ellipticCurve = "secp256k1";
        this.isEphemeralKeyCompressed = false; // secp256k1 only
        this.isHkdfKeyCompressed = false; // secp256k1 only
        this.symmetricAlgorithm = "aes-256-gcm";
        this.symmetricNonceLength = 16; // aes-256-gcm only
    }
    get ephemeralKeySize() {
        const mapping = {
            secp256k1: this.isEphemeralKeyCompressed
                ? consts_js_1.COMPRESSED_PUBLIC_KEY_SIZE
                : consts_js_1.UNCOMPRESSED_PUBLIC_KEY_SIZE,
            x25519: consts_js_1.CURVE25519_PUBLIC_KEY_SIZE,
            ed25519: consts_js_1.CURVE25519_PUBLIC_KEY_SIZE,
        };
        /* v8 ignore else -- @preserve */
        if (this.ellipticCurve in mapping) {
            return mapping[this.ellipticCurve];
        }
        else {
            throw new Error("Not implemented");
        }
    }
}
exports.Config = Config;
exports.ECIES_CONFIG = new Config();
