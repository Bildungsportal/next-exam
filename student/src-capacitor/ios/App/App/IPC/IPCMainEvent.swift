import Foundation

/// Mirrors Electron's IpcMainEvent.
/// Handlers set `returnValue` to synchronously reply to `sendSync`.
public class IPCMainEvent {
    let channel: String
    let args: Any?

    /// Set this in your handler to return a value to `sendSync`.
    /// Analogous to Electron's `event.returnValue`.
    var returnValue: Any? = nil

    /// Reference back to the plugin so handlers can send async messages
    /// to the renderer (analogous to `event.sender`).
    weak var sender: IPCPlugin?
    
    /// When true, MainViewController won't call completionHandler immediately
    public private(set) var isDeferred = false
    private var deferredCompletion: ((Any?) -> Void)?

    init(channel: String, args: Any?, sender: IPCPlugin? = nil) {
        self.channel = channel
        self.args = args
        self.sender = sender
    }
    
    /// Call this to signal "I'll provide the return value later".
    /// Like holding onto a Promise's `resolve` in JS.
    public func deferReturn() {
        isDeferred = true
    }

    /// Call this when your async work is done — like `.then()`.
    /// Unblocks JS with the result.
    public func resolve(_ value: Any?) {
        deferredCompletion?(value)
        deferredCompletion = nil
    }

    /// Internal: MainViewController sets this
    internal func setCompletion(_ completion: @escaping (Any?) -> Void) {
        deferredCompletion = completion
    }

    /// Convenience: send an async message back to the renderer
    /// (like Electron's `event.reply(channel, data)`)
    func reply(_ replyChannel: String, _ data: Any? = nil) {
        sender?.sendToRenderer(channel: replyChannel, data: data)
    }
}
