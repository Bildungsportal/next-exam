import Capacitor
import Foundation

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
    
    private var sendHandlers:   [String: (Any?) -> Void]  = [:]
    private var invokeHandlers: [String: (Any?) -> Any?]  = [:]
    private var syncHandlers:   [String: (Any?) -> Any?]  = [:]

    private var syncServer: AnyObject? // IPCSyncServer — type-erased for <iOS12

    public override func load() {
        IPCPlugin.shared = self
        if #available(iOS 12.0, *) {
            let server = IPCSyncServer(port: 7777) { [weak self] channel, payload in
                self?.syncHandlers[channel]?(payload)
            }
            server.start()
            syncServer = server
        }
    }
    
    deinit {
        if #available(iOS 12.0, *) { (syncServer as? IPCSyncServer)?.stop() }
    }

    // ── Plugin Methods ────────────────────────────────────────────────────────

    @objc func send(_ call: CAPPluginCall) {
        guard let channel = call.getString("channel") else {
            call.resolve(["error": "channel required"])
            return
        }
        do {
            let result = try IPCBridge.shared.dispatchSend(channel, payload: call.options["payload"])
            call.resolve(["result": result as Any])
        } catch let error  {
            call.resolve(["error": error.localizedDescription])
        }
    }

    @objc func invoke(_ call: CAPPluginCall) {
        guard let channel = call.getString("channel") else {
            call.resolve(["error": "channel required"])
            return
        }
        do {
            let result = try IPCBridge.shared.dispatchInvoke(channel, payload: call.options["payload"])
            call.resolve(["result": result as Any])
        } catch let error {
            call.resolve(["error": error.localizedDescription])
        }
    }

    // ── Emit (Native → Web) ───────────────────────────────────────────────────

    public func emit(channel: String, payload: Any? = nil) {
        notifyListeners(channel, data: ["payload": payload as Any])
    }
    
    // ── Handler Registration ──────────────────────────────────────────────────

    public func handleSend  (_ ch: String, _ fn: @escaping (Any?) -> Void)  { sendHandlers[ch]   = fn }
    public func handleInvoke(_ ch: String, _ fn: @escaping (Any?) -> Any?)  { invokeHandlers[ch] = fn }
    public func handleSync  (_ ch: String, _ fn: @escaping (Any?) -> Any?)  { syncHandlers[ch]   = fn }
}
