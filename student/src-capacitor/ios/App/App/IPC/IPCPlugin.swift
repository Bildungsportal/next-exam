import Capacitor
import Foundation
import WebKit

@objc(IPCPlugin)
public class IPCPlugin: CAPPlugin, CAPBridgedPlugin {
    
    // ── CAPBridgedPlugin conformance (required in Capacitor 6+) ──────────────
    public let identifier = "IPCPlugin"
    public let jsName = "IPC"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "send",   returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "invoke", returnType: CAPPluginReturnPromise),
    ]
    
    public static weak var shared: IPCPlugin?

    public override func load() {
        IPCPlugin.shared = self
        injectSendSyncScript()
    }
    
    deinit {}

    // ── Plugin Methods ────────────────────────────────────────────────────────

    @objc func send(_ call: CAPPluginCall) {
        guard let channel = call.getString("channel") else { call.resolve(["error": "channel required"]); return }
        do {
            let result = try IPCBridge.shared.dispatchSend(channel, payload: call.options["payload"])
            call.resolve(["result": result as Any])
        } catch let error  {
            call.resolve(["error": error.localizedDescription])
        }
    }

    @objc func invoke(_ call: CAPPluginCall) {
        guard let channel = call.getString("channel") else { call.resolve(["error": "channel required"]); return }
        Task {
            do {
                let result = try await IPCBridge.shared.dispatchInvoke(channel, payload: call.options["payload"])
                call.resolve(["result": result as Any])
            } catch let error {
                call.reject(error.localizedDescription)
            }
        }
    }

    // ── Emit (Native → Web) ───────────────────────────────────────────────────

    public func send(channel: String, payload: Any? = nil) {
        notifyListeners(channel, data: ["payload": payload as Any])
    }
    
    // MARK: - Send to renderer (for event.sender.send / event.reply)

    func sendToRenderer(channel: String, data: Any?) {
        let json = Self.jsonEncode(data) ?? "null"
        let js = """
        window.dispatchEvent(new CustomEvent('ipc-message', {
            detail: { channel: '\(channel)', args: \(json) }
        }));
        """
        DispatchQueue.main.async { [weak self] in
            self?.bridge?.webView?.evaluateJavaScript(js)
        }
    }

    // MARK: - Inject JS for sendSync

    private func injectSendSyncScript() {
        let js = """
        (function() {
            if (window.__ipcSendSyncInstalled) return;
            window.__ipcSendSyncInstalled = true;

            window.ipcRendererSendSync = function(channel) {
                var args = Array.prototype.slice.call(arguments, 1);
                var payload = JSON.stringify(args);
                var raw = window.prompt('__IPC_SYNC__:' + channel, payload);
                try { return JSON.parse(raw); }
                catch(e) { return raw; }
            };
        })();
        """
        let script = WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false)
        bridge?.webView?.configuration.userContentController.addUserScript(script)
    }

    // MARK: - Helpers

    static func jsonEncode(_ value: Any?) -> String? {
        guard let value else { return "null" }
        if value is NSNull { return "null" }
        if let n = value as? NSNumber { return "\(n)" }
        if let s = value as? String {
            let data = try? JSONSerialization.data(withJSONObject: [s])
            if let data, let str = String(data: data, encoding: .utf8) {
                return String(str.dropFirst().dropLast())
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
