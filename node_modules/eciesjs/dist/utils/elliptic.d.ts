import type { EllipticCurve } from "../config.js";
export declare const getValidSecret: (curve: EllipticCurve) => Uint8Array;
export declare const isValidPrivateKey: (curve: EllipticCurve, secret: Uint8Array) => boolean;
export declare const getPublicKey: (curve: EllipticCurve, secret: Uint8Array) => Uint8Array;
export declare const getSharedPoint: (curve: EllipticCurve, sk: Uint8Array, pk: Uint8Array, compressed?: boolean) => Uint8Array;
export declare const convertPublicKeyFormat: (curve: EllipticCurve, pk: Uint8Array, compressed: boolean) => Uint8Array;
export declare const hexToPublicKey: (curve: EllipticCurve, hex: string) => Uint8Array;
