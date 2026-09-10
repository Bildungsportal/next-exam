import Foundation
import UIKit
import WebKit

/// Hosts the BiP authentication flow and forwards its token to the renderer.
final class BiPLoginWebViewHandler: NSObject, WKNavigationDelegate, WKUIDelegate {

    static let shared = BiPLoginWebViewHandler()

    private weak var controller: MainViewController?
    private var loginWebView: WKWebView?
    private var handlersRegistered = false
    private let log = LoggingHandler.shared

    private override init() {}

    /// Registers the synchronous IPC signal and stores the Capacitor controller.
    func initialize(controller: MainViewController) {
        self.controller = controller
        guard !handlersRegistered else { return }
        handlersRegistered = true

        IPCBridge.shared.on("loginBiP") { [weak self] event in
            guard let self else {
                event.returnValue = ["status": "error", "message": "BiP login unavailable"]
                return
            }
            let baseUrl = (event.args as? [Any])?.first as? String
            DispatchQueue.main.async { self.open(baseUrl: baseUrl) }
            event.returnValue = ["status": "success"]
        }
    }

    /// Creates the native login view using the renderer's configured portal endpoint.
    @MainActor private func open(baseUrl: String?) {
        guard
            let baseUrl,
            let baseComponents = URLComponents(string: baseUrl),
            let scheme = baseComponents.scheme,
            let host = baseComponents.host
        else { return }
        let loginHost = host.hasPrefix("www.") ? String(host.dropFirst(4)) : host
        guard let url = URL(string: "\(scheme)://\(loginHost)/admin/tool/mobile/launch.php?service=moodle_mobile_app&passport=next-exam") else { return }
        close()

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let webView = WKWebView(frame: controller?.view.bounds ?? .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        controller?.view.addSubview(webView)
        loginWebView = webView
        webView.load(URLRequest(url: url))
    }

    /// Removes the native BiP login view.
    @MainActor private func close() {
        loginWebView?.stopLoading()
        loginWebView?.navigationDelegate = nil
        loginWebView?.uiDelegate = nil
        loginWebView?.removeFromSuperview()
        loginWebView = nil
    }

    /// Captures the BiP app-scheme token instead of opening it outside the app.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        guard url.scheme?.lowercased() == "bildungsportal" else {
            decisionHandler(.allow)
            return
        }

        decisionHandler(.cancel)
        let prefix = "bildungsportal://token="
        let urlString = url.absoluteString
        let token = String(urlString.dropFirst(prefix.count))
        guard urlString.hasPrefix(prefix) else { return }
        IPCBridge.shared.send("bipToken", token)
        DispatchQueue.main.async { [weak self] in self?.close() }
    }

    /// Blocks portal attempts to open a separate login window.
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        nil
    }
}
