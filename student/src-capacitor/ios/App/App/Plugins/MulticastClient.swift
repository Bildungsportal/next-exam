import Capacitor
import Foundation
import Darwin

// MARK: - Configuration

struct AppConfig {
    static let multicastClientPort: UInt16 = 6024
    static let multicastServerAddr: String = "239.1.1.1"
    static let hostip: String              = "0.0.0.0"
    static let version: String             = "2.0.0.1"
}

/// Repeatedly invokes `action` every `intervalMs` milliseconds on the main run-loop.
final class SchedulerService {

    private var timer: Timer?
    private let action: () -> Void
    private let interval: TimeInterval

    init(action: @escaping () -> Void, intervalMs: Double) {
        self.action   = action
        self.interval = intervalMs / 1_000
    }

    func start() {
        DispatchQueue.main.async {
            self.timer = Timer.scheduledTimer(
                withTimeInterval: self.interval,
                repeats: true
            ) { [weak self] _ in self?.action() }
        }
    }

    func stop() {
        DispatchQueue.main.async {
            self.timer?.invalidate()
            self.timer = nil
        }
    }
}

// MARK: - MulticastClientPlugin

/**
 * Capacitor plugin that wraps the multicast UDP listener.
 *
 * `load()` is called automatically by Capacitor when the plugin is registered,
 * which starts the listener immediately – mirroring `export default new MulticastClient()`
 * combined with the Electron `app.whenReady` startup hook.
 *
 * JS events emitted:
 *   • "examServerFound" – payload: ServerInfo dict
 *   • "examServerLost"  – payload: ServerInfo dict
 */
@objc(MulticastClientPlugin)
public final class MulticastClientPlugin: CAPPlugin, CAPBridgedPlugin {

    // MARK: CAPBridgedPlugin requirements

