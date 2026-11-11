import Foundation

/// iOS analog of the Electron main-process LanguageTool handlers
/// (ipchandler.js `startLanguageTool` / `isLanguageToolRunning`).
///
/// There is no bundled LT server on iOS, so these channels only talk to a
/// teacher-configured remote instance. `languagetool-check` proxies the
/// `/v2/check` POST through native URLSession so WKWebView CORS cannot block it.
final class LanguageToolHandler {

    static let shared = LanguageToolHandler()
    private let log = LoggingHandler.shared
    private init() {}

    private lazy var urlSession: URLSession = {
        let delegate = LocalNetworkSessionDelegate()
        return URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
    }()

    func register() {
        IPCBridge.shared.handle("isLanguageToolRunning") { [weak self] payload async throws -> Any? in
            guard let self else { throw IPCError.noHandler("isLanguageToolRunning: not initialized") }
            let opts = payload as? [String: Any]
            let running = await self.isReachable(host: opts?["host"] as? String, port: opts?["port"] as? String)
            return ["running": running]
        }

        IPCBridge.shared.handle("startLanguageTool") { [weak self] payload async throws -> Any? in
            guard let self else { throw IPCError.noHandler("startLanguageTool: not initialized") }
            let opts = payload as? [String: Any]
            return await self.isReachable(host: opts?["host"] as? String, port: opts?["port"] as? String)
        }

        IPCBridge.shared.handle("languagetool-check") { [weak self] payload async throws -> Any? in
            guard let self else { throw IPCError.noHandler("languagetool-check: not initialized") }
            guard let opts = payload as? [String: Any] else {
                throw IPCError.invalidPayload("languagetool-check: missing options")
            }
            return try await self.check(opts)
        }
    }

    /// Checks whether an LT server responds on the configured endpoint
    /// (mirrors the TCP port check in ipchandler.js).
    private func isReachable(host: String?, port: String?) async -> Bool {
        guard let url = ltURL(host: host, port: port, path: "/v2/check") else { return false }
        var request = URLRequest(url: url, timeoutInterval: 2.5)
        request.httpMethod = "GET"
        do {
            _ = try await urlSession.data(for: request)
            return true
        } catch {
            log?.warn("languagetool @ isReachable: \(error.localizedDescription)")
            return false
        }
    }

    /// Proxies the renderer's LanguageTool `/v2/check` POST (no CORS in URLSession).
    private func check(_ opts: [String: Any]) async throws -> [String: Any] {
        guard let body = opts["body"] as? [String: Any],
              let host = opts["host"] as? String,
              let port = opts["port"] as? String
        else {
            throw IPCError.invalidPayload("languagetool-check: missing host/port/body")
        }

        let logQuery = (opts["logQuery"] as? String) ?? ""
        guard let url = ltURL(host: host, port: port, path: "/v2/check\(logQuery)") else {
            throw IPCError.invalidPayload("languagetool-check: invalid URL")
        }

        var components = URLComponents()
        components.queryItems = body.map { URLQueryItem(name: $0.key, value: String(describing: $0.value)) }

        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.httpBody = components.query?.data(using: .utf8)

        let (data, response) = try await urlSession.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw IPCError.invalidPayload("languagetool-check: HTTP \(code)")
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw IPCError.invalidPayload("languagetool-check: invalid JSON response")
        }
        return json
    }

    /// Builds `http://host:port/path`, tolerating hosts with scheme or port
    /// (mirrors the host normalization in ipchandler.js `isLanguageToolRunning`).
    private func ltURL(host: String?, port: String?, path: String) -> URL? {
        let portInt = Int(port ?? "") ?? 8088
        var hostOnly = (host ?? "").trimmingCharacters(in: .whitespaces)
        hostOnly = hostOnly.replacingOccurrences(of: "^https?://", with: "", options: .regularExpression)
        hostOnly = hostOnly.components(separatedBy: "/")[0]
        if let colon = hostOnly.lastIndex(of: ":") {
            let afterColon = hostOnly[hostOnly.index(after: colon)...]
            if !afterColon.isEmpty && afterColon.allSatisfy(\.isNumber) {
                hostOnly = String(hostOnly[..<colon])
            }
        }
        if hostOnly.isEmpty { hostOnly = "localhost" }
        return URL(string: "http://\(hostOnly):\(portInt)\(path)")
    }
}
