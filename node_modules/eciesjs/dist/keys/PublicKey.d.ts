import { type EllipticCurve } from "../config.js";
import type { PrivateKey } from "./PrivateKey.js";
export declare class PublicKey {
    /**
     * Creates a `PublicKey` instance from a hexadecimal string.
     * @param hex - The hexadecimal string representing the public key.
     * @param curve - (optional) The elliptic curve to use (default: `ECIES_CONFIG.ellipticCurve`).
     * @returns A new `PublicKey` instance.
     */
    static fromHex(hex: string, curve?: EllipticCurve): PublicKey;
    private readonly data;
    private readonly dataUncompressed;
    private get _uncompressed();
    /**
     * Constructs a `PublicKey` instance from a byte array.
     * @param data - The byte array representing the public key (compressed or uncompressed if secp256k1).
     * @param curve - (optional) The elliptic curve to use (default: `ECIES_CONFIG.ellipticCurve`).
     */
    constructor(data: Uint8Array, curve?: EllipticCurve);
    /**
     * Converts the public key to bytes in compressed or uncompressed format.
     * @param compressed - (default: `true`) Whether to return the public key in compressed or uncompressed format (secp256k1 only).
     * @returns The public key as a Uint8Array.
     */
    toBytes(compressed?: boolean): Uint8Array;
    /**
     * Converts the public key to a hexadecimal string in compressed or uncompressed format.
     * @param compressed - (default: `true`) Whether to return the public key in compressed or uncompressed format (secp256k1 only).
     * @returns The public key as a hexadecimal string.
     */
    toHex(compressed?: boolean): string;
    /**
     * Derives a shared secret from receiver's private key (sk) and ephemeral public key (this).
     * Opposite of `encapsulate`.
     * @see PrivateKey.encapsulate
     *
     * @param sk - Receiver's private key.
     * @param compressed - (default: `false`) Whether to use compressed or uncompressed public keys in the key derivation (secp256k1 only).
     * @returns Shared secret, derived with HKDF-SHA256.
     */
    decapsulate(sk: PrivateKey, compressed?: boolean): Uint8Array;
    /**
     * Compares this public key with another for equality.
     * @param other - The other `PublicKey` to compare with.
     * @returns `true` if the public keys are equal, `false` otherwise.
     */
    equals(other: PublicKey): boolean;
}
