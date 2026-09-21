"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicKey = exports.PrivateKey = exports.ECIES_CONFIG = void 0;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const utils_1 = require("@noble/ciphers/utils");
const config_js_1 = require("./config.js");
const index_js_1 = require("./keys/index.js");
const index_js_2 = require("./utils/index.js");
/**
 * Encrypts data with a receiver's public key.
 * @description
 * In version 0.4.18, `Buffer` is returned when available, otherwise `Uint8Array`.
 * From version 0.5.0, this function will always return `Uint8Array`.
 * To preserve the pre-0.5.0 behavior of returning a `Buffer`, wrap the result with `Buffer.from(encrypt(...))`.
 *
 * @param receiverRawPK - Raw public key of the receiver, either as a hex `string` or a `Uint8Array`.
 * @param data - Data to encrypt.
 * @returns Encrypted payload, format: `public key || encrypted`.
 */
function encrypt(receiverRawPK, data, config = config_js_1.ECIES_CONFIG) {
    const curve = config.ellipticCurve;
    const ephemeralSK = new index_js_1.PrivateKey(undefined, curve);
    const receiverPK = receiverRawPK instanceof Uint8Array
        ? new index_js_1.PublicKey(receiverRawPK, curve)
        : index_js_1.PublicKey.fromHex(receiverRawPK, curve);
    const sharedKey = ephemeralSK.encapsulate(receiverPK, config.isHkdfKeyCompressed);
    const ephemeralPK = ephemeralSK.publicKey.toBytes(config.isEphemeralKeyCompressed);
    const encrypted = (0, index_js_2.symEncrypt)(config, sharedKey, data);
    return (0, utils_1.concatBytes)(ephemeralPK, encrypted);
}
/**
 * Decrypts data with a receiver's private key.
 * @description
 * In version 0.4.18, `Buffer` is returned when available, otherwise `Uint8Array`.
 * From version 0.5.0, this function will always return `Uint8Array`.
 * To preserve the pre-0.5.0 behavior of returning a `Buffer`, wrap the result with `Buffer.from(decrypt(...))`.
 *
 * @param receiverRawSK - Raw private key of the receiver, either as a hex `string` or a `Uint8Array`.
 * @param data - Data to decrypt.
 * @returns Decrypted plain text.
 */
function decrypt(receiverRawSK, data, config = config_js_1.ECIES_CONFIG) {
    const curve = config.ellipticCurve;
    const receiverSK = receiverRawSK instanceof Uint8Array
        ? new index_js_1.PrivateKey(receiverRawSK, curve)
        : index_js_1.PrivateKey.fromHex(receiverRawSK, curve);
    const keySize = config.ephemeralKeySize;
    const ephemeralPK = new index_js_1.PublicKey(data.subarray(0, keySize), curve);
    const encrypted = data.subarray(keySize);
    const sharedKey = ephemeralPK.decapsulate(receiverSK, config.isHkdfKeyCompressed);
    return (0, index_js_2.symDecrypt)(config, sharedKey, encrypted);
}
var config_js_2 = require("./config.js");
Object.defineProperty(exports, "ECIES_CONFIG", { enumerable: true, get: function () { return config_js_2.ECIES_CONFIG; } });
var index_js_3 = require("./keys/index.js");
Object.defineProperty(exports, "PrivateKey", { enumerable: true, get: function () { return index_js_3.PrivateKey; } });
Object.defineProperty(exports, "PublicKey", { enumerable: true, get: function () { return index_js_3.PublicKey; } });
