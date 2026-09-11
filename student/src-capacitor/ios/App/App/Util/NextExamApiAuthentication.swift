import CryptoKit
import Foundation

/// Adds the HMAC proof required by the teacher /server/* API.
enum NextExamApiAuthentication {
    private static let NEXT_EXAM_API_SECRET = "NEXT-EXAM"

    static func apply(to request: inout URLRequest) {
        let timestamp = String(Int(Date().timeIntervalSince1970 * 1_000))
        for (name, value) in headers(timestamp: timestamp) {
            request.setValue(value, forHTTPHeaderField: name)
        }
    }

    static func headers(timestamp: String) -> [String: String] {
        let key = SymmetricKey(data: Data(NEXT_EXAM_API_SECRET.utf8))
        let mac = HMAC<SHA256>.authenticationCode(for: Data(timestamp.utf8), using: key)
        return [
            "x-next-exam-app-ts": timestamp,
            "x-next-exam-app-mac": Data(mac).base64EncodedString(),
        ]
    }
}
