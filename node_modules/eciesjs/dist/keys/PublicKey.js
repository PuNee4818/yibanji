"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicKey = void 0;
const utils_1 = require("@noble/ciphers/utils");
const config_js_1 = require("../config.js");
const index_js_1 = require("../utils/index.js");
class PublicKey {
    /**
     * Creates a `PublicKey` instance from a hexadecimal string.
     * @param hex - The hexadecimal string representing the public key.
     * @param curve - (optional) The elliptic curve to use (default: `ECIES_CONFIG.ellipticCurve`).
     * @returns A new `PublicKey` instance.
     */
    static fromHex(hex, curve = config_js_1.ECIES_CONFIG.ellipticCurve) {
        return new PublicKey((0, index_js_1.hexToPublicKey)(curve, hex), curve);
    }
    get _uncompressed() {
        return this.dataUncompressed !== null ? this.dataUncompressed : this.data;
    }
    /**
     * Constructs a `PublicKey` instance from a byte array.
     * @param data - The byte array representing the public key (compressed or uncompressed if secp256k1).
     * @param curve - (optional) The elliptic curve to use (default: `ECIES_CONFIG.ellipticCurve`).
     */
    constructor(data, curve = config_js_1.ECIES_CONFIG.ellipticCurve) {
        // data can be either compressed or uncompressed if secp256k1
        const compressed = (0, index_js_1.convertPublicKeyFormat)(curve, data, true);
        const uncompressed = (0, index_js_1.convertPublicKeyFormat)(curve, data, false);
        this.data = compressed;
        this.dataUncompressed = compressed.length !== uncompressed.length ? uncompressed : null;
    }
    /**
     * Converts the public key to bytes in compressed or uncompressed format.
     * @param compressed - (default: `true`) Whether to return the public key in compressed or uncompressed format (secp256k1 only).
     * @returns The public key as a Uint8Array.
     */
    toBytes(compressed = true) {
        return compressed ? this.data : this._uncompressed;
    }
    /**
     * Converts the public key to a hexadecimal string in compressed or uncompressed format.
     * @param compressed - (default: `true`) Whether to return the public key in compressed or uncompressed format (secp256k1 only).
     * @returns The public key as a hexadecimal string.
     */
    toHex(compressed = true) {
        return (0, utils_1.bytesToHex)(this.toBytes(compressed));
    }
    /**
     * Derives a shared secret from receiver's private key (sk) and ephemeral public key (this).
     * Opposite of `encapsulate`.
     * @see PrivateKey.encapsulate
     *
     * @param sk - Receiver's private key.
     * @param compressed - (default: `false`) Whether to use compressed or uncompressed public keys in the key derivation (secp256k1 only).
     * @returns Shared secret, derived with HKDF-SHA256.
     */
    decapsulate(sk, compressed = false) {
        const senderPoint = this.toBytes(compressed);
        const sharedPoint = sk.multiply(this, compressed);
        return (0, index_js_1.getSharedKey)(senderPoint, sharedPoint);
    }
    /**
     * Compares this public key with another for equality.
     * @param other - The other `PublicKey` to compare with.
     * @returns `true` if the public keys are equal, `false` otherwise.
     */
    equals(other) {
        return (0, utils_1.equalBytes)(this.data, other.data);
    }
}
exports.PublicKey = PublicKey;
