import Foundation

enum PluginError: LocalizedError {
    case notInitialized

    var errorDescription: String? {
        switch self {
            case .notInitialized:  return "Plugin is not notInitialized"
        }
    }
}
