import Foundation

enum SecurePayloadError: LocalizedError {
    case invalidKeyEncoding
    case jsonSerializationFailed

    var errorDescription: String? {
        switch self {
        case .invalidKeyEncoding:      return "Failed to encode the session key as UTF-8."
        case .jsonSerializationFailed: return "Failed to JSON-serialize the payload."
        }
    }
}