    public let identifier    = "MulticastClientPlugin"
    public let jsName        = "MulticastClient"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start",             returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop",              returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getExamServerList", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getClientInfo",     returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "updateClientInfo",  returnType: CAPPluginReturnPromise),
    ]

    // MARK: Private state

    private var socketFD:  Int32 = -1
    private var isRunning: Bool  = false

    /// Dedicated serial queue that runs the blocking `recvfrom` loop.
    private let receiveQueue = DispatchQueue(
        label: "com.multicastclient.receive",
        qos: .utility
    )

    /// Reader-writer queue protecting `_examServerList`.
    private let dataQueue = DispatchQueue(
        label: "com.multicastclient.data",
        attributes: .concurrent
    )

    private var _examServerList: [ServerInfo] = []
    private var refreshExamsScheduler: SchedulerService?

    // MARK: Public state

    /// Thread-safe read access to the discovered server list.
    private(set) var examServerList: [ServerInfo] {
        get { dataQueue.sync { _examServerList } }
        set { dataQueue.async(flags: .barrier) { self._examServerList = newValue } }
    }

    var serverstatus: [String: Any] = [:]
    var clientinfo    = ClientInfo()

    // MARK: - Capacitor Lifecycle

    /**
     * Called automatically when the plugin is registered with Capacitor.
     * Mirrors the JS pattern of `export default new MulticastClient()` where
     * construction immediately wires up the socket.
     */
    public override func load() {
        //pluginLog(.info, "MulticastClientPlugin loaded – starting multicast listener")
        startMulticast()
        IPCBridge.shared.onInvoke("getinfoasync") { [weak self] _ throws -> Any? in
            guard let self else { throw PluginError.notInitialized }
            return self.getinfoasync().asDictionary
        }
    }
    
    private func getinfoasync() -> GetInfoaAsync {
        return GetInfoaAsync(
            serverlist: _examServerList,
            clientinfo: clientinfo,
            serverstatus: ServerStatus(
                exammode: true,
                delfolderonexit: false,
                spellcheck: true,
                spellchecklang: "de-DE",
                suggestions: false,
                moodleTestType: "",
                moodleDomain: "",
                screenshotinterval: 0,
                msOfficeFile: false,
                screenslocked: false,
                pin: "0000",
                unlockonexit: false,
                fontfamily: "sans-serif",
                moodleTestId: "",
                languagetool: false,
                password: "sfdsf",
                useExamSections: false,
                activeSection: 1,
                lockedSection: 1,
                examSections: [
                    1: ExamSection(
                        examtype: "math",
                        cmargin: CMargin(side: "right", size: 3),
                        linespacing: "2",
                        audioRepeat: 3,
                        languagetool: false,
                        spellchecklang: "de-DE",
                        suggestions: false
                    )
                ]
            )
        )
    }

    // MARK: - JS-Callable Plugin Methods

    /// (Re-)starts the multicast listener from JavaScript.
    @objc public func start(_ call: CAPPluginCall) {
        startMulticast()
        call.resolve(["status": "started"])
    }

    /// Stops the multicast listener from JavaScript.
    @objc public func stop(_ call: CAPPluginCall) {
        let ifaceAddr = call.getString("interfaceAddr")
        stopMulticast(interfaceAddr: ifaceAddr)
        call.resolve(["status": "stopped"])
    }

    /// Returns the current discovered exam-server list to JavaScript.
    @objc public func getExamServerList(_ call: CAPPluginCall) {
        let list = examServerList.map { $0.asDictionary }
        call.resolve(["servers": list])
    }

    /// Returns the current `clientinfo` object to JavaScript.
    @objc public func getClientInfo(_ call: CAPPluginCall) {
        call.resolve(clientinfo.asDictionary)
    }

    /// Allows JavaScript to update individual fields in `clientinfo`.
    @objc public func updateClientInfo(_ call: CAPPluginCall) {
        if let name          = call.getString("name")          { clientinfo.name          = name }
        if let group         = call.getString("group")         { clientinfo.group         = group }
        if let token         = call.getString("token")         { clientinfo.token         = token }
        if let pin           = call.getString("pin")           { clientinfo.pin           = pin }
        if let examtype      = call.getString("examtype")      { clientinfo.examtype      = examtype }
        if let focus         = call.getBool("focus")           { clientinfo.focus         = focus }
        if let exammode      = call.getBool("exammode")        { clientinfo.exammode      = exammode }
        if let screenlock    = call.getBool("screenlock")      { clientinfo.screenlock    = screenlock }
        if let localLockdown = call.getBool("localLockdown")   { clientinfo.localLockdown = localLockdown }
        if let virtualized   = call.getBool("virtualized")     { clientinfo.virtualized   = virtualized }
        if let msofficeshare = call.getBool("msofficeshare")   { clientinfo.msofficeshare = msofficeshare }
        if let printrequest  = call.getBool("printrequest")    { clientinfo.printrequest  = printrequest }
        if let interval      = call.getInt("screenshotinterval") { clientinfo.screenshotinterval = interval }
        if let subnum        = call.getInt("submissionnumber") { clientinfo.submissionnumber = subnum }
        // Extend as needed …
        call.resolve(clientinfo.asDictionary)
    }

    // MARK: - Internal Start / Stop

    private func startMulticast() {
        guard socketFD < 0 else {
            pluginLog(.info, "multicastclient @ startMulticast: listener already running")
            return
        }

        // ── 1. Create UDP socket ───────────────────────────────────────────
        socketFD = socket(AF_INET, SOCK_DGRAM, 0)
        guard socketFD >= 0 else {
            pluginLog(.error, "multicastclient @ startMulticast: socket() failed – \(errnoString())")
            return
        }

        // ── 2. SO_REUSEADDR + SO_REUSEPORT  (mirrors reuseAddr: true) ──────
        var reuse: Int32 = 1
        setsockopt(socketFD, SOL_SOCKET, SO_REUSEADDR,
                   &reuse, socklen_t(MemoryLayout<Int32>.size))
        setsockopt(socketFD, SOL_SOCKET, SO_REUSEPORT,
                   &reuse, socklen_t(MemoryLayout<Int32>.size))

        // ── 3. Bind to INADDR_ANY : PORT ───────────────────────────────────
        var addr             = sockaddr_in()
        addr.sin_len         = UInt8(MemoryLayout<sockaddr_in>.size)
        addr.sin_family      = sa_family_t(AF_INET)
        addr.sin_port        = AppConfig.multicastClientPort.bigEndian
        addr.sin_addr.s_addr = INADDR_ANY

        let bindResult = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.bind(socketFD, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
            }
        }

        guard bindResult == 0 else {
            pluginLog(.error, "multicastclient @ startMulticast: bind() failed – \(errnoString())")
            Darwin.close(socketFD)
            socketFD = -1
            return
        }

        // ── 4. Socket options ──────────────────────────────────────────────

        // setBroadcast(true)  – optional for multicast receive; mirrors JS try/catch
        var broadcast: Int32 = 1
        setsockopt(socketFD, SOL_SOCKET, SO_BROADCAST,
                   &broadcast, socklen_t(MemoryLayout<Int32>.size))

        // setMulticastTTL(128)
        var ttl: UInt8 = 128
        setsockopt(socketFD, IPPROTO_IP, IP_MULTICAST_TTL,
                   &ttl, socklen_t(MemoryLayout<UInt8>.size))

        // ── 5. addMembership(MULTICAST_ADDR, hostip) ───────────────────────
        var mreq                  = ip_mreq()
        mreq.imr_multiaddr.s_addr = inet_addr(AppConfig.multicastServerAddr)
        mreq.imr_interface.s_addr = inet_addr(
            AppConfig.hostip.isEmpty ? "0.0.0.0" : AppConfig.hostip)

        if setsockopt(socketFD, IPPROTO_IP, IP_ADD_MEMBERSHIP,
                      &mreq, socklen_t(MemoryLayout<ip_mreq>.size)) != 0 {
            pluginLog(.error, "Multicast join failed: \(errnoString())")
        } else {
            pluginLog(.info,
                "UDP MC Client bound to 0.0.0.0:\(AppConfig.multicastClientPort) " +
                "and joined \(AppConfig.multicastServerAddr)")
        }

        // ── 6. Start blocking receive loop on a background thread ──────────
        isRunning = true
        receiveQueue.async { [weak self] in self?.receiveLoop() }

        // ── 7. Deprecated-instance scheduler every 5 s ────────────────────
        refreshExamsScheduler = SchedulerService(
            action: { [weak self] in self?.isDeprecatedInstance() },
            intervalMs: 5_000
        )
        refreshExamsScheduler?.start()
    }

    private func stopMulticast(interfaceAddr: String? = nil) {
        guard socketFD >= 0 else { return }

        isRunning = false
        refreshExamsScheduler?.stop()
        refreshExamsScheduler = nil

        // Drop multicast membership before closing
        var mreq                  = ip_mreq()
        mreq.imr_multiaddr.s_addr = inet_addr(AppConfig.multicastServerAddr)
        let iface = interfaceAddr ?? AppConfig.hostip
        mreq.imr_interface.s_addr = inet_addr(iface.isEmpty ? "0.0.0.0" : iface)
        setsockopt(socketFD, IPPROTO_IP, IP_DROP_MEMBERSHIP,
                   &mreq, socklen_t(MemoryLayout<ip_mreq>.size))

        Darwin.close(socketFD)
        socketFD = -1
        pluginLog(.info, "multicastclient: socket closed")
    }

    // MARK: - Receive Loop

    private func receiveLoop() {
        let bufferSize = 65_536
        var buffer     = [UInt8](repeating: 0, count: bufferSize)

        while isRunning {
            var sender    = sockaddr_in()
            var senderLen = socklen_t(MemoryLayout<sockaddr_in>.size)

            let bytesRead = withUnsafeMutablePointer(to: &sender) { ptr in
                ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                    recvfrom(socketFD, &buffer, bufferSize, 0, $0, &senderLen)
                }
            }

            switch bytesRead {
            case let n where n > 0:
                // Decode sender IP with inet_ntop (thread-safe, unlike inet_ntoa)
                var ipBuf  = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
                var inAddr = sender.sin_addr
                inet_ntop(AF_INET, &inAddr, &ipBuf, socklen_t(INET_ADDRSTRLEN))
                let senderIP   = String(cString: ipBuf)
                let senderPort = Int(sender.sin_port.bigEndian)

                messageReceived(data: Data(buffer[0..<n]),
                                senderIP: senderIP,
                                senderPort: senderPort)

            case let n where n < 0:
                // Socket was deliberately closed – exit the loop cleanly
                if errno == EBADF || errno == EINVAL || errno == ENOTSOCK { return }
                // EINTR = signal interrupted; just retry
                if errno != EINTR {
                    pluginLog(.error, "multicastclient @ receiveLoop: \(errnoString())")
                }

            default:
                break // n == 0 shouldn't occur on UDP
            }
        }
    }

    // MARK: - Message Handling

    /**
     * Parses a beacon, fills in the sender's network address, then either
     * adds it to the list (new) or refreshes its timestamp (known).
     *
     * Mirrors: `messageReceived(message, rinfo)`
     */
    private func messageReceived(data: Data, senderIP: String, senderPort: Int) {
        
        guard var info = try? JSONDecoder().decode(ServerInfo.self, from: data) else {
            pluginLog(.error, "multicastclient @ messageReceived: JSON decode failed")
            return
        }
        
        info.serverip = senderIP
        info.serverport = senderPort
        info.reachable = true
        info.timestamp = Int64(Date().timeIntervalSince1970 * 1000)
        
        print("messageReceived \(info) \(senderIP) \(senderPort)")

        // Populate network fields (mirrors JS: serverInfo.serverip = rinfo.address)
        /*info.serverip   = senderIP
        info.serverport = senderPort
        info.reachable  = true*/
        // Use local timestamp so server clock skew doesn't matter (mirrors JS comment)
        //info.timestamp  = Date().timeIntervalSince1970 * 1_000 // epoch ms ≈ JS Date.getTime()

        dataQueue.async(flags: .barrier) { [weak self] in
            guard let self else { return }

            if self.isNewExamInstance(info) {
                self.pluginLog(.info,
                    "multicastclient @ messageReceived: " +
                    "Adding new Exam Instance \"\(info.servername)\" to Serverlist")
                self._examServerList.append(info)

                // Notify JS listeners – must be dispatched to the main thread
                let payload = info.asDictionary
                DispatchQueue.main.async {
                    self.notifyListeners("examServerFound", data: payload)
                }
            }
        }
    }

    /**
     * Returns `true` when `obj` has not been seen before;
     * refreshes the timestamp of an already-known server and returns `false`.
     *
     * ⚠️ Must be called from within a `dataQueue` barrier block.
     *
     * Mirrors: `isNewExamInstance(obj)`
     */
    private func isNewExamInstance(_ obj: ServerInfo) -> Bool {
        for i in 0..<_examServerList.count {
            if _examServerList[i].id == obj.id {
                _examServerList[i].timestamp = obj.timestamp // existing – refresh only
                return false
            }
        }
        return true
    }

    /**
     * Removes servers that have not sent a beacon in more than 16 seconds.
     * Called by the scheduler every 5 s.
     *
     * Mirrors: `isDeprecatedInstance()`
     */
    private func isDeprecatedInstance() {
        let nowMs = Int64(Date().timeIntervalSince1970 * 1_000)

        dataQueue.async(flags: .barrier) { [weak self] in
            guard let self else { return }

            var i = 0
            while i < self._examServerList.count {
                let ts = self._examServerList[i].timestamp

                if nowMs - 16_000 > ts {
                    let removed = self._examServerList[i]
                    self.pluginLog(.warn,
                        "multicastclient @ isDeprecatedInstance: " +
                        "Removing inactive server '\(removed.servername)' from list")
                    self._examServerList.remove(at: i)

                    // Notify JS listeners that a server has gone away
                    let payload = removed.asDictionary
                    DispatchQueue.main.async {
                        self.notifyListeners("examServerLost", data: payload)
                    }
                } else {
                    i += 1
                }
            }
        }
    }

    // MARK: - Helpers

    private enum LogLevel { case info, warn, error }

    private func pluginLog(_ level: LogLevel, _ message: String) {
        let tag: String
        switch level {
        case .info:  tag = "[INFO] "
        case .warn:  tag = "[WARN] "
        case .error: tag = "[ERROR]"
        }
        // Replace with CAPLog or os.Logger in production
        print("MulticastClientPlugin \(tag) \(message)")
    }

    private func errnoString() -> String {
        String(cString: strerror(errno))
    }
}
