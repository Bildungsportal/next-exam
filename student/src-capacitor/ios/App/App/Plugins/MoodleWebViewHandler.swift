import Foundation
import UIKit
import WebKit

/// Hosts Moodle in a native WKWebView because iOS does not support Electron's webview tag.
final class MoodleWebViewHandler: NSObject, WKNavigationDelegate, WKUIDelegate {

    static let shared = MoodleWebViewHandler()

    private weak var controller: MainViewController?
    private var moodleWebView: WKWebView?
    private var moodleDomain = ""
    private var moodleTestId = ""
    private var handlersRegistered = false

    private override init() {}

    /// Registers Moodle IPC handlers and stores the Capacitor view controller.
    func initialize(controller: MainViewController) {
        self.controller = controller
        guard !handlersRegistered else { return }
        handlersRegistered = true

        IPCBridge.shared.handle("open-moodle") { [weak self] payload in
            guard let self else { throw PluginError.notInitialized }
            return try await self.open(payload: payload)
        }
        IPCBridge.shared.handle("reload-moodle") { [weak self] _ in
            guard let self else { throw PluginError.notInitialized }
            await MainActor.run { self.moodleWebView?.reload() }
            return ["status": "success"]
        }
        IPCBridge.shared.handle("close-moodle") { [weak self] _ in
            guard let self else { throw PluginError.notInitialized }
            await MainActor.run { self.close() }
            return ["status": "success"]
        }
    }

    /// Creates the native webview in the renderer placeholder and loads Moodle.
    private func open(payload: Any?) async throws -> [String: String] {
        guard
            let args = payload as? [String: Any],
            let urlString = args["url"] as? String,
            let url = URL(string: urlString),
            let normalizedDomain = normalizedHost(args["moodleDomain"] as? String ?? "")
        else {
            throw IPCError.invalidPayload("Moodle URL required")
        }

        let testId: String
        if let value = args["moodleTestId"] as? NSNumber {
            testId = value.stringValue
        } else {
            testId = (args["moodleTestId"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        }
        guard isNavigationAllowed(url, moodleDomain: normalizedDomain, moodleTestId: testId) else {
            throw IPCError.invalidPayload("Moodle URL is not allowed")
        }

        await MainActor.run {
            self.close()
            self.moodleDomain = normalizedDomain
            self.moodleTestId = testId

            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            let webView = WKWebView(frame: self.nativeFrame(from: args["frame"]), configuration: configuration)
            webView.navigationDelegate = self
            webView.uiDelegate = self
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            webView.isHidden = true

            self.controller?.view.addSubview(webView)
            self.moodleWebView = webView
            webView.load(URLRequest(url: url))
        }

        return ["status": "success"]
    }

    /// Converts the Vue placeholder rectangle into native view coordinates.
    @MainActor private func nativeFrame(from payload: Any?) -> CGRect {
        guard
            let frame = payload as? [String: Any],
            let x = frame["x"] as? NSNumber,
            let y = frame["y"] as? NSNumber,
            let width = frame["width"] as? NSNumber,
            let height = frame["height"] as? NSNumber,
            let controller,
            let sourceView = controller.webView
        else {
            return controller?.view.bounds ?? .zero
        }

        let webFrame = CGRect(
            x: x.doubleValue,
            y: y.doubleValue,
            width: width.doubleValue,
            height: height.doubleValue
        )
        return sourceView.convert(webFrame, to: controller.view)
    }

    /// Removes the native Moodle view and its navigation state.
    @MainActor private func close() {
        moodleWebView?.stopLoading()
        moodleWebView?.navigationDelegate = nil
        moodleWebView?.uiDelegate = nil
        moodleWebView?.removeFromSuperview()
        moodleWebView = nil
    }

    /// Normalizes a configured DNS host and rejects URLs, credentials, ports and malformed labels.
    private func normalizedHost(_ value: String) -> String? {
        let host = value.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "."))
            .lowercased()
        guard !host.isEmpty, host.count <= 253, !host.contains("://") else { return nil }
        let allowed = CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789-.")
        guard host.rangeOfCharacter(from: allowed.inverted) == nil else { return nil }
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        guard labels.count >= 2, labels.allSatisfy({
            !$0.isEmpty && $0.count <= 63 && $0.first != "-" && $0.last != "-"
        }) else { return nil }
        return host
    }

    private func host(_ host: String, matches domain: String) -> Bool {
        host == domain || host.hasSuffix("." + domain)
    }

    private func hasExactQueryValue(_ components: URLComponents, value: String) -> Bool {
        guard !value.isEmpty else { return false }
        let allowedNames: Set<String> = ["id", "cmid", "quizid", "attempt"]
        return components.queryItems?.contains {
            allowedNames.contains($0.name.lowercased()) && $0.value == value
        } == true
    }

