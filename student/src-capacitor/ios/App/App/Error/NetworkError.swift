import Foundation

enum NetworkError: LocalizedError {
    case notConnected
    case ipUnavailable

    var errorDescription: String? {
        switch self {
            case .notConnected:  return "Not connected to the Internet"
            case .ipUnavailable: return "IP address unavailable"
        }
    }
}
