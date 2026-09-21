"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hexToPublicKey = exports.convertPublicKeyFormat = exports.getSharedPoint = exports.getPublicKey = exports.isValidPrivateKey = exports.getValidSecret = void 0;
const webcrypto_1 = require("@noble/ciphers/webcrypto");
const ed25519_1 = require("@noble/curves/ed25519");
const secp256k1_1 = require("@noble/curves/secp256k1");
const consts_js_1 = require("../consts.js");
const hex_js_1 = require("./hex.js");
const getValidSecret = (curve) => {
    let key;
    do {
        key = (0, webcrypto_1.randomBytes)(consts_js_1.SECRET_KEY_LENGTH);
    } while (!(0, exports.isValidPrivateKey)(curve, key));
    return key;
};
exports.getValidSecret = getValidSecret;
const isValidPrivateKey = (curve, secret) => 
// on secp256k1: only key ∈ (0, group order) is valid
// on curve25519: any 32-byte key is valid
_exec(curve, (curve) => curve.utils.isValidSecretKey(secret), () => true, () => true);
exports.isValidPrivateKey = isValidPrivateKey;
const getPublicKey = (curve, secret) => _exec(curve, (curve) => curve.getPublicKey(secret), (curve) => curve.getPublicKey(secret), (curve) => curve.getPublicKey(secret));
exports.getPublicKey = getPublicKey;
const getSharedPoint = (curve, sk, pk, compressed) => _exec(curve, (curve) => curve.getSharedSecret(sk, pk, compressed), (curve) => curve.getSharedSecret(sk, pk), (curve) => getSharedPointOnEd25519(curve, sk, pk));
exports.getSharedPoint = getSharedPoint;
const convertPublicKeyFormat = (curve, pk, compressed) => 
// only for secp256k1
_exec(curve, (curve) => curve.getSharedSecret(Uint8Array.from(Array(31).fill(0).concat([1])), // 1 as private key
pk, compressed), () => pk, () => pk);
exports.convertPublicKeyFormat = convertPublicKeyFormat;
const hexToPublicKey = (curve, hex) => {
    const decoded = (0, hex_js_1.decodeHex)(hex);
    return _exec(curve, () => compatEthPublicKey(decoded), () => decoded, () => decoded);
};
exports.hexToPublicKey = hexToPublicKey;
function _exec(curve, secp256k1Callback, x25519Callback, ed25519Callback) {
    const _curve = curve;
    /* v8 ignore else -- @preserve */
    if (_curve === "secp256k1") {
        return secp256k1Callback(secp256k1_1.secp256k1);
    }
    else if (_curve === "x25519") {
        return x25519Callback(ed25519_1.x25519);
    }
    else if (_curve === "ed25519") {
        return ed25519Callback(ed25519_1.ed25519);
    }
    else {
        throw new Error("Not implemented");
    }
}
const compatEthPublicKey = (pk) => {
    if (pk.length === consts_js_1.ETH_PUBLIC_KEY_SIZE) {
        const fixed = new Uint8Array(1 + pk.length);
        fixed.set([0x04]);
        fixed.set(pk, 1);
        return fixed;
    }
    return pk;
};
const getSharedPointOnEd25519 = (curve, sk, pk) => {
    // Note: scalar is hashed from sk
    const { scalar } = curve.utils.getExtendedPublicKey(sk);
    const point = curve.Point.fromBytes(pk).multiply(scalar);
    return point.toBytes();
};
