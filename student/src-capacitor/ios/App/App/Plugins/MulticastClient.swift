import Capacitor
import Foundation
import Darwin
import CryptoKit

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
    private let action: () async -> Void
    private let interval: TimeInterval

    init(action: @escaping () async -> Void, intervalMs: Double) {
        self.action   = action
        self.interval = intervalMs / 1_000
    }

    func start() {
        DispatchQueue.main.async {
            self.timer = Timer.scheduledTimer(
                withTimeInterval: self.interval,
                repeats: true
            ) { [weak self] __ in
                guard let self else { return }
                Task { await self.action() }
            }
        }
    }

    func stop() {
        DispatchQueue.main.async {
            self.timer?.invalidate()
            self.timer = nil
        }
    }
}

// MARK: - MulticastClient

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
@objc(MulticastClient)
public final class MulticastClient: CAPPlugin, CAPBridgedPlugin {

    // MARK: CAPBridgedPlugin requirements

    public let identifier    = "MulticastClient"
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

    var serverstatus  = ServerStatus()
    var clientinfo    = ClientInfo()
    var beaconsLost: Int  = 0
    var kicked: Bool      = false

    // MARK: - Capacitor Lifecycle

    /**
     * Called automatically when the plugin is registered with Capacitor.
     * Mirrors the JS pattern of `export default new MulticastClient()` where
     * construction immediately wires up the socket.
     */
    public override func load() {
        //pluginLog(.info, "MulticastClient loaded – starting multicast listener")
        startMulticast()
        IPCBridge.shared.handle("getinfoasync") { [weak self] _ throws -> Any? in
            guard let self else { throw PluginError.notInitialized }

            return await self.getinfoasync().asDictionary
        }
        
        IPCBridge.shared.handle("pingexamserver") { [weak self] payload async throws -> Any? in
            guard let dict = payload as? [String: Any],
                  let serverip = dict["serverip"] as? String,
                  !serverip.isEmpty else {
                return ["ok": false]
            }
            do {
                let urlString = "https://\(serverip):\(Config.serverApiPort)/server/control/pong"
                guard let url = URL(string: urlString) else { return ["ok": false] }
                var request = URLRequest(url: url, timeoutInterval: 4.0)
                request.httpMethod = "GET"
                request.setValue("NEXT_EXAM_API_SECRET", forHTTPHeaderField: "x-next-exam-app-secret")
                let delegate = LocalNetworkSessionDelegate()
                let session = URLSession(configuration: .default, delegate: delegate, delegateQueue: nil)
                let (_, response) = try await session.data(for: request)
                let ok = (response as? HTTPURLResponse)?.statusCode == 200
                return ["ok": ok]
            } catch {
                return ["ok": false]
            }
        }
        
        IPCBridge.shared.on("register") { [weak self] event in
            guard let self else {
                event.returnValue = ["error": "not initialized"]
                return
            }
            guard let args = event.args as? [Any],
                  let payload = args.first as? [String: Any] else {
                event.returnValue = ["error": "Invalid payload"]
                return
            }
            
            event.deferReturn()

            Task {
                do {
                    let result = try await self.register(args: payload)
                    event.resolve(result)
                } catch {
                    event.resolve(["error": error.localizedDescription])
                }
            }
        }
        
        IPCBridge.shared.handle("switch-exam-section") { [weak self] payload async throws -> Any? in
            guard let self else { throw IPCError.noHandler("not initialized") }
            guard let sectionNumber = payload as? Int else {
                throw IPCError.invalidPayload("Expected section number")
            }
            await switchExamSection(multicastClient: self, serverstatus: self.serverstatus, newSectionNumber: sectionNumber)
            return ["status": "success"]
        }
        
        IPCBridge.shared.on("gracefullyexit") { [weak self] payload throws in
            CommunicationHandler.shared.gracefullyEndExam()
            CommunicationHandler.shared.resetConnection()
        }
        
        IPCBridge.shared.on("disconnect") { [weak self] payload throws in
            CommunicationHandler.shared.resetConnection()
        }

        CommunicationHandler.shared.initialize(multicastClient: self)
        ScreenshotHandler.shared.initialize(multicastClient: self)
    }
    
    private func getinfoasync() async -> GetInfoAsync {
        return GetInfoAsync(
            serverlist: _examServerList,
            clientinfo: clientinfo,
            serverstatus: serverstatus,
            battery: getBatteryLevel()
        )
    }

    private func getBatteryLevel() -> Float {
        var batteryLevel = UIDevice.current.batteryLevel
        if (batteryLevel == -1) {
            batteryLevel = 1
        }
        return batteryLevel
    }
    
