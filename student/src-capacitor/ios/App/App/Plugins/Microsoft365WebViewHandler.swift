import Foundation
import UIKit
import WebKit

/// Hosts Microsoft 365 in a native WKWebView because iOS does not support Electron's BrowserView.
/// Mirrors the Electron microsoft365 BrowserView (windowhandler.js) and the MoodleWebViewHandler pattern.
final class Microsoft365WebViewHandler: NSObject, WKNavigationDelegate, WKUIDelegate {

    static let shared = Microsoft365WebViewHandler()

    private weak var controller: MainViewController?
    private var ms365WebView: WKWebView?
    private var ms365Url = ""
    private var ms365Hidden = false
    private var handlersRegistered = false
    private let log = LoggingHandler.shared

    /// Allowed Microsoft 365 / OneDrive / auth hosts.
    private let allowedHostSuffixes: Set<String> = [
        "1drv.ms",
        "onedrive.live.com",
        "officeapps.live.com",
        "office.net",
        "office.com",
        "microsoft.com",
        "sharepoint.com",
        "login.live.com",
        "login.microsoftonline.com",
        "msauth.net",
        "msftidentity.com",
    ]

    private override init() {}

    /// Registers Microsoft 365 IPC handlers and stores the Capacitor view controller.
    func initialize(controller: MainViewController) {
        self.controller = controller
        guard !handlersRegistered else { return }
        handlersRegistered = true

        IPCBridge.shared.handle("open-ms365") { [weak self] payload in
            guard let self else { throw PluginError.notInitialized }
            return try await self.open(payload: payload)
        }
        IPCBridge.shared.handle("reload-ms365") { [weak self] _ in
            guard let self else { throw PluginError.notInitialized }
            await MainActor.run { self.reload() }
            return ["status": "success"]
        }
        IPCBridge.shared.handle("close-ms365") { [weak self] _ in
            guard let self else { throw PluginError.notInitialized }
            await MainActor.run { self.close() }
            return ["status": "success"]
        }
        IPCBridge.shared.handle("resize-ms365") { [weak self] payload in
            guard let self else { throw PluginError.notInitialized }
            await MainActor.run { self.resize(payload: payload) }
            return ["status": "success"]
        }
        // Send-only Electron channels shared by the renderer (hide/show native view for popups); `throws` picks the .on (OnHandler) overload.
        IPCBridge.shared.on("collapse-browserview") { [weak self] _ throws in
            guard let self else { return }
            Task { @MainActor in self.setHidden(true) }
        }
        IPCBridge.shared.on("restore-browserview") { [weak self] _ throws in
            guard let self else { return }
            Task { @MainActor in self.setHidden(false) }
        }
    }

    /// Creates the native webview in the renderer placeholder and loads the share link.
    private func open(payload: Any?) async throws -> [String: String] {
        guard
            let args = payload as? [String: Any],
            let urlString = args["url"] as? String,
            let url = URL(string: urlString),
            isNavigationAllowed(url)
        else {
            let rawUrl = (payload as? [String: Any])?["url"] as? String
            log?.warn("microsoft365 @ open: share link rejected/missing (\(rawUrl ?? "nil"))")
            throw IPCError.invalidPayload("Microsoft 365 URL required")
        }

        log?.info("microsoft365 @ open: opening share link \(urlString)")

        await MainActor.run {
            self.close()
            self.ms365Url = urlString
            self.ms365Hidden = false

            let configuration = WKWebViewConfiguration()
            configuration.websiteDataStore = .default()
            configuration.userContentController.addUserScript(Self.lockdownScript)
            WebViewSecurity.apply(configuration)
            let webView = WKWebView(frame: self.nativeFrame(from: args["frame"]), configuration: configuration)
            webView.navigationDelegate = self
            webView.uiDelegate = self
            webView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            webView.isHidden = true

            self.controller?.view.addSubview(webView)
            self.ms365WebView = webView
            webView.load(URLRequest(url: url))
        }

        return ["status": "success"]
    }

