import Foundation
import Capacitor
import WebKit

@objc(WebViewBoxPlugin)
public class WebViewBoxPlugin: CAPPlugin, CAPBridgedPlugin, WKNavigationDelegate, WKUIDelegate {
    public let identifier = "WebViewBoxPlugin"
    public let jsName = "WebViewBox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "close", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resize", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "reload", returnType: CAPPluginReturnPromise)

    ]

    private var innerWebView: WKWebView?

    private var allowedHost: String = ""
    private var baseFolder: String = "/"
    private var blockSubdomains: Bool = false
    private var blockSubfolders: Bool = false
    private var isScratch: Bool = false
    private var executeJavaScript: String = ""
    private var mode: String = "website"
    private var configuredUrl: URL?

    @objc func open(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let host = url.host?.lowercased() else {
            call.reject("Unknown url"); return
        }

        let x = call.getDouble("x") ?? 0
        let y = call.getDouble("y") ?? 0
        let width = call.getDouble("width") ?? 0
        let height = call.getDouble("height") ?? 0
        let showdevtools = call.getBool("showdevtools") ?? false


        self.blockSubdomains = call.getBool("blockSubdomains") ?? false
        self.blockSubfolders = call.getBool("blockSubfolders") ?? false
        self.allowedHost = host
        self.baseFolder = Self.folder(of: url.path)
        self.isScratch = host == "scratch.mit.edu" && url.path.hasPrefix("/projects")
        self.executeJavaScript = call.getString("executeJavaScript") ?? ""
        self.mode = call.getString("mode") ?? "website"
        self.configuredUrl = url
        

        DispatchQueue.main.async {
            self.innerWebView?.removeFromSuperview()

            let hostView = self.bridge?.webView
            let nativeFrame = hostView?.convert(
                CGRect(x: x, y: y, width: width, height: height),
                to: hostView?.superview
            ) ?? .zero

            let wv = WKWebView(frame: nativeFrame)
            
            wv.navigationDelegate = self
            wv.uiDelegate = self
            
            hostView?.superview?.addSubview(wv)
            wv.load(URLRequest(url: url))

            self.innerWebView = wv
            
            if #available(iOS 16.4, *), showdevtools {
                wv.isInspectable = true
            }
            
            call.resolve()
        }
    }

    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.innerWebView?.removeFromSuperview()
            self.innerWebView = nil
            call.resolve()
        }
    }
    
    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let wv = self.innerWebView else {
                call.reject("No Webview to show"); return
            }
            wv.isHidden = false
            call.resolve()
        }
    }
    
    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let wv = self.innerWebView else {
                call.reject("No Webview to hide"); return
            }
            wv.isHidden = true
            call.resolve()
        }
    }
    
    @objc func reload(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"),
              let url = URL(string: urlString),
              let host = url.host?.lowercased() else {
            call.reject("Unknown url"); return
        }

        self.allowedHost = host
        self.baseFolder = Self.folder(of: url.path)
        self.isScratch = host == "scratch.mit.edu" && url.path.hasPrefix("/projects")
        self.configuredUrl = url
        
        DispatchQueue.main.async {
            let wv = self.innerWebView
            wv?.load(URLRequest(url: url))
            call.resolve()
        }
    }
    
    @objc func resize(_ call: CAPPluginCall) {
        let x = call.getDouble("x") ?? 0
        let y = call.getDouble("y") ?? 0
        let width = call.getDouble("width") ?? 0
        let height = call.getDouble("height") ?? 0
        
        DispatchQueue.main.async {
            guard let wv = self.innerWebView else {
                call.reject("No Webview to resize"); return
            }
            wv.frame = self.bridge?.webView?.convert(
                CGRect(x: x, y: y, width: width, height: height),
                to: wv.superview
            ) ?? .zero
            call.resolve()
        }
    }


    public func webView(_ webView: WKWebView,
                        decidePolicyFor navigationAction: WKNavigationAction,
                        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel); return
        }
        if isAllowed(url) {
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            notifyListeners("navBlocked", data: ["url": url.absoluteString])
        }
    }
 
    public func webView(_ webView: WKWebView,
                        createWebViewWith configuration: WKWebViewConfiguration,
                        for navigationAction: WKNavigationAction,
                        windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isAllowed(url) {
                webView.load(URLRequest(url: url))
            } else {
                notifyListeners("navBlocked", data: ["url": url.absoluteString])
            }
        }
        return nil
    }
    
    public func webView(_ webView: WKWebView,
                        didFinish navigation: WKNavigation) {
        guard (isScratch || mode == "forms"), !executeJavaScript.isEmpty else { return }

        let js = self.executeJavaScript

        webView.evaluateJavaScript(js) { _, error in
            if let error = error {
                print("Js injection error: \(error.localizedDescription)")
            }
        }
    }


    private func isAllowed(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""
        
        if scheme == "about" || scheme == "blob" {
            return true
        }
        
        // allow fonts and image
        if scheme == "data" {
            let urlString = url.absoluteString.lowercased()
            if urlString.hasPrefix("data:image/") || urlString.hasPrefix("data:font/") {
                return true
            }
            // block data:text/html (xss possible)
            return false
        }
        
        
        let targetUrl = url.absoluteString.lowercased()
        if isCommonException(targetUrl) { return true }

        guard let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http",
              let host = url.host?.lowercased() else { return false }

        if mode == "rdp" { return true }
        if mode == "forms" { return isFormsNavigationAllowed(url) }

        if !Self.isWebsiteHostAllowed(host, allowedHost: allowedHost, blockSubdomains: blockSubdomains) { return false }

        if !blockSubfolders { return true }
        let candidatePath = url.path.isEmpty ? "/" : url.path
        return Self.folder(of: candidatePath) == baseFolder
    }

    /// Checks a website hostname against its configured host.
    static func isWebsiteHostAllowed(_ host: String, allowedHost: String, blockSubdomains: Bool) -> Bool {
        let allowedBase = allowedHost.replacingOccurrences(of: "www.", with: "", options: [.anchored])
        let hostBase = host.replacingOccurrences(of: "www.", with: "", options: [.anchored])
        return blockSubdomains
            ? hostBase == allowedBase
            : hostBase == allowedBase || hostBase.hasSuffix("." + allowedBase)
    }

    /// Mirrors the Electron allow-list for configured Google or Microsoft Forms.
    private func isFormsNavigationAllowed(_ url: URL) -> Bool {
        guard let configuredUrl, let targetHost = url.host?.lowercased(), let formsHost = configuredUrl.host?.lowercased() else {
            return false
        }
        if url.scheme == configuredUrl.scheme && url.host == configuredUrl.host && url.port == configuredUrl.port { return true }
        if let formId = configuredFormsId(configuredUrl), url.absoluteString.contains(formId) { return true }
        if (formsHost.contains("microsoft") || formsHost.contains("office")) && isMicrosoftFormsHost(targetHost) { return true }
        if (formsHost.contains("google") || formsHost == "forms.gle") && isGoogleFormsHost(targetHost) { return true }
        return false
    }

    /// Extracts the stable form identifier used across provider redirects.
    private func configuredFormsId(_ url: URL) -> String? {
        if let id = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "id" })?.value {
            return id
        }
        let parts = url.path.split(separator: "/")
        guard let formsIndex = parts.firstIndex(of: "forms"), parts.indices.contains(formsIndex + 2), parts[formsIndex + 1] == "d" else { return nil }
        let idIndex = parts[formsIndex + 2] == "e" ? formsIndex + 3 : formsIndex + 2
        return parts.indices.contains(idIndex) ? String(parts[idIndex]) : nil
    }

    /// Returns true for Microsoft Forms and its authentication chain.
    private func isMicrosoftFormsHost(_ host: String) -> Bool {
        if ["forms.cloud.microsoft", "forms.office.com", "forms.microsoft.com"].contains(host) { return true }
        if host.hasSuffix(".forms.office.com") { return true }
        return [".microsoftonline.com", ".live.com", ".microsoft.com", ".msftauth.net", ".office.com", ".office.net", ".office365.com"]
            .contains(where: host.hasSuffix)
    }

    /// Returns true for Google Forms and its authentication chain.
    private func isGoogleFormsHost(_ host: String) -> Bool {
        host == "forms.gle" || host == "docs.google.com" || host.hasSuffix(".google.com")
    }

    // Shared auth/SSO redirect exceptions mirrored from Electron checkCommonExceptions.
    private func isCommonException(_ targetUrl: String) -> Bool {
        if targetUrl.contains("login") && targetUrl.contains("microsoft") { return true }
        if targetUrl.contains("login") && targetUrl.contains("google") { return true }
        if targetUrl.contains("accounts") && targetUrl.contains("google.com") { return true }
        if targetUrl.contains("mysignins") && targetUrl.contains("microsoft") { return true }
        if targetUrl.contains("account") && targetUrl.contains("windowsazure") { return true }
        if targetUrl.contains("login") && targetUrl.contains("microsoftonline") { return true }
        if targetUrl.contains("lookup") && targetUrl.contains("google") { return true }
        if targetUrl.contains("bildung.gv.at") && targetUrl.contains("saml2") { return true }
        if targetUrl.contains("shibboleth") && targetUrl.contains("saml2") { return true }
        if targetUrl.contains("id-austria.gv.at") && targetUrl.contains("authhandler") { return true }

        if targetUrl.contains("eu-mobile.events.data") && targetUrl.contains("microsoft") { return true }
        if targetUrl.contains("gstatic.com") { return true }
        if targetUrl.contains("aadcdn") && targetUrl.contains("microsoftonline") { return true }
        if targetUrl.contains("login") && targetUrl.contains("live.com") { return true }
        if targetUrl.contains("login") && targetUrl.contains("msftauth.net") { return true }
        if targetUrl.contains("aadcdn") && targetUrl.contains("msftauth.net") { return true }
        if targetUrl.contains("googlesyndication.com") { return true }

        return false
    }

    
    private static func folder(of path: String) -> String {
        if path.isEmpty { return "/" }
        if let idx = path.lastIndex(of: "/") {
            return String(path[...idx])
        }
        return "/"
    }
}
