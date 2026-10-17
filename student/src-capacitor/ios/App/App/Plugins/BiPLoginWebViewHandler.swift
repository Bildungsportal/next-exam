import Foundation
import UIKit
import WebKit

/// Hosts the BiP authentication flow and forwards its token to the renderer.
final class BiPLoginWebViewHandler: NSObject, WKNavigationDelegate, WKUIDelegate {

    static let shared = BiPLoginWebViewHandler()

    private weak var controller: MainViewController?
    private var loginWebView: WKWebView?
    private var loginHost = ""
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

    /// Creates the native login view using the renderer's configured portal login url.
    @MainActor private func open(baseUrl: String?) {
        guard let baseUrl, let url = URL(string: baseUrl) else { return }
        close()
        loginHost = url.host?.lowercased() ?? ""

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        WebViewSecurity.apply(configuration)
        let webView = WKWebView(frame: controller?.view.bounds ?? .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        controller?.view.addSubview(webView)
        loginWebView = webView
        webView.load(URLRequest(url: url))
    }

    /// Removes the native BiP login view and resets the portal website cookies so the next login attempt starts fresh.
    @MainActor private func close() {
        loginWebView?.stopLoading()
        loginWebView?.navigationDelegate = nil
        loginWebView?.uiDelegate = nil
        loginWebView?.removeFromSuperview()
        loginWebView = nil
        clearPortalCookies()
    }

    /// Removes cookies and storage that the BiP portal website wrote during the login attempt.
    @MainActor private func clearPortalCookies() {
        guard !loginHost.isEmpty else { return }
        let dataStore = WKWebsiteDataStore.default()
        let types = Set([
            WKWebsiteDataTypeCookies,
            WKWebsiteDataTypeLocalStorage,
            WKWebsiteDataTypeSessionStorage,
            WKWebsiteDataTypeIndexedDBDatabases,
            WKWebsiteDataTypeWebSQLDatabases,
        ])
        dataStore.fetchDataRecords(ofTypes: types) { [host = loginHost] records in
            let toRemove = records.filter { record in
                let name = record.displayName.lowercased()
                return name == host || name.hasSuffix("." + host) || host.hasSuffix("." + name)
            }
            guard !toRemove.isEmpty else { return }
            dataStore.removeData(ofTypes: types, for: toRemove) {}
        }
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
