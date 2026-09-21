"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateKey = void 0;
const utils_1 = require("@noble/ciphers/utils");
const config_js_1 = require("../config.js");
const index_js_1 = require("../utils/index.js");
const PublicKey_js_1 = require("./PublicKey.js");
class PrivateKey {
    /**
     * Creates a `PrivateKey` instance from a hexadecimal string.
     * @param hex - The hexadecimal string representing the private key.
     * @param curve - (optional) The elliptic curve to use (default: `ECIES_CONFIG.ellipticCurve`).
     * @returns A new `PrivateKey` instance.
     */
    static fromHex(hex, curve = config_js_1.ECIES_CONFIG.ellipticCurve) {
        return new PrivateKey((0, index_js_1.decodeHex)(hex), curve);
    }
    /**
     * @description
     * In version 0.4.18, `Buffer` is returned when available, otherwise `Uint8Array`.
     * From version 0.5.0, `Uint8Array` is returned instead of `Buffer`.
     */
    get secret() {
        return this.data;
    }
    /**
     * Constructs a `PrivateKey` instance from a byte array or generates a new random private key if no argument is provided.
     * @param secret - (optional) The byte array representing the private key. If not provided, a new random private key will be generated.
     * @param curve - (optional) The elliptic curve to use (default: `ECIES_CONFIG.ellipticCurve`).
     * @throws Will throw an error if the provided `secret` is not a valid private key for the specified curve.
     */
    constructor(secret, curve = config_js_1.ECIES_CONFIG.ellipticCurve) {
        this.curve = curve;
        if (secret === undefined) {
            this.data = (0, index_js_1.getValidSecret)(curve);
        }
        else if ((0, index_js_1.isValidPrivateKey)(curve, secret)) {
            this.data = secret;
        }
        else {
            throw new Error("Invalid private key");
        }
        this.publicKey = new PublicKey_js_1.PublicKey((0, index_js_1.getPublicKey)(curve, this.data), curve);
    }
    /**
     * Converts the private key to a hexadecimal string.
     * @returns The private key as a hexadecimal string.
     */
    toHex() {
        return (0, utils_1.bytesToHex)(this.data);
    }
    /**
     * Derives a shared secret from ephemeral private key (this) and receiver's public key (pk).
     * @description The shared key is 32 bytes, derived with `HKDF-SHA256(senderPoint || sharedPoint)`. See implementation for details.
     *
     * There are some variations in different ECIES implementations:
     * which key derivation function to use, compressed or uncompressed `senderPoint`/`sharedPoint`, whether to include `senderPoint`, etc.
     *
     * Because the entropy of `senderPoint`, `sharedPoint` is enough high[1], we don't need salt to derive keys.
     *
     * [1]: Two reasons: the public keys are "random" bytes (albeit secp256k1 public keys are **not uniformly** random), and ephemeral keys are generated in every encryption.
     *
     * @param pk - Receiver's public key.
     * @param compressed - (default: `false`) Whether to use compressed or uncompressed public keys in the key derivation (secp256k1 only).
     * @returns Shared secret, derived with HKDF-SHA256.
     */
    encapsulate(pk, compressed = false) {
        const senderPoint = this.publicKey.toBytes(compressed);
        const sharedPoint = this.multiply(pk, compressed);
        return (0, index_js_1.getSharedKey)(senderPoint, sharedPoint);
    }
    /**
     * Multiplies the private key with a public key to derive a shared point.
     * @param pk - The public key to multiply with.
     * @param compressed - (default: `false`) Whether to use compressed or uncompressed public keys (secp256k1 only).
     * @returns The shared point as a Uint8Array.
     */
    multiply(pk, compressed = false) {
        return (0, index_js_1.getSharedPoint)(this.curve, this.data, pk.toBytes(true), compressed);
    }
    /**
     * Compares this private key with another for equality.
     * @param other - The other `PrivateKey` to compare with.
     * @returns `true` if the private keys are equal, `false` otherwise.
     */
    equals(other) {
        return (0, utils_1.equalBytes)(this.data, other.data);
    }
}
exports.PrivateKey = PrivateKey;
