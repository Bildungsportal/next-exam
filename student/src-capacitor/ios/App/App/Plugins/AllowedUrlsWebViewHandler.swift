import Foundation
import UIKit
import WebKit

/// Hosts allowed URLs in a native WKWebView overlay for exam materials.
final class AllowedUrlsWebViewHandler: NSObject, WKNavigationDelegate, WKUIDelegate {

    static let shared = AllowedUrlsWebViewHandler()

    private weak var controller: MainViewController?
    private var urlWebView: WKWebView?
    private var controlsContainer: UIView?
    private var handlersRegistered = false
    private var currentScale: CGFloat = 1.0
    private var originalURL: URL?
    private var isClosing = false
    private weak var backButton: UIButton?
    private weak var forwardButton: UIButton?
    private var policy: URLAllowPolicy?
    private var hiddenSiblingWebviews: [WKWebView] = []

    /// The native toolbar shown above the webview; MainViewController hides it while a renderer popup is open.
    var headerView: UIView? { controlsContainer }

    private override init() {}

    /// Registers IPC handlers and stores the Capacitor view controller.
    func initialize(controller: MainViewController) {
        self.controller = controller
        guard !handlersRegistered else { return }
        handlersRegistered = true

        IPCBridge.shared.handle("open-allowed-url") { [weak self] payload in
            guard let self else { throw PluginError.notInitialized }
            return try await self.open(payload: payload)
        }

        IPCBridge.shared.handle("close-allowed-url") { [weak self] _ in
            guard let self else { throw PluginError.notInitialized }
            await MainActor.run { self.close() }
            return ["status": "success"]
        }

    }

