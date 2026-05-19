import Capacitor
import Foundation

// ── Type aliases ──────────────────────────────────────────────────────────────

public typealias OnHandler     = (Any?) throws -> Void
public typealias handleHandler   = (Any?) async throws -> Any?
public typealias OnSyncHandler = (IPCMainEvent) -> Void

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

    private var onHandlers:     [String: OnHandler] = [:]
    private var handleHandlers: [String: handleHandler] = [:]
    private var onSyncHandlers: [String: OnSyncHandler] = [:]

    // ── Public: Handler Registration ─────────────────────────────────────────

    public func on(_ channel: String, _ handler: @escaping OnHandler)     { onHandlers[channel] = handler }
    public func handle(_ channel: String, _ handler: @escaping handleHandler) { handleHandlers[channel] = handler }
    public func on(_ channel: String, _ handler: @escaping OnSyncHandler) { onSyncHandlers[channel] = handler }

    public func removeListener(_ channel: String) {
        onHandlers.removeValue(forKey: channel)
        onSyncHandlers.removeValue(forKey: channel)
    }
    public func removeHandler(_ channel: String) { handleHandlers.removeValue(forKey: channel) }

    public func clearAll() {
        onHandlers.removeAll()
        handleHandlers.removeAll()
        onSyncHandlers.removeAll()
    }
    
    deinit {
        clearAll()
    }

    // ── Public: Send (Native → Web) ──────────────────────────────────────────

    public func send(_ channel: String, _ payload: Any? = nil) {
        guard let plugin = IPCPlugin.shared else {
            print("[IPCBridge] send() called before plugin loaded")
            return
        }
        plugin.send(channel: channel, payload: payload)
    }

    // ── Internal: Dispatch (called by IPCPlugin + IPCSyncServer) ─────────────

    internal func dispatchSend(_ channel: String, payload: Any?) throws -> Any? {
        guard let handler = onHandlers[channel] else { throw IPCError.noHandler("No on handler for channel: \(channel)") }
        try handler(payload)
        return nil
    }

    internal func dispatchInvoke(_ channel: String, payload: Any?) async throws -> Any? {
        guard let handler = handleHandlers[channel] else { throw IPCError.noHandler("No handle handler for channel: \(channel)") }
        return try await handler(payload)
    }

    internal func dispatchSendSync(_ event: IPCMainEvent) {
        guard let handler = onSyncHandlers[event.channel] else {
            event.returnValue = ["error": "No onSync handler for channel: \(event.channel)"]
            return
        }
        handler(event)
    }
}
