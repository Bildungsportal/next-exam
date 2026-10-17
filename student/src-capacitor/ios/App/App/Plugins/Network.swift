import Capacitor
import CapacitorNetwork
import CoreLocation
import Foundation
import Network
import NetworkExtension

@objc(NetworkPlugin)
public class NetworkPlugin: CAPPlugin, CAPBridgedPlugin {
    private let log = LoggingHandler.shared
    public let identifier      = "NetworkPlugin"
    public let jsName          = "network"
    public let pluginMethods: [CAPPluginMethod] = []

    private let wifiMonitor  = NWPathMonitor(requiredInterfaceType: .wifi)
    
    @NetworkActor
    private var interfaces: [NetworkInterfaceInfo] = []
    private var preferredInterface: NetworkInterfaceInfo? = nil

    private let locationDelegate = WlanLocationDelegate()

    
    @NetworkActor
    public override func load() {
        IPCBridge.shared.handle("checkhostip") { [weak self] _ throws -> Any? in
            guard let self else { throw PluginError.notInitialized }
            return try await self.getNetworkInfo().asDictionary
        }
        IPCBridge.shared.handle("setPreferredInterface") { [weak self] payload in
            guard let self else { throw PluginError.notInitialized }
            guard let preferredName = payload as? String else {
                throw IPCError.noHandler("Invalid payload for channel: setPreferredInterface")
            }
            self.setPerferredInterface(preferredName: preferredName)
            return
        }
        IPCBridge.shared.handle("get-wlan-info") { [weak self] _ throws -> Any? in
            guard let self else { throw PluginError.notInitialized }
            return await self.getWlanInfo()
        }

        // Pre-request location before any exam lockdown: assessment sessions suppress system
        // prompts, so a first-time request during the exam would stay denied forever. The poll's
        // get-wlan-info then returns nopermissions and no SSID/quality reaches the exam header.
        Task { await self.locationDelegate.requestIfNeeded() }
    }

    deinit { wifiMonitor.cancel() }
    
    @NetworkActor
    private func getNetworkInfo() async throws -> CheckHostIP {
        let path = wifiMonitor.currentPath

        // ── Preferred interface: first WiFi interface NWPath is aware of ──────
        let preferredName = path.availableInterfaces
            .first(where: { $0.type == .wifi })?.name ?? "en0"

        // ── Enumerate all active IPv4 interfaces via POSIX ifaddrs ────────────
        self.interfaces = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddr) == 0 else { throw NetworkError.ipUnavailable }
        defer { freeifaddrs(ifaddr) }

        var ptr = ifaddr
        while ptr != nil {
            defer { ptr = ptr?.pointee.ifa_next }

            guard let iface   = ptr?.pointee,
                  let addrPtr = iface.ifa_addr,
                  addrPtr.pointee.sa_family == UInt8(AF_INET),  // IPv4 only
                  let namePtr = iface.ifa_name
            else { continue }

            let name = String(cString: namePtr)
            guard name != "lo0" else { continue }   // skip loopback

            var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
            getnameinfo(
                addrPtr,
                socklen_t(addrPtr.pointee.sa_len),
                &hostname, socklen_t(hostname.count),
                nil, socklen_t(0),
                NI_NUMERICHOST
            )
            self.interfaces.append(NetworkInterfaceInfo(
                name:    name,
                address: String(cString: hostname)
            ))
        }

        guard !self.interfaces.isEmpty else { throw NetworkError.ipUnavailable }

    
        let preferred: NetworkInterfaceInfo
        if let preferredInterface = self.preferredInterface,
           self.interfaces.contains(self.preferredInterface!) {
            preferred = preferredInterface
        } else {
            // ── Pick the preferred interface; fall back to first available ─────────
            preferred = (self.interfaces.first(where: { $0.name == preferredName }) ?? self.interfaces[0])
            self.preferredInterface = preferred
        }
        
        Config.hostip = preferred.address
        NotificationCenter.default.post(name: Notification.Name("NetworkInterfaceAvailable"), object: nil)

