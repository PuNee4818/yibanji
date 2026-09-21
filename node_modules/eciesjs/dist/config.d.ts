export type EllipticCurve = "secp256k1" | "x25519" | "ed25519";
export type SymmetricAlgorithm = "aes-256-gcm" | "xchacha20";
export type NonceLength = 12 | 16;
export declare class Config {
    ellipticCurve: EllipticCurve;
    isEphemeralKeyCompressed: boolean;
    isHkdfKeyCompressed: boolean;
    symmetricAlgorithm: SymmetricAlgorithm;
    symmetricNonceLength: NonceLength;
    get ephemeralKeySize(): number;
}
export declare const ECIES_CONFIG: Config;
