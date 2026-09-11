import Foundation

struct EncryptedPacket {
    /// Base64-encoded 12-byte random IV (nonce)
    let v: String
    /// Base64-encoded ciphertext + 16-byte AES-GCM authentication tag
    let d: String

    var asDictionary: [String: String] { ["v": v, "d": d] }
}