    private func isNavigationAllowed(
        _ url: URL,
        moodleDomain: String,
        moodleTestId: String
    ) -> Bool {
        guard
            url.scheme?.lowercased() == "https",
            url.user == nil,
            url.password == nil,
            url.port == nil || url.port == 443,
            let rawHost = url.host,
            let targetHost = normalizedHost(rawHost),
            let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return false }

        let encodedPath = components.percentEncodedPath.lowercased()
        guard
            !encodedPath.contains("%2f"),
            !encodedPath.contains("%5c"),
            !encodedPath.contains("\\"),
            !url.path.split(separator: "/").contains("..")
        else { return false }

        let path = url.path.lowercased()
        let moodleHosts = [moodleDomain, "eduvidual.at", "lms.at"]
        let isMoodleHost = moodleHosts.contains { host(targetHost, matches: $0) }
        if isMoodleHost {
            let quizPaths: Set<String> = [
                "/mod/quiz/view.php", "/mod/quiz/attempt.php", "/mod/quiz/startattempt.php",
                "/mod/quiz/processattempt.php", "/mod/quiz/summary.php", "/mod/quiz/review.php",
                "/mod/assign/view.php", "/course/view.php"
            ]
            if quizPaths.contains(path), hasExactQueryValue(components, value: moodleTestId) { return true }

            let exactPaths: Set<String> = ["/login/index.php", "/login/logout.php", "/user/policy.php"]
            if exactPaths.contains(path) { return true }
            if path.hasPrefix("/auth/") || path.hasPrefix("/admin/tool/policy/") { return true }
        }

        let isTirolAuthHost = host(targetHost, matches: "portal.tirol.gv.at")
            || host(targetHost, matches: "tirol.gv.at")
        if isTirolAuthHost, path.hasPrefix("/saml2/") || path.hasPrefix("/login") { return true }
        return false
    }

    /// Allows only normalized HTTPS Moodle and authentication URLs.
    private func isNavigationAllowed(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString), let domain = normalizedHost(moodleDomain) else { return false }
        return isNavigationAllowed(url, moodleDomain: domain, moodleTestId: moodleTestId)
    }

    /// Cancels navigation outside the same Eduvidual allowlist used by Electron.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let targetUrl = navigationAction.request.url?.absoluteString else {
            decisionHandler(.cancel)
            return
        }
        if isNavigationAllowed(targetUrl) {
            decisionHandler(.allow)
        } else {
            print("Moodle navigation blocked: \(targetUrl)")
            decisionHandler(.cancel)
        }
    }

    /// Opens allowed target-blank links in the existing Moodle webview.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        guard
            navigationAction.targetFrame == nil,
            let targetUrl = navigationAction.request.url?.absoluteString,
            isNavigationAllowed(targetUrl)
        else {
            return nil
        }
        webView.load(navigationAction.request)
        return nil
    }

    /// Applies the same Moodle layout cleanup as Electron, then shows the page.
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let script = """
        (() => {
            if (document.getElementById('next-exam-moodle-style')) return;
            const style = document.createElement('style');
            style.id = 'next-exam-moodle-style';
            style.textContent = `
                * { transition: .1s !important; }
                .branding { display: none !important; }
                #header { display: none !important; }
                .drawer-left-toggle { display: none !important; }
                .drawer.drawer-right { top: 0 !important; height: 100% !important; }
                #page-footer { display: none !important; }
                #theme_boost-drawers-courseindex { display: none !important; }
                #page.drawers { margin-top: 0 !important; }
                #page-wrapper { padding-top: 0 !important; }
                .navbar, #nav-drawer, #page-header { display: none !important; }
                body { margin-left: 0 !important; }
                #page { height: 100% !important; }
                #page.drawers.show-drawer-left { margin-left: 0 !important; padding-left: 3rem !important; }
                .bycs-header { display: none !important; }
                .mbsfooter { display: none !important; }
                #footnote { display: none !important; }
            `;
            document.head.appendChild(style);
        })();
        """

        webView.evaluateJavaScript(script) { _, error in
            if let error {
                print("Moodle CSS injection failed: \(error.localizedDescription)")
            }
            webView.isHidden = false
            IPCBridge.shared.send("moodle-loaded")
        }
    }

    /// Reports navigation failures so Vue can stop its loading indicator.
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        IPCBridge.shared.send("moodle-load-failed", ["message": error.localizedDescription])
    }

    /// Reports failures that happen before a Moodle page starts loading.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        IPCBridge.shared.send("moodle-load-failed", ["message": error.localizedDescription])
    }
}