    private func register(args: [String: Any]) async throws -> [String: Any] {
        // MARK: Extract Arguments
        guard
            let clientname = args["clientname"] as? String,
            let pin        = args["pin"]        as? String,
            let serverip   = args["serverip"]   as? String,
            let servername = args["servername"] as? String,
            let bipuserID  = args["bipuserID"]  as? String
        else {
            return ["sender": "client", "status": "error", "message": "Missing required arguments, clientname: \(args["clientname"] ?? "nil"), pin: \(args["pin"] ?? "nil"), serverip: \(args["serverip"] ?? "nil"), servername: \(args["servername"] ?? "nil"), bipuserID: \(args["bipuserID"] ?? "nil")"]
        }
        
        let clientip = Config.hostip // ?? getIPAddress()
        let hostname = ProcessInfo.processInfo.hostName
        let version  = Config.version
        
        // MARK: Guard Against Duplicate Registration
        guard self.clientinfo.token == nil else {
            return [
                "sender":  "client",
                "status":  "error",
                "message": NSLocalizedString("control.alreadyregistered", comment: "")
            ]
        }
        
        // MARK: Build URL
        let urlString = "https://\(serverip):\(Config.serverApiPort)/server/control/registerclient/\(servername)"
        guard let url = URL(string: urlString) else {
            return ["sender": "client", "status": "error", "message": "Invalid URL"]
        }
        
        // MARK: Encrypt Payload & Fire Request
        do {
            // Encrypt the registration payload and derive sessionRef from the pin
            let payload = RegistrationPayload(
                pin: pin,
                clientname: clientname,
                clientip: clientip,
                hostname: hostname,
                version: version,
                bipuserID: bipuserID
            )
            
            let packet = try self.prepareSecurePayload(data: payload, sessionRef: pin)
            
            var request = URLRequest(url: url, timeoutInterval: 8.0) // 8-second timeout
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("NEXT_EXAM_API_SECRET", forHTTPHeaderField: "x-next-exam-app-secret")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["packet": packet.asDictionary])
            
            let delegate = LocalNetworkSessionDelegate()
            let session = URLSession(
                configuration: .default,
                delegate: delegate,
                delegateQueue: nil
            )
            
            let (data, _) = try await session.data(for: request)
            let response  = try JSONDecoder().decode(RegistrationResponse.self, from: data)
            
            // MARK: Handle Success
            if response.status == "success" {
                self.clientinfo.name       = clientname
                self.clientinfo.serverip   = serverip
                self.clientinfo.servername = servername
                self.clientinfo.ip         = clientip
                self.clientinfo.hostname   = hostname
                self.clientinfo.token      = response.token  // stored to validate critical API calls
                self.clientinfo.focus      = true
                self.clientinfo.pin        = pin
                
                print("ipchandler @ register: successfully registered at \(servername) @ \(serverip) as \(clientname)")
                print("ipchandler @ register: successfully registered, response: ", response)
                
                // Notify so screenshot scheduler can start immediately on successful connect
                NotificationCenter.default.post(
                    name: Notification.Name("screenshot-config"),
                    object: nil,
                    userInfo: [
                        "screenshotinterval": self.clientinfo.screenshotinterval as Any,
                        "serverip":           self.clientinfo.serverip           as Any
                    ]
                )
                
                // Create exam folder inside workfolder
                let uniqueExamName = "\(servername)-\(pin)"
                let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first!
                let examDirectory = docs.appendingPathComponent(uniqueExamName)
                Config.examdirectory = examDirectory.path
                
                if !FileManager.default.fileExists(atPath: examDirectory.path) {
                    try FileManager.default.createDirectory(
                        at: examDirectory,
                        withIntermediateDirectories: true
                    )
                }
                
                return ["status": "success", "token": response.token ?? ""]
                
                // MARK: Handle Failure / Version Mismatch
            } else {
                if let serverVersion = response.version {
                    let comparison = self.compareSoftware(
                        versionA: serverVersion,
                        statusA:    response.versioninfo ?? "",
                        versionB:  Config.version,
                        statusB:     Config.info
                    )
                    
                    switch comparison {
                    case let c where c > 0:
                        return ["status": "error",
                                "message": "Ihre Version von Next-Exam ist neuer als die der Lehrperson!"]
                    case let c where c < 0:
                        return ["status": "error",
                                "message": "Ihre Version von Next-Exam ist zu alt. Laden sie sich eine aktuelle Version herunter!"]
                    default:
                        return ["status": "error",
                                "message": "Unbekannter Fehler beim Verbindungsaufbau."]
                    }
                }
                
                return ["status": "error", "message": response.message ?? "Unknown error"]
            }
            
            // MARK: Error Handling
        } catch {
            var errorMessage = error.localizedDescription
            let nsError = error as NSError
            
            // Remap timeout error to a friendlier message
            if nsError.domain == NSURLErrorDomain, nsError.code == NSURLErrorTimedOut {
                errorMessage = "The request timed out"
            }
            
            print("ipchandler @ register: \(errorMessage)")
            
#if os(macOS)
            // On macOS, permission issues can sometimes block network access.
            // Check and optionally reset network permissions.
            let resetResponse = await ensureNetworkOrReset(
                serverip: serverip,
                port: self.config.serverApiPort
            )
            if resetResponse == "reset" {
                DispatchQueue.main.async { NSApplication.shared.terminate(nil) }
                return [:]
            }
#endif
            
            return [
                "sender":  "client",
                "status":  "error",
                "message": "Es gibt ein Problem mit dem Netzwerk, den Firewallregeln oder den Netzwerkberechtigungen! " +
                "Bitte beheben sie dieses Problem und starten Sie Next-Exam neu!"
            ]
        }
    }
    
    func prepareSecurePayload<T: Encodable>(
        data: T,
        sessionRef: String
    ) throws -> EncryptedPacket {

        let jsonData = try JSONEncoder().encode(data)
        return try encryptAESGCM(jsonData, sessionRef: sessionRef)
    }
    
    func prepareSecurePayload(
        _ data: [String: Any],
        sessionRef: String
    ) throws -> EncryptedPacket {

        guard let jsonData = try? JSONSerialization.data(withJSONObject: data) else {
            throw SecurePayloadError.jsonSerializationFailed
        }
        return try encryptAESGCM(jsonData, sessionRef: sessionRef)
    }
    
    private func deriveSymmetricKey(from sessionRef: String) throws -> SymmetricKey {

        // (sessionRef + "0").padEnd(32, "0").slice(0, 32)
        var raw = sessionRef + "0"
        if raw.count < 32 {
            raw += String(repeating: "0", count: 32 - raw.count)
        }
        let keyString = String(raw.prefix(32)) // Exactly 32 chars / bytes (ASCII)

        guard
            let keyData = keyString.data(using: .utf8),
            keyData.count == 32
        else {
            throw SecurePayloadError.invalidKeyEncoding
        }

        return SymmetricKey(data: keyData) // AES-256
    }
    
    private func encryptAESGCM(
        _ plaintext: Data,
        sessionRef: String
    ) throws -> EncryptedPacket {

        let key = try deriveSymmetricKey(from: sessionRef)

        // AES.GCM.seal auto-generates a cryptographically random 12-byte nonce
        // (matches: crypto.getRandomValues(new Uint8Array(12)))
        let sealedBox = try AES.GCM.seal(plaintext, using: key)

        // Extract the 12-byte nonce as Data
        // Matches JS: btoa(String.fromCharCode(...iv))
        let ivData = sealedBox.nonce.withUnsafeBytes { Data($0) }

        // JS crypto.subtle.encrypt (AES-GCM) returns: ciphertext || 16-byte auth tag
        // Matches JS: btoa(String.fromCharCode(...new Uint8Array(buf)))
        let ciphertextAndTag = sealedBox.ciphertext + sealedBox.tag

        return EncryptedPacket(
            v: ivData.base64EncodedString(),
            d: ciphertextAndTag.base64EncodedString()
        )
    }
    
    private func compareVersions(_ versionA: String, _ versionB: String) -> Int {

        // Split by "." and convert each part to Int, defaulting to 0 on failure
        // Mirrors: versionA.split('.').map(Number)
        let partsA = versionA.split(separator: ".").map { Int($0) ?? 0 }
        let partsB = versionB.split(separator: ".").map { Int($0) ?? 0 }

        let maxLength = max(partsA.count, partsB.count)

        for i in 0..<maxLength {
            // Fallback to 0 if index is out of range
            // Mirrors: partsA[i] || 0
            let numA = i < partsA.count ? partsA[i] : 0
            let numB = i < partsB.count ? partsB[i] : 0

            if numA < numB { return -1 }
            if numA > numB { return  1 }
        }

        return 0
    }

    private func compareReleaseNumbers(_ statusA: String, _ statusB: String) -> Int {

        // Extract the first sequence of digits from the status string
        // Mirrors: parseInt(status.match(/\d+/), 10) || 0
        let numberA = firstNumber(in: statusA)
        let numberB = firstNumber(in: statusB)

        if numberA < numberB { return -1 }
        if numberA > numberB { return  1 }
        return 0
    }

    private func compareSoftware(
        versionA: String, statusA: String,
        versionB: String, statusB: String
    ) -> Int {

        // Version takes priority; only fall through to release number if equal
        let versionComparison = compareVersions(versionA, versionB)
        guard versionComparison == 0 else { return versionComparison }

        return compareReleaseNumbers(statusA, statusB)
    }

    private func firstNumber(in string: String) -> Int {
        guard let range = string.range(of: #"\d+"#, options: .regularExpression) else {
            return 0
        }
        return Int(string[range]) ?? 0
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
        print("MulticastClient \(tag) \(message)")
    }

    private func errnoString() -> String {
        String(cString: strerror(errno))
    }
}