        return CheckHostIP(
            hostIP:               preferred.address,
            interface:            preferred.name,
            availableInterfaces:  interfaces,          // all non-loopback IPv4
            preferredInterface:   preferred.name       // NWPath-determined best
        )
    }
    
    @NetworkActor
    private func setPerferredInterface(preferredName: String) {
        log?.debug("setPerferredInterface \(preferredName)")
        if let preferredInterface = self.interfaces.first(where: { $0.name == preferredName }) {
            self.preferredInterface = preferredInterface
            Config.hostip = preferredInterface.address
        }
    }

    // Fetch SSID/BSSID/signal via NEHotspotNetwork. iOS exposes no public signal strength for the CURRENT
    // network (signalStrength is 0; the status bar uses a private path), so quality usually stays null and
    // the header shows the connected-without-strength icon. Assessment mode does NOT block these APIs.
    private func getWlanInfo() async -> [String: Any] {
        let noPerms: [String: Any] = ["ssid": NSNull(), "bssid": NSNull(), "quality": NSNull(), "message": "nopermissions"]

        let status = await locationDelegate.requestIfNeeded()
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            log?.debug("getWlanInfo nopermissions")
            return noPerms
        }

        if let network = await fetchCurrentNetwork() {
            log?.debug("getWlanInfo NEHotspotNetwork ssid=\(network.ssid) rssi=\(network.signalStrength)")
            return [
                "ssid":    network.ssid as Any,
                "bssid":   network.bssid as Any,
                "quality": (network.signalStrength < 0) ? Self.dbmToQualityPercent(network.signalStrength) as Any : NSNull(),
                "message": NSNull()
            ]
        }

        // fetchCurrent returning nil means the wifi-info entitlement is missing from the SIGNED profile
        // (capability not enabled in the App ID / profile not regenerated) or the app is not foreground.
        log?.debug("getWlanInfo nointerface (fetchCurrent nil: entitlement/foreground/location issue)")
        return ["ssid": NSNull(), "bssid": NSNull(), "quality": NSNull(), "message": "nointerface"]
    }

    // Mirror Electron getwlaninfo.js dbmToQualityPercent: map RSSI dBm (-100…-30) to 0…100 %.
    // NEHotspotNetwork.signalStrength is RSSI in dBm (Double, negative); 0 means unavailable.
    private static func dbmToQualityPercent(_ dbm: Double) -> Int {
        let clamped = max(-100.0, min(-30.0, dbm))
        let percent = (clamped + 100.0) / 70.0 * 100.0
        return Int(percent.rounded())
    }

    // NEHotspotNetwork.fetchCurrent must run on the main thread (Apple docs) and needs the app foregrounded;
    // the IPC handler runs on NetworkActor, so hop to the main queue first. Timeout guards against the
    // completion never firing (e.g. while the device is locked down by the assessment session).
    private func fetchCurrentNetwork() async -> NEHotspotNetwork? {
        await withCheckedContinuation { continuation in
            DispatchQueue.main.async {
                var resumed = false
                let finish: (NEHotspotNetwork?) -> Void = { network in
                    guard !resumed else { return }
                    resumed = true
                    continuation.resume(returning: network)
                }
                NEHotspotNetwork.fetchCurrent { network in
                    DispatchQueue.main.async { finish(network) }
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
                    LoggingHandler.shared?.debug("getWlanInfo fetchCurrent timed out (3s)")
                    finish(nil)
                }
            }
        }
    }
}

// Minimal CLLocationManager delegate that awaits the user's permission decision.
// The load() pre-request and the getWlanInfo polls can call requestIfNeeded() concurrently
// while the status is still .notDetermined; every awaiter is stored and resumed once the
// user decides (or the 5s fallback fires), so no caller is left hanging.
private final class WlanLocationDelegate: NSObject, CLLocationManagerDelegate, @unchecked Sendable {
    private let manager = CLLocationManager()
    private var continuations: [CheckedContinuation<CLAuthorizationStatus, Never>] = []
    private var requestInFlight = false

    override init() {
        super.init()
        manager.delegate = self
    }

    func requestIfNeeded() async -> CLAuthorizationStatus {
        let status = manager.authorizationStatus
        guard status == .notDetermined else { return status }

        return await withCheckedContinuation { continuation in
            // CLLocationManager must be used on the thread that created it (main); a request
            // from the NetworkActor never shows the system prompt. Delegate callbacks, the
            // append and the timeout all run on the main queue, so no locking is needed.
            DispatchQueue.main.async { [weak self] in
                guard let self else {
                    continuation.resume(returning: .notDetermined)
                    return
                }
                self.continuations.append(continuation)
                guard !self.requestInFlight else { return }
                self.requestInFlight = true
                self.manager.requestWhenInUseAuthorization()
                // Safety: if the system never answers (e.g. prompt suppressed), don't hang the wlan poll.
                DispatchQueue.main.asyncAfter(deadline: .now() + 5) { [weak self] in
                    guard let self, self.requestInFlight else { return }
                    self.requestInFlight = false
                    let pending = self.continuations
                    self.continuations = []
                    let s = self.manager.authorizationStatus
                    for c in pending { c.resume(returning: s) }
                }
            }
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        guard status != .notDetermined, requestInFlight else { return }
        requestInFlight = false
        let pending = continuations
        continuations = []
        for c in pending { c.resume(returning: status) }
    }
}
