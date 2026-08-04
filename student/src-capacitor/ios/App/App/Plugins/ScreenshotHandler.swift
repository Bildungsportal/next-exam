import Foundation
import CryptoKit

/// Periodic screenshot capture and upload to teacher server.
/// iOS equivalent of `src/utils/screenshotCapture.js`.
final class ScreenshotHandler {

    static let shared = ScreenshotHandler()
    private let log = LoggingHandler.shared
    private init() {}

    // MARK: - State

    private weak var multicastClient: MulticastClient?
    private var scheduler: SchedulerService?
    private var consecutiveFailures = 0
    private let maxConsecutiveFailures = 5

    private lazy var urlSession: URLSession = {
        let delegate = LocalNetworkSessionDelegate()
        return URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
    }()

    // MARK: - Public API

    func initialize(multicastClient: MulticastClient) {
        self.multicastClient = multicastClient

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onScreenshotConfig(_:)),
            name: Notification.Name("screenshot-config"),
            object: nil
        )
        log?.info("screenshotCapture @ initialize")
    }

    deinit {
        scheduler?.stop()
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Config Handling

    @objc private func onScreenshotConfig(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let intervalMs = userInfo["screenshotinterval"] as? Int,
              let serverip = userInfo["serverip"] as? String, !serverip.isEmpty
        else {
            stop()
            return
        }
        applyConfig(intervalMs: intervalMs)
    }

    /// Called by CommunicationHandler when screenshotinterval changes.
    func applyConfig(intervalMs: Int) {
        scheduler?.stop()
        scheduler = nil
        consecutiveFailures = 0

        guard intervalMs > 0 else {
            log?.info("screenshotCapture @ applyConfig: interval disabled")
            return
        }


        guard let mc = multicastClient
        else {
            log?.info("screenshotCapture @ applyConfig: no mc, skip")
            return
        }

        log?.info("screenshotCapture @ applyConfig: mc.clientinfo.serverip = \(mc.clientinfo.serverip)")

        guard let serverip = mc.clientinfo.serverip, !serverip.isEmpty
        else {
            log?.info("screenshotCapture @ applyConfig: no serverip, skip")
            return
        }

        log?.info("screenshotCapture @ applyConfig: starting interval \(intervalMs) ms")
        scheduler = SchedulerService(
            action: { [weak self] in await self?.tick() },
            intervalMs: Double(intervalMs)
        )
        scheduler?.start()
    }

    func stop() {
        scheduler?.stop()
        scheduler = nil
        consecutiveFailures = 0
    }

    // MARK: - Capture & Upload Tick

    private func tick() async {
        guard let mc = multicastClient,
              let serverip = mc.clientinfo.serverip, !serverip.isEmpty,
              !mc.clientinfo.localLockdown
        else { return }

        do {
            // Capture screenshot via ScreenshotPlugin's IPCBridge handler
            guard let result = try await IPCBridge.shared.dispatchInvoke("capture", payload: nil) as? String else {
                handleFailure("capture returned nil")
                return
            }

            // result is "data:image/jpeg;base64,<base64data>"
            guard let base64 = result.split(separator: ",").last.map(String.init) else {
                handleFailure("invalid capture format")
                return
            }

            guard let imageData = Data(base64Encoded: base64) else {
                handleFailure("base64 decode failed")
                return
            }

            // SHA-256 hash
            let hash = SHA256.hash(data: imageData)
            let screenshothash = hash.compactMap { String(format: "%02x", $0) }.joined()

            let token = mc.clientinfo.token ?? "unknown"
            let payload: [String: Any] = [
                "clientinfo": mc.clientinfo.asDictionary,
                "screenshot": base64,
                "screenshothash": screenshothash,
                "screenshotfilename": "\(token).jpg"
            ]

            // Upload
            guard let url = URL(string: "https://\(serverip):\(Config.serverApiPort)/server/control/updatescreenshot") else {
                handleFailure("invalid URL")
                return
            }

            var request = URLRequest(url: url, timeoutInterval: 15)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("NEXT_EXAM_API_SECRET", forHTTPHeaderField: "x-next-exam-app-secret")
            request.setValue("Bearer "+(self.multicastClient?.clientinfo.token ?? ""), forHTTPHeaderField: "Authorization")
            if let t = mc.clientinfo.token {
                request.setValue("Bearer \(t)", forHTTPHeaderField: "Authorization")
            }
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)

            let (_, response) = try await urlSession.data(for: request)

            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                consecutiveFailures = 0
            } else {
                let code = (response as? HTTPURLResponse)?.statusCode ?? -1
                handleFailure("upload response \(code)")
            }

        } catch {
            handleFailure(error.localizedDescription)
        }
    }

    private func handleFailure(_ reason: String) {
        consecutiveFailures += 1
        log?.warn("screenshotCapture @ tick: \(reason) (\(consecutiveFailures)/\(maxConsecutiveFailures))")
        if consecutiveFailures >= maxConsecutiveFailures {
            scheduler?.stop()
            scheduler = nil
            log?.warn("screenshotCapture @ tick: paused after \(maxConsecutiveFailures) consecutive failures")
        }
    }
}
