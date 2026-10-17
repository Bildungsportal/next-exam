import Foundation
import WebKit

/// Shared allow/deny decision for exam website navigation in native WKWebViews.
/// Used by the main website webview (WebViewBoxPlugin) and the allowed-URL
/// material overlay (AllowedUrlsWebViewHandler) so both behave identically.
struct URLAllowPolicy {
    let allowedHost: String
    let baseFolder: String
    let blockSubdomains: Bool
    let blockSubfolders: Bool

    init(allowedHost: String, baseFolder: String, blockSubdomains: Bool, blockSubfolders: Bool) {
        self.allowedHost = allowedHost
        self.baseFolder = baseFolder
        self.blockSubdomains = blockSubdomains
        self.blockSubfolders = blockSubfolders
    }

    /// Website-mode navigation decision (scheme, exceptions, host, path).
    func isAllowed(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased() ?? ""

        if scheme == "about" || scheme == "blob" {
            return true
        }

        // allow fonts and images
        if scheme == "data" {
            let urlString = url.absoluteString.lowercased()
            if urlString.hasPrefix("data:image/") || urlString.hasPrefix("data:font/") {
                return true
            }
            // block data:text/html (xss possible)
            return false
        }

        if Self.isCommonException(url.absoluteString.lowercased()) { return true }

        guard scheme == "https" || scheme == "http",
              let host = url.host?.lowercased() else { return false }

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

    /// Directory of a path including its trailing slash ("/" for the root).
    static func folder(of path: String) -> String {
        if path.isEmpty { return "/" }
        if let idx = path.lastIndex(of: "/") {
            return String(path[...idx])
        }
        return "/"
    }

    /// Shared auth/SSO redirect exceptions mirrored from Electron checkCommonExceptions.
    static func isCommonException(_ targetUrl: String) -> Bool {
        if targetUrl.contains("login") && targetUrl.contains("microsoft") { return true }
        if targetUrl.contains("login") && targetUrl.contains("google") { return true }
        if targetUrl.contains("accounts") && targetUrl.contains("google.com") { return true }
        if targetUrl.contains("mysignins") && targetUrl.contains("microsoft") { return true }
        if targetUrl.contains("account") && targetUrl.contains("windowsazure") { return true }
        if targetUrl.contains("login") && targetUrl.contains("microsoftonline") { return true }
        if targetUrl.contains("lookup") && targetUrl.contains("google") { return true }
        if targetUrl.contains("bildung.gv.at") && targetUrl.contains("saml2") { return true }
        if targetUrl.contains("bildung.gv.at/idp/") { return true }
        if targetUrl.contains("shibboleth") && targetUrl.contains("saml2") { return true }
        if let host = URL(string: targetUrl)?.host?.lowercased(),
           host == "id-austria.gv.at" || host.hasSuffix(".id-austria.gv.at") { return true }

        if targetUrl.contains("eu-mobile.events.data") && targetUrl.contains("microsoft") { return true }
        if targetUrl.contains("gstatic.com") { return true }
        if targetUrl.contains("aadcdn") && targetUrl.contains("microsoftonline") { return true }
        if targetUrl.contains("login") && targetUrl.contains("live.com") { return true }
        if targetUrl.contains("login") && targetUrl.contains("msftauth.net") { return true }
        if targetUrl.contains("aadcdn") && targetUrl.contains("msftauth.net") { return true }
        if targetUrl.contains("googlesyndication.com") { return true }

        return false
    }
}