    /// Creates and displays the native webview overlay for the allowed URL.
    private func open(payload: Any?) async throws -> [String: String] {
        print("AllowedUrlsWebViewHandler.open called with payload: \(payload ?? "nil")")
        guard
            let args = payload as? [String: Any],
            let urlString = args["url"] as? String,
            let url = URL(string: urlString)
        else {
            print("AllowedUrlsWebViewHandler: Failed to extract URL from payload")
            throw IPCError.invalidPayload("URL required")
        }

        let blockSubdomains = (args["blockSubdomains"] as? Bool) ?? false
        let blockSubfolders = (args["blockSubfolders"] as? Bool) ?? false

        print("AllowedUrlsWebViewHandler: Loading URL: \(urlString)")

        await MainActor.run {
            self.close()

            guard let controller = self.controller else {
                print("AllowedUrlsWebViewHandler: No controller available")
                return
            }

            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            WebViewSecurity.apply(configuration)

            let frame = self.nativeFrame(from: args["frame"], controller: controller)
            print("AllowedUrlsWebViewHandler: Native frame calculated: \(frame)")
            let webView = WKWebView(frame: frame, configuration: configuration)
            webView.navigationDelegate = self
            webView.uiDelegate = self
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]

            // Style the webview as a modal with rounded bottom corners and shadow
            webView.layer.cornerRadius = 8
            webView.layer.maskedCorners = [.layerMinXMaxYCorner, .layerMaxXMaxYCorner]
            webView.layer.shadowColor = UIColor.black.cgColor
            webView.layer.shadowOpacity = 0.3
            webView.layer.shadowOffset = CGSize(width: 0, height: 2)
            webView.layer.shadowRadius = 10
            webView.clipsToBounds = false

            controller.view.addSubview(webView)
            self.urlWebView = webView
            self.originalURL = url
            self.isClosing = false
            print("AllowedUrlsWebViewHandler: WebView added to view hierarchy")

            // Hide native WKWebViews layered above the Capacitor webview (website/forms WebViewBox)
            // so this overlay is not drawn behind them.
            self.hideSiblingWebviews(excluding: webView)

            // Add native header with controls
            self.addNativeHeader(above: webView, in: frame)

            self.policy = URLAllowPolicy(
                allowedHost: url.host?.lowercased() ?? "",
                baseFolder: URLAllowPolicy.folder(of: url.path),
                blockSubdomains: blockSubdomains,
                blockSubfolders: blockSubfolders
            )

            webView.load(URLRequest(url: url))

            // Update button states after initial load
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                self.updateNavigationButtons()
            }
        }

        return ["status": "success"]
    }

    /// Converts the Vue placeholder rectangle into native view coordinates.
    private func nativeFrame(from payload: Any?, controller: MainViewController) -> CGRect {
        guard
            let frame = payload as? [String: Any],
            let x = frame["x"] as? NSNumber,
            let y = frame["y"] as? NSNumber,
            let width = frame["width"] as? NSNumber,
            let height = frame["height"] as? NSNumber
        else {
            print("AllowedUrlsWebViewHandler: Using full screen bounds")
            return controller.view.bounds
        }

        let rawFrame = CGRect(
            x: x.doubleValue,
            y: y.doubleValue,
            width: width.doubleValue,
            height: height.doubleValue
        )
        print("AllowedUrlsWebViewHandler: Raw frame from JS: \(rawFrame)")
        print("AllowedUrlsWebViewHandler: Controller view bounds: \(controller.view.bounds)")
        print("AllowedUrlsWebViewHandler: Controller webView bounds: \(controller.webView?.bounds ?? .zero)")

        // The coordinates from getBoundingClientRect() are relative to the webView's viewport
        // We use them directly as they should already be in the right coordinate space
        return rawFrame
    }

    /// Adds a native header with navigation and control buttons above the webview.
    private func addNativeHeader(above webView: WKWebView, in frame: CGRect) {
        let headerHeight: CGFloat = 44
        let headerFrame = CGRect(
            x: frame.minX,
            y: frame.minY - headerHeight,
            width: frame.width,
            height: headerHeight
        )

        let header = UIView(frame: headerFrame)
        header.backgroundColor = UIColor(red: 0.97, green: 0.97, blue: 0.97, alpha: 1.0)

        // Style header with rounded top corners and shadow (matching webview)
        header.layer.cornerRadius = 8
        header.layer.maskedCorners = [.layerMinXMinYCorner, .layerMaxXMinYCorner]
        header.layer.shadowColor = UIColor.black.cgColor
        header.layer.shadowOpacity = 0.3
        header.layer.shadowOffset = CGSize(width: 0, height: 2)
        header.layer.shadowRadius = 10
        header.clipsToBounds = false

        // Add bottom border
        let borderLine = UIView(frame: CGRect(x: 0, y: headerHeight - 1, width: headerFrame.width, height: 1))
        borderLine.backgroundColor = UIColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1.0)
        header.addSubview(borderLine)

        let buttonWidth: CGFloat = 36
        let buttonHeight: CGFloat = 32
        let buttonY: CGFloat = 6
        let buttonSpacing: CGFloat = 8

        // Back button
        let backBtn = UIButton(type: .system)
        backBtn.frame = CGRect(x: 8, y: buttonY, width: buttonWidth, height: buttonHeight)
        backBtn.setTitle("‹", for: .normal)
        backBtn.backgroundColor = UIColor(red: 0.92, green: 0.92, blue: 0.92, alpha: 1.0)
        backBtn.setTitleColor(.black, for: .normal)
        backBtn.layer.cornerRadius = 4
        backBtn.layer.borderWidth = 1
        backBtn.layer.borderColor = UIColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1.0).cgColor
        backBtn.addTarget(self, action: #selector(backButtonTapped), for: .touchUpInside)
        header.addSubview(backBtn)
        self.backButton = backBtn

        // Forward button
        let forwardBtn = UIButton(type: .system)
        forwardBtn.frame = CGRect(x: 8 + buttonWidth + buttonSpacing, y: buttonY, width: buttonWidth, height: buttonHeight)
        forwardBtn.setTitle("›", for: .normal)
        forwardBtn.backgroundColor = UIColor(red: 0.92, green: 0.92, blue: 0.92, alpha: 1.0)
        forwardBtn.setTitleColor(.black, for: .normal)
        forwardBtn.layer.cornerRadius = 4
        forwardBtn.layer.borderWidth = 1
        forwardBtn.layer.borderColor = UIColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1.0).cgColor
        forwardBtn.addTarget(self, action: #selector(forwardButtonTapped), for: .touchUpInside)
        header.addSubview(forwardBtn)
        self.forwardButton = forwardBtn

        // Home button
        let homeBtn = UIButton(type: .system)
        homeBtn.frame = CGRect(x: 8 + (buttonWidth + buttonSpacing) * 2, y: buttonY, width: buttonWidth, height: buttonHeight)
        homeBtn.setTitle("⌂", for: .normal)
        homeBtn.backgroundColor = UIColor(red: 0.92, green: 0.92, blue: 0.92, alpha: 1.0)
        homeBtn.setTitleColor(.black, for: .normal)
        homeBtn.layer.cornerRadius = 4
        homeBtn.layer.borderWidth = 1
        homeBtn.layer.borderColor = UIColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1.0).cgColor
        homeBtn.addTarget(self, action: #selector(homeButtonTapped), for: .touchUpInside)
        header.addSubview(homeBtn)

        // Zoom out button
        let zoomOutBtn = UIButton(type: .system)
        zoomOutBtn.frame = CGRect(x: headerFrame.width - 158, y: buttonY, width: buttonWidth, height: buttonHeight)
        zoomOutBtn.setTitle("−", for: .normal)
        zoomOutBtn.backgroundColor = UIColor(red: 0.92, green: 0.92, blue: 0.92, alpha: 1.0)
        zoomOutBtn.setTitleColor(.black, for: .normal)
        zoomOutBtn.layer.cornerRadius = 4
        zoomOutBtn.layer.borderWidth = 1
        zoomOutBtn.layer.borderColor = UIColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1.0).cgColor
        zoomOutBtn.addTarget(self, action: #selector(zoomOutTapped), for: .touchUpInside)
        header.addSubview(zoomOutBtn)

        // Zoom in button
        let zoomInBtn = UIButton(type: .system)
        zoomInBtn.frame = CGRect(x: headerFrame.width - 108, y: buttonY, width: buttonWidth, height: buttonHeight)
        zoomInBtn.setTitle("+", for: .normal)
        zoomInBtn.backgroundColor = UIColor(red: 0.92, green: 0.92, blue: 0.92, alpha: 1.0)
        zoomInBtn.setTitleColor(.black, for: .normal)
        zoomInBtn.layer.cornerRadius = 4
        zoomInBtn.layer.borderWidth = 1
        zoomInBtn.layer.borderColor = UIColor(red: 0.87, green: 0.87, blue: 0.87, alpha: 1.0).cgColor
        zoomInBtn.addTarget(self, action: #selector(zoomInTapped), for: .touchUpInside)
        header.addSubview(zoomInBtn)

        // Close button
        let closeBtn = UIButton(type: .system)
        closeBtn.frame = CGRect(x: headerFrame.width - 50, y: buttonY, width: buttonWidth, height: buttonHeight)
        closeBtn.setTitle("✕", for: .normal)
        closeBtn.setTitleColor(.white, for: .normal)
        closeBtn.backgroundColor = UIColor(red: 0.86, green: 0.08, blue: 0.24, alpha: 1.0)
        closeBtn.layer.cornerRadius = 4
        closeBtn.addTarget(self, action: #selector(closeButtonTapped), for: .touchUpInside)
        header.addSubview(closeBtn)

        controller?.view.addSubview(header)
        controlsContainer = header
    }

    @objc private func closeButtonTapped() {
        print("Close button tapped")
        guard !isClosing else { return }
        isClosing = true
        self.close()
    }

    @objc private func backButtonTapped() {
        print("Back tapped")
        urlWebView?.goBack()
    }

    @objc private func forwardButtonTapped() {
        print("Forward tapped")
        urlWebView?.goForward()
    }

    @objc private func homeButtonTapped() {
        print("Home tapped")
        guard let originalURL = originalURL else { return }
        urlWebView?.load(URLRequest(url: originalURL))
    }

    @objc private func zoomInTapped() {
        print("Zoom in tapped")
        currentScale = min(2.0, currentScale + 0.1)
        updateWebViewScale()
    }

    @objc private func zoomOutTapped() {
        print("Zoom out tapped")
        currentScale = max(0.5, currentScale - 0.1)
        updateWebViewScale()
    }

    private func updateWebViewScale() {
        guard let webView = urlWebView else { return }
        let script = "document.body.style.zoom = '\(currentScale)'"
        webView.evaluateJavaScript(script) { _, error in
            if let error = error {
                print("Zoom error: \(error)")
            }
        }
    }

    private func updateNavigationButtons() {
        guard let webView = urlWebView else { return }
        DispatchQueue.main.async {
            self.backButton?.isEnabled = webView.canGoBack
            self.forwardButton?.isEnabled = webView.canGoForward
            // Update button appearance based on enabled state
            self.backButton?.alpha = webView.canGoBack ? 1.0 : 0.5
            self.forwardButton?.alpha = webView.canGoForward ? 1.0 : 0.5
        }
    }

    // MARK: - WKNavigationDelegate

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        updateNavigationButtons()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        updateNavigationButtons()
    }

    /// Blocks navigation that does not match the allowed URL policy (same as the main website webview).
    func webView(_ webView: WKWebView,
                 decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url, policy?.isAllowed(url) == true {
            decisionHandler(.allow)
        } else {
            print("AllowedUrlsWebViewHandler: blocked navigation: \(navigationAction.request.url?.absoluteString ?? "nil")")
            decisionHandler(.cancel)
        }
    }

    /// Opens allowed target="_blank" links in the same webview instead of a new window.
    func webView(_ webView: WKWebView,
                 createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction,
                 windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, policy?.isAllowed(url) == true {
            webView.load(URLRequest(url: url))
        }
        return nil
    }

    /// Removes the native webview overlay.
    @MainActor private func close() {
        urlWebView?.stopLoading()
        urlWebView?.navigationDelegate = nil
        urlWebView?.uiDelegate = nil
        urlWebView?.removeFromSuperview()
        urlWebView = nil
        controlsContainer?.removeFromSuperview()
        controlsContainer = nil
        currentScale = 1.0
        policy = nil
        restoreSiblingWebviews()
    }

    /// Hides WKWebViews layered above the Capacitor webview (e.g. the website/forms WebViewBox)
    /// that would otherwise cover this overlay.
    private func hideSiblingWebviews(excluding keepVisible: WKWebView?) {
        hiddenSiblingWebviews = (controller?.webView?.superview?.subviews ?? [])
            .compactMap { $0 as? WKWebView }
            .filter { $0 !== controller?.webView && $0 !== keepVisible && !$0.isHidden }
        hiddenSiblingWebviews.forEach { $0.isHidden = true }
    }

    /// Restores the sibling WKWebViews hidden while this overlay was open.
    private func restoreSiblingWebviews() {
        hiddenSiblingWebviews.forEach { $0.isHidden = false }
        hiddenSiblingWebviews = []
    }
}
