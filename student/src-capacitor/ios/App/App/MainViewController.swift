import UIKit
import Capacitor
import WebKit

class MainViewController: CAPBridgeViewController {
    
    // Store Capacitor's original delegate
    private weak var originalNavigationDelegate: WKNavigationDelegate?
    
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IPCPlugin())
        bridge?.registerPluginInstance(NetworkPlugin())
        bridge?.registerPluginInstance(MulticastClientPlugin())
        
        // Save Capacitor's delegate, then replace with self
        originalNavigationDelegate = webView?.navigationDelegate
        webView?.navigationDelegate = self
    }
}

// MARK: - WKNavigationDelegate
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

