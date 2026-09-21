"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.symDecrypt = exports.symEncrypt = void 0;
const aes_1 = require("@ecies/ciphers/aes");
const chacha_1 = require("@ecies/ciphers/chacha");
const utils_1 = require("@noble/ciphers/utils");
const webcrypto_1 = require("@noble/ciphers/webcrypto");
const consts_js_1 = require("../consts.js");
const symEncrypt = (config, key, plainText, AAD) => _exec(_encrypt, config, key, plainText, AAD);
exports.symEncrypt = symEncrypt;
const symDecrypt = (config, key, cipherText, AAD) => _exec(_decrypt, config, key, cipherText, AAD);
exports.symDecrypt = symDecrypt;
function _exec(callback, config, key, data, AAD) {
    const algorithm = config.symmetricAlgorithm;
    if (algorithm === "aes-256-gcm") {
        return callback(aes_1.aes256gcm, key, data, config.symmetricNonceLength, consts_js_1.AEAD_TAG_LENGTH, AAD);
    }
    else if (algorithm === "xchacha20") {
        return callback(chacha_1.xchacha20, key, data, consts_js_1.XCHACHA20_NONCE_LENGTH, consts_js_1.AEAD_TAG_LENGTH, AAD);
    }
    else {
        throw new Error("Not implemented");
    }
}
function _encrypt(func, key, data, nonceLength, tagLength, AAD) {
    const nonce = (0, webcrypto_1.randomBytes)(nonceLength);
    const cipher = func(key, nonce, AAD);
    // @noble/ciphers format: cipherText || tag
    const encrypted = cipher.encrypt(data);
    const cipherTextLength = encrypted.length - tagLength;
    const cipherText = encrypted.subarray(0, cipherTextLength);
    const tag = encrypted.subarray(cipherTextLength);
    // ecies payload format: pk || nonce || tag || cipherText
    return (0, utils_1.concatBytes)(nonce, tag, cipherText);
}
function _decrypt(func, key, data, nonceLength, tagLength, AAD) {
    const nonce = data.subarray(0, nonceLength);
    const cipher = func(key, Uint8Array.from(nonce), AAD); // to reset byteOffset
    const encrypted = data.subarray(nonceLength);
    const tag = encrypted.subarray(0, tagLength);
    const cipherText = encrypted.subarray(tagLength);
    return cipher.decrypt((0, utils_1.concatBytes)(cipherText, tag));
}
