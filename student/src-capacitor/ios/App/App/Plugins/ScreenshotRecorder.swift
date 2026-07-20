import Foundation
import Capacitor
import WebKit

@objc(ScreenshotRecorder)
public class ScreenshotRecorder: CAPPlugin, CAPBridgedPlugin {
    public let identifier      = "ScreenshotPlugin"
    public let jsName          = "screenshot"
    public let pluginMethods: [CAPPluginMethod] = []
    
    public override func load() {
        IPCBridge.shared.handle("capture") { [weak self] _ throws -> String in
            guard let self else { throw PluginError.notInitialized }
            return try await self.capture()
        }
    }


    func capture() async throws -> String {
        try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.main.async { [weak self] in
                guard let self,
                      let webView = self.webView else {
                    continuation.resume(throwing: NSError(
                        domain: "ScreenshotPlugin",
                        code: -1,
                        userInfo: [NSLocalizedDescriptionKey: "WebView not available"]
                    ))
                    return
                }
                
                webView.takeSnapshot(with: WKSnapshotConfiguration()) { image, error in
                    if let error {
                        continuation.resume(throwing: error)
                        return
                    }
                    guard let image else {
                        continuation.resume(throwing: NSError(
                            domain: "ScreenshotPlugin",
                            code: -2,
                            userInfo: [NSLocalizedDescriptionKey: "Failed to render snapshot"]
                        ))
                        return
                    }
                    // Redraw without alpha to avoid iOS warning about opaque JPEG with alpha channel
                    let opaqueRenderer = UIGraphicsImageRenderer(size: image.size, format: {
                        let fmt = UIGraphicsImageRendererFormat()
                        fmt.opaque = true
                        return fmt
                    }())
                    let opaqueImage = opaqueRenderer.image { ctx in
                        image.draw(at: .zero)
                    }
                    guard let imageData = opaqueImage.jpegData(compressionQuality: 0.85) else {
                        continuation.resume(throwing: NSError(
                            domain: "ScreenshotPlugin",
                            code: -2,
                            userInfo: [NSLocalizedDescriptionKey: "Failed to render snapshot"]
                        ))
                        return
                    }
                    continuation.resume(returning: "data:image/jpeg;base64,\(imageData.base64EncodedString())")
                }
            }
        }
    }
}
