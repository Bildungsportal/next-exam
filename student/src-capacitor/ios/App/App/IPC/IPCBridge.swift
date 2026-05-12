import Capacitor
import Foundation

// ── Type aliases ──────────────────────────────────────────────────────────────

public typealias SendHandler   = (Any?) throws -> Void
public typealias InvokeHandler = (Any?) async throws -> Any?
public typealias SendSyncHandler = (IPCMainEvent) -> Void

// ── Error ─────────────────────────────────────────────────────────────────────

public enum IPCError: LocalizedError {
    case noHandler(String)
    case invalidPayload(String)

    public var errorDescription: String? {
        switch self {
        case .noHandler(let msg):      return msg
        case .invalidPayload(let msg): return msg
        }
    }
}

// ── Bridge (ipcMain equivalent) ───────────────────────────────────────────────

public final class IPCBridge {

    public static let shared = IPCBridge()
    private init() {}

    private var sendHandlers:   [String: SendHandler] = [:]
    private var invokeHandlers: [String: InvokeHandler] = [:]
    private var sendSyncHandlers:   [String: SendSyncHandler] = [:]

    // ── Public: Handler Registration ─────────────────────────────────────────

    public func registerSendHandler(_ channel: String, _ handler: @escaping SendHandler) { sendHandlers[channel] = handler }
    public func registerInvokeHandler(_ channel: String, _ handler: @escaping InvokeHandler) { invokeHandlers[channel] = handler }
    public func registerSendSyncHandler(_ channel: String, _ handler: @escaping SendSyncHandler) { sendSyncHandlers[channel] = handler }

    public func removeSend  (_ channel: String) { sendHandlers.removeValue(forKey: channel) }
    public func removeInvoke(_ channel: String) { invokeHandlers.removeValue(forKey: channel) }
    public func removeSendSync  (_ channel: String) { sendSyncHandlers.removeValue(forKey: channel) }

    public func clearAll() {
        sendHandlers.removeAll()
        invokeHandlers.removeAll()
        sendSyncHandlers.removeAll()
    }

    // ── Public: Emit (Native → Web) ──────────────────────────────────────────

    public func emit(_ channel: String, payload: Any? = nil) {
        guard let plugin = IPCPlugin.shared else {
            print("[IPCBridge] emit() called before plugin loaded")
            return
        }
        plugin.emit(channel: channel, payload: payload)
    }

    // ── Internal: Dispatch (called by IPCPlugin + IPCSyncServer) ─────────────

    internal func dispatchSend(_ channel: String, payload: Any?) throws -> Any? {
        guard let handler = sendHandlers[channel] else { throw IPCError.noHandler("No send handler for channel: \(channel)") }
        return try handler(payload)
    }

    internal func dispatchInvoke(_ channel: String, payload: Any?) async throws -> Any? {
        guard let handler = invokeHandlers[channel] else { throw IPCError.noHandler("No invoke handler for channel: \(channel)") }
        return try await handler(payload)
    }

    internal func dispatchSendSync(_ event: IPCMainEvent) -> Void {
        guard let handler = sendSyncHandlers[event.channel] else {
            event.returnValue = ["error": "No sendSync handler for channel: \(event.channel)"]
            return
        }
        handler(event)
    }
}
