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
    
    private var interfaces: [NetworkInterfaceInfo] = []
    private var preferredInterface: NetworkInterfaceInfo? = nil

    private let locationDelegate = WlanLocationDelegate()

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
    }

    deinit { wifiMonitor.cancel() }

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

        return CheckHostIP(
            hostIP:               preferred.address,
            interface:            preferred.name,
            availableInterfaces:  interfaces,          // all non-loopback IPv4
            preferredInterface:   preferred.name       // NWPath-determined best
        )
    }
    
    private func setPerferredInterface(preferredName: String) {
        log?.debug("setPerferredInterface \(preferredName)")
        if let preferredInterface = self.interfaces.first(where: { $0.name == preferredName }) {
            self.preferredInterface = preferredInterface
            Config.hostip = preferredInterface.address
        }
    }

    // Fetch SSID/BSSID/signal via NEHotspotNetwork.
    private func getWlanInfo() async -> [String: Any] {
        let noPerms: [String: Any] = ["ssid": NSNull(), "bssid": NSNull(), "quality": NSNull(), "message": "nopermissions"]

        let status = await locationDelegate.requestIfNeeded()
        guard status == .authorizedWhenInUse || status == .authorizedAlways else {
            log?.debug("getWlanInfo nopermissions")
            return noPerms
        }

        guard let network = await fetchCurrentNetwork() else {
            log?.debug("getWlanInfo nointerface")
            return ["ssid": NSNull(), "bssid": NSNull(), "quality": NSNull(), "message": "nointerface"]
        }
        
        log?.debug("getWlanInfo \(network.ssid) \(network.bssid)")

        return [
            "ssid":    network.ssid as Any,
            "bssid":   network.bssid as Any,
            "quality": network.signalStrength > 0 ? Int(network.signalStrength * 100) : NSNull(),
            "message": NSNull()
        ]
    }

    private func fetchCurrentNetwork() async -> NEHotspotNetwork? {
        await withCheckedContinuation { continuation in
            NEHotspotNetwork.fetchCurrent { network in
                continuation.resume(returning: network)
            }
        }
    }
}

// Minimal CLLocationManager delegate that awaits the user's permission decision.
private class WlanLocationDelegate: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLAuthorizationStatus, Never>?

    override init() {
        super.init()
        manager.delegate = self
    }

    func requestIfNeeded() async -> CLAuthorizationStatus {
        let status = manager.authorizationStatus
        guard status == .notDetermined else { return status }

        return await withCheckedContinuation { continuation in
            self.continuation = continuation
            manager.requestWhenInUseAuthorization()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        guard status != .notDetermined else { return }
        continuation?.resume(returning: status)
        continuation = nil
    }
}
