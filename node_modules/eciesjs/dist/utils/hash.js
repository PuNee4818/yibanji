"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSharedKey = exports.deriveKey = void 0;
const utils_1 = require("@noble/ciphers/utils");
const hkdf_1 = require("@noble/hashes/hkdf");
const sha2_1 = require("@noble/hashes/sha2");
const deriveKey = (master, salt, info) => 
// 32 bytes shared secret for aes256 and xchacha20 derived from HKDF-SHA256
(0, hkdf_1.hkdf)(sha2_1.sha256, master, salt, info, 32);
exports.deriveKey = deriveKey;
const getSharedKey = (...parts) => (0, exports.deriveKey)((0, utils_1.concatBytes)(...parts));
exports.getSharedKey = getSharedKey;