    /// Electron's microsoft365 lockdown script, injected into every frame at document end (the O365 editors
    /// live in CSP-locked subframes, so `forMainFrameOnly: false` is required). Extends Electron's exact IDs
    /// with Safari-DOM keyword/aria/header matching; removes emptied group boxes and menu dividers. The 400 ms
    /// interval re-applies because the SPA re-creates the ribbon elements.
    private static let lockdownScript: WKUserScript = {
        let source = """
        (() => {
            if (window.__nextExamMs365Lock) return;
            window.__nextExamMs365Lock = true;
            function hide(el) {
                el.__nxHidden = true;
                el.style.display = 'none';
                el.style.setProperty('display', 'none', 'important');
            }
            const hideusByID = ['ShowHideEquationToolsPane','LinkGroup','GraphicsEditor','InsertTableOfContentsInInsertTab','InsertOnlinevideo','Picture','Ribbon-PictureMenuMLRDropdown','Pictures','PicturesMenu','PictureMenu','InsertPictures','InsertPicture','PhotoBrowser','InsertAddInFlyout','Designer','Editor','FarPane','Help','InsertAppsForOffice','FileMenuLauncherContainer','Help-wrapper','Review-wrapper','Header','FarPeripheralControlsContainer','BusinessBar'];
            const labels = ['Suchen','Übersetzen','Search','Translate','Add-Ins','Online Video','Insert Online Video','Apps for Office','Get Add-ins','Designer','Copilot','Help','Hilfe','Voice','Diktieren','Diktat','Transcribe','Transcription','Transkribieren','Transkription','Dokumentprüfung','Document Check','Check Document','Rechtschreibung','Spell Check','Editor','Pictures','Bilder','Bild einfügen','Bild hinzufügen','Insert Picture','Insert Pictures','Photos','Fotos','This Device','Dieses Gerät','Stock Images','Stockbilder','Online Pictures','Onlinebilder'];
            const uniqueIds = ['ContextMenu-SmartLookupContextMenu','ContextMenu-SmartLookupSynonyms','Ribbon-ReferencesSmartLookUp','Dictation','GetAddins','Pictures_MLR','Pictures'];
            const keywords = ['onlinevideo','insertonlinevideo','addin','add-ins','appsforoffice','getaddins','designer','copilot','smartlookup','dictation','translate','übersetzen','suchen','pictures_mlr','picturemenu','onlinepicture','onlinepictures','pictures','picturesfrom','insertpictures','insertpicture','stockimage','stockimages','bilder','onlinebilder','foto','fotos','photo','photos','thisdevice','diesesgerät','voice','dictate','diktier','transcri','transkrip','dokumentprüfung','dokumentpruefung','documentcheck','checkdocument','proofing'];
            const commandKeywords = keywords.concat(['editor']);
            const headerLabels = ['Suchen','Search','Übersetzen','Translate','Add-Ins','Online Video','Insert Online Video','Apps for Office','Get Add-ins','Designer','Copilot','Help','Hilfe','Voice','Diktieren','Diktat','Transcribe','Transcription','Transkribieren','Transkription','Dokumentprüfung','Dokument Prüfung','Prüfung','Proofing','Document Check','Check Document','Rechtschreibung','Spell Check','Editor','Edit','Pictures','Bilder','Foto','Fotos','Photo','Photos'];
            function lock() {
                for (const id of hideusByID) {
                    const el = document.getElementById(id);
                    if (el) hide(el);
                }
                for (const label of labels) {
                    document.querySelectorAll('[aria-label="' + label + '"], [title="' + label + '"]').forEach(hide);
                }
                for (const uid of uniqueIds) {
                    document.querySelectorAll('[data-unique-id="' + uid + '"]').forEach(hide);
                }
                document.querySelectorAll('[data-command],[data-command-id],[data-command-name],[data-commandname]').forEach((el) => {
                    const hay = ((el.getAttribute('data-command') || '') + ' ' + (el.getAttribute('data-command-id') || '') + ' ' + (el.getAttribute('data-command-name') || '') + ' ' + (el.getAttribute('data-commandname') || '')).toLowerCase();
                    for (const k of commandKeywords) {
                        if (hay.includes(k)) hide(el);
                    }
                });
                document.querySelectorAll('[data-control-id],[data-control-name],[data-name],[data-id],[data-automationid],[data-automation-id],[aria-label],[title],[name],[id]').forEach((el) => {
                    const hay = ((el.getAttribute('data-control-id') || '') + ' ' + (el.getAttribute('data-control-name') || '') + ' ' + (el.getAttribute('data-name') || '') + ' ' + (el.getAttribute('data-id') || '') + ' ' + (el.getAttribute('data-automationid') || '') + ' ' + (el.getAttribute('data-automation-id') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || '') + ' ' + (el.getAttribute('name') || '') + ' ' + (el.id || '')).toLowerCase();
                    for (const k of keywords) {
                        if (hay.includes(k)) hide(el);
                    }
                });
                document.querySelectorAll('button,input[type="button"],[role="button"],[role="menuitem"],[role="tab"]').forEach((el) => {
                    if (el.closest('[contenteditable]')) return;
                    const t = ((el.getAttribute('aria-label') || el.title || el.textContent || '')).trim().toLowerCase();
                    if (labels.some((h) => h.toLowerCase() === t)) hide(el);
                });
                document.querySelectorAll('div,span,label,header,caption,h1,h2,h3,h4,h5,h6,[role="heading"],[aria-level],button,[role="button"],[role="menuitem"],[role="tab"]').forEach((el) => {
                    if (el.__nxHidden) return;
                    if (el.querySelector('[contenteditable]') || el.closest('[contenteditable]')) return;
                    if (el.children.length > 25) return;
                    const t = ((el.getAttribute('aria-label') || el.title || el.textContent || '')).replace(/\\s+/g, ' ').trim().toLowerCase();
                    if (!t || t.length > 80) return;
                    if (headerLabels.some((h) => t === h.toLowerCase() || t.startsWith(h.toLowerCase() + ' '))) hide(el);
                });
                document.querySelectorAll('[id$="-group"],[id^="groupContainer"],[class*="groupContainer"],section,fieldset').forEach((el) => {
                    if (el.__nxHidden) return;
                    if (el.closest('[contenteditable]') || el.querySelector('[contenteditable]')) return;
                    if (!el.children.length) return;
                    const controls = el.querySelectorAll('button,input,select,textarea,a,iframe,video,audio,canvas,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],[role="listbox"],[role="combobox"],[role="textbox"],[role="searchbox"],[data-command],[data-command-id],[data-control-id],[data-automationid]');
                    let anyLive = false;
                    for (let i = 0; i < controls.length && !anyLive; i++) {
                        if (!controls[i].__nxHidden && controls[i].style.display !== 'none') anyLive = true;
                    }
                    // A visible caption does not keep an emptied group alive — hide it entirely.
                    if (!anyLive) hide(el);
                });
                document.querySelectorAll('[role="separator"],hr,.ms-Divider,[class*="divider"],[class*="Divider"],[class*="separator"]').forEach((el) => {
                    if (el.__nxHidden || el.closest('[contenteditable]')) return;
                    const parent = el.parentElement;
                    if (!parent) return;
                    const kids = Array.from(parent.children);
                    const idx = kids.indexOf(el);
                    let before = -1, after = -1;
                    for (let i = idx - 1; i >= 0; i--) {
                        const k = kids[i];
                        if (k.__nxHidden || k.style.display === 'none' || k.matches('[role="separator"],hr,.ms-Divider,[class*="divider"],[class*="Divider"],[class*="separator"]')) continue;
                        before = i; break;
                    }
                    for (let i = idx + 1; i < kids.length; i++) {
                        const k = kids[i];
                        if (k.__nxHidden || k.style.display === 'none' || k.matches('[role="separator"],hr,.ms-Divider,[class*="divider"],[class*="Divider"],[class*="separator"]')) continue;
                        after = i; break;
                    }
                    // A divider without a visible item on both sides only separates removed items.
                    if (before === -1 || after === -1) hide(el);
                });
            }
            lock();
            setInterval(lock, 400);
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: false)
    }()

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
        var result = sourceView.convert(webFrame, to: controller.view)
        // Keep the webview above the home indicator so Word's unpainted area doesn't show as a white strip.
        let bottomInset = controller.view.safeAreaInsets.bottom
        if bottomInset > 0 {
            result.size.height -= bottomInset
        }
        return result
    }

    /// Repositions the native webview when the renderer header height changes.
    @MainActor private func resize(payload: Any?) {
        guard let ms365WebView else { return }
        ms365WebView.frame = nativeFrame(from: (payload as? [String: Any])?["frame"])
    }

    /// Hides/shows the native webview so renderer popups (PDF/image previews, dialogs) stay visible.
    @MainActor private func setHidden(_ hidden: Bool) {
        ms365Hidden = hidden
        ms365WebView?.isHidden = hidden
    }

    /// Reloads the share link (mirrors Electron reload-browser-view).
    @MainActor private func reload() {
        guard let ms365WebView, !ms365Url.isEmpty, let url = URL(string: ms365Url) else { return }
        ms365WebView.load(URLRequest(url: url))
    }

    /// Removes the native Microsoft 365 view and its navigation state.
    @MainActor private func close() {
        ms365WebView?.stopLoading()
        ms365WebView?.navigationDelegate = nil
        ms365WebView?.uiDelegate = nil
        ms365WebView?.removeFromSuperview()
        ms365WebView = nil
        ms365Hidden = false
    }

    private func host(_ host: String, matches domain: String) -> Bool {
        host == domain || host.hasSuffix("." + domain)
    }

    /// Allows only normalized HTTPS Microsoft 365 / OneDrive / Office / auth URLs.
    private func isNavigationAllowed(_ url: URL) -> Bool {
        guard
            url.scheme?.lowercased() == "https",
            url.user == nil,
            url.password == nil,
            url.port == nil || url.port == 443,
            let rawHost = url.host
        else { return false }
        let targetHost = rawHost.lowercased()
        return allowedHostSuffixes.contains { host(targetHost, matches: $0) }
    }

    /// Subframes (the Wac editors) navigate freely; main-frame navigation is restricted to the allowlist.
    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if let targetFrame = navigationAction.targetFrame, !targetFrame.isMainFrame {
            decisionHandler(.allow)
            return
        }
        guard let targetUrl = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if isNavigationAllowed(targetUrl) {
            decisionHandler(.allow)
        } else {
            log?.warn("microsoft365 @ navigation: blocked main-frame navigation to \(targetUrl.absoluteString)")
            decisionHandler(.cancel)
        }
    }

    /// Denies new windows (mirrors Electron's setWindowOpenHandler deny).
    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        return nil
    }

    /// Shows the page once the initial load finished (unless collapsed by a renderer popup).
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        log?.info("microsoft365 @ didFinish: loaded \(webView.url?.absoluteString ?? "unknown")")
        if !ms365Hidden { webView.isHidden = false }
        IPCBridge.shared.send("ms365-loaded")
    }

    /// Reports navigation failures so Vue can stop its loading indicator.
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard reportableLoadError(error) else { return }
        log?.error("microsoft365 @ didFail: \(webView.url?.absoluteString ?? "unknown") – \(error.localizedDescription)")
        IPCBridge.shared.send("ms365-load-failed", ["message": error.localizedDescription])
    }

    /// Reports failures that happen before a Microsoft 365 page starts loading.
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard reportableLoadError(error) else { return }
        log?.error("microsoft365 @ didFailProvisionalNavigation: \(webView.url?.absoluteString ?? "unknown") – \(error.localizedDescription)")
        IPCBridge.shared.send("ms365-load-failed", ["message": error.localizedDescription])
    }

    /// NSURLErrorCancelled (-999) fires on every superseded navigation (redirects, reloads, SPA
    /// navigations) and would make Vue show a spurious "could not be loaded" dialog; only report
    /// genuine failures (host not found, TLS, timeout, …).
    private func reportableLoadError(_ error: Error) -> Bool {
        guard let nsError = error as? URLError else { return true }
        return nsError.code != .cancelled
    }
}
