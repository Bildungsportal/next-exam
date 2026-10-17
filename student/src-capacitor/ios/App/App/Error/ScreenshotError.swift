import Foundation

enum ScreenshotError: LocalizedError {
    case failedToRender

    var errorDescription: String? {
        switch self {
            case .failedToRender:  return "Failed to render snapshot"
        }
    }
}
