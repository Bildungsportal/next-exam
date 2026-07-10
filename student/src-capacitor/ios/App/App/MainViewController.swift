import UIKit
import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController {
    
    // Store Capacitor's original delegate
    private weak var originalNavigationDelegate: WKNavigationDelegate?
    private weak var originalUIDelegate: WKUIDelegate?
    
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IPCPlugin())
        bridge?.registerPluginInstance(NetworkPlugin())
        bridge?.registerPluginInstance(MulticastClient())
        bridge?.registerPluginInstance(AssessmentHandler())
        
        // Save Capacitor's delegate, then replace with self
        originalNavigationDelegate = webView?.navigationDelegate
        originalUIDelegate = webView?.uiDelegate
        webView?.navigationDelegate = self
        webView?.uiDelegate = self
    }
}

// Intercept for sendSync
extension MainViewController: WKUIDelegate {
    
    static let syncPrefix = "__IPC_SYNC__:"
    
    func webView(
        _ webView: WKWebView,
        runJavaScriptTextInputPanelWithPrompt prompt: String,
        defaultText: String?,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (String?) -> Void
    ) {
        // If it's our sync IPC call, handle it here
        if prompt.hasPrefix(Self.syncPrefix) {
            let channel = String(prompt.dropFirst(Self.syncPrefix.count))
            
            // Decode args from JSON
            var args: Any? = nil
            if let text = defaultText, let data = text.data(using: .utf8) {
                args = try? JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed)
            }
            
            // Create event, dispatch to handlers
            let event = IPCMainEvent(channel: channel, args: args, sender: ipcPlugin)
            
            // Give the event a way to call completionHandler later
            event.setCompletion { result in
                completionHandler(Self.jsonEncode(result))
            }
            
            IPCBridge.shared.dispatchSendSync(event)
            
            // If handler didn't defer, complete immediately with returnValue
            if !event.isDeferred {
                completionHandler(Self.jsonEncode(event.returnValue))
            }
            // If deferred, JS stays blocked until event.resolve() is called

            return
        }
        
        // Otherwise forward to Capacitor's original delegate
        if let original = originalUIDelegate,
           original.responds(to: #selector(WKUIDelegate.webView(_:runJavaScriptTextInputPanelWithPrompt:defaultText:initiatedByFrame:completionHandler:))) {
            original.webView?(
                webView,
                runJavaScriptTextInputPanelWithPrompt: prompt,
                defaultText: defaultText,
                initiatedByFrame: frame,
                completionHandler: completionHandler
            )
        } else {
            completionHandler(nil)
        }
    }
    
    // Forward alert panels
    func webView(
        _ webView: WKWebView,
        runJavaScriptAlertPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping () -> Void
    ) {
        originalUIDelegate?.webView?(
            webView,
            runJavaScriptAlertPanelWithMessage: message,
            initiatedByFrame: frame,
            completionHandler: completionHandler
        ) ?? completionHandler()
    }
    
    // Forward confirm panels
    func webView(
        _ webView: WKWebView,
        runJavaScriptConfirmPanelWithMessage message: String,
        initiatedByFrame frame: WKFrameInfo,
        completionHandler: @escaping (Bool) -> Void
    ) {
        originalUIDelegate?.webView?(
            webView,
            runJavaScriptConfirmPanelWithMessage: message,
            initiatedByFrame: frame,
            completionHandler: completionHandler
        ) ?? completionHandler(false)
    }
    
    // MARK: - Helpers
    
    /// Grab the registered IPCPlugin instance for event.sender
    private var ipcPlugin: IPCPlugin? {
        bridge?.plugin(withName: "IPC") as? IPCPlugin
    }
    
    private static func jsonEncode(_ value: Any?) -> String? {
        guard let value else { return "null" }
        if value is NSNull { return "null" }
        if let n = value as? NSNumber { return "\(n)" }
        if let s = value as? String {
            let data = try? JSONSerialization.data(withJSONObject: [s])
            if let data, let str = String(data: data, encoding: .utf8) {
                return String(str.dropFirst().dropLast()) // unwrap array
            }
            return "\"\(s)\""
        }
        if JSONSerialization.isValidJSONObject(value),
           let data = try? JSONSerialization.data(withJSONObject: value),
           let str = String(data: data, encoding: .utf8) {
            return str
        }
        return "\"\(value)\""
    }
}

// Intercept for SSL
extension MainViewController: WKNavigationDelegate {
    
    // Handle SSL — no 'override' needed
    func webView(
        _ webView: WKWebView,
        didReceive challenge: URLAuthenticationChallenge,
        completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void
    ) {
        guard
            challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
            let serverTrust = challenge.protectionSpace.serverTrust
        else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        // DEV ONLY
        completionHandler(.useCredential, URLCredential(trust: serverTrust))
    }
    
    // Forward remaining delegate calls to Capacitor
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        originalNavigationDelegate?.webView?(webView, decidePolicyFor: navigationAction, decisionHandler: decisionHandler)
        ?? decisionHandler(.allow)
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        originalNavigationDelegate?.webView?(webView, decidePolicyFor: navigationResponse, decisionHandler: decisionHandler)
        ?? decisionHandler(.allow)
    }
    
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        originalNavigationDelegate?.webView?(webView, didStartProvisionalNavigation: navigation)
    }
    
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        originalNavigationDelegate?.webView?(webView, didFinish: navigation)
    }
    
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        originalNavigationDelegate?.webView?(webView, didFail: navigation, withError: error)
    }
    
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        originalNavigationDelegate?.webView?(webView, didFailProvisionalNavigation: navigation, withError: error)
    }
}

