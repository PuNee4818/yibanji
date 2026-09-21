import type { Config } from "../config.js";
export declare const symEncrypt: (config: Config, key: Uint8Array, plainText: Uint8Array, AAD?: Uint8Array) => Uint8Array;
export declare const symDecrypt: (config: Config, key: Uint8Array, cipherText: Uint8Array, AAD?: Uint8Array) => Uint8Array;
