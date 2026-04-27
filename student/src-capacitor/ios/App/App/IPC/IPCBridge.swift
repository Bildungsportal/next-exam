import Foundation

// ── Type aliases ──────────────────────────────────────────────────────────────

public typealias SendHandler   = (Any?) throws -> Void
public typealias InvokeHandler = (Any?) throws -> Any?
public typealias SyncHandler   = (Any?) throws -> Any?

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

    private var sendHandlers:   [String: SendHandler]   = [:]
    private var invokeHandlers: [String: InvokeHandler] = [:]
    private var syncHandlers:   [String: SyncHandler]   = [:]

    // ── Public: Handler Registration ─────────────────────────────────────────

    /** Register a handler for ipcRenderer.send() */
    public func onSend(_ channel: String, _ handler: @escaping SendHandler) {
        sendHandlers[channel] = handler
    }

    /** Register a handler for ipcRenderer.invoke() */
    public func onInvoke(_ channel: String, _ handler: @escaping InvokeHandler) {
        invokeHandlers[channel] = handler
    }

    /** Register a handler for ipcRenderer.sendSync() */
    public func onSync(_ channel: String, _ handler: @escaping SyncHandler) {
        syncHandlers[channel] = handler
    }

    public func removeSend  (_ channel: String) { sendHandlers.removeValue(forKey: channel) }
    public func removeInvoke(_ channel: String) { invokeHandlers.removeValue(forKey: channel) }
    public func removeSync  (_ channel: String) { syncHandlers.removeValue(forKey: channel) }

    public func clearAll() {
        sendHandlers.removeAll()
        invokeHandlers.removeAll()
        syncHandlers.removeAll()
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
        guard let handler = sendHandlers[channel] else {
            throw IPCError.noHandler("No send handler for channel: \(channel)")
        }
        return try handler(payload)
    }

    internal func dispatchInvoke(_ channel: String, payload: Any?) throws -> Any? {
        guard let handler = invokeHandlers[channel] else {
            throw IPCError.noHandler("No invoke handler for channel: \(channel)")
        }
        return try handler(payload)
    }

    internal func dispatchSync(_ channel: String, payload: Any?) throws -> Any? {
        guard let handler = syncHandlers[channel] else {
            throw IPCError.noHandler("No sync handler for channel: \(channel)")
        }
        return try handler(payload)
    }
}
