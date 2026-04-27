import Capacitor
import CapacitorNetwork
import Foundation
import Network

enum CheckHostIPError: LocalizedError {
    case notConnected
    case ipUnavailable

    var errorDescription: String? {
        switch self {
            case .notConnected:  return "Not connected to the Internet"
            case .ipUnavailable: return "IP address unavailable"
        }
    }
}

struct NetworkInterfaceInfo {
    let name: String
    let address: String

    var asDictionary: [String: String] {
        ["name": name, "address": address]
    }
}

struct HostIPResult {
    let hostIP: String               // IP of the preferred interface
    let interface: String            // Name of the preferred interface
    let availableInterfaces: [NetworkInterfaceInfo]
    let preferredInterface: String   // NWPath-determined best interface

    // ── Serialized form returned to JS / IPC callers ──────────────────────────
    var asDictionary: [String: Any] {
        [
            "hostip":               hostIP,
            "interface":            interface,
            "availableInterfaces":  availableInterfaces.map { $0.asDictionary },
            "preferredInterface":   preferredInterface
        ]
    }
}

@objc(CheckHostIPPlugin)
public class CheckHostIPPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier      = "CheckHostIPPlugin"
    public let jsName          = "checkhostip"
    public let pluginMethods: [CAPPluginMethod] = []

    private let wifiMonitor  = NWPathMonitor(requiredInterfaceType: .wifi)
    private let monitorQueue = DispatchQueue(label: "com.checkhostip.wifi", qos: .utility)
    private var latestPath: NWPath?

    public override func load() {
        IPCBridge.shared.onInvoke("checkhostip") { [weak self] _ throws -> Any? in
            guard let self else { throw CheckHostIPError.notConnected }
            return try self.getNetworkInfo().asDictionary
        }
    }

    deinit { wifiMonitor.cancel() }

    private func getNetworkInfo() throws -> HostIPResult {
        let path = wifiMonitor.currentPath

        // ── Preferred interface: first WiFi interface NWPath is aware of ──────
        let preferredName = path.availableInterfaces
            .first(where: { $0.type == .wifi })?.name ?? "en0"

        // ── Enumerate all active IPv4 interfaces via POSIX ifaddrs ────────────
        var interfaces: [NetworkInterfaceInfo] = []
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        guard getifaddrs(&ifaddr) == 0 else { throw CheckHostIPError.ipUnavailable }
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
            interfaces.append(NetworkInterfaceInfo(
                name:    name,
                address: String(cString: hostname)
            ))
        }

        guard !interfaces.isEmpty else { throw CheckHostIPError.ipUnavailable }

        // ── Pick the preferred interface; fall back to first available ─────────
        let preferred = interfaces.first(where: { $0.name == preferredName })
                     ?? interfaces[0]

        return HostIPResult(
            hostIP:               preferred.address,
            interface:            preferred.name,
            availableInterfaces:  interfaces,          // all non-loopback IPv4
            preferredInterface:   preferred.name       // NWPath-determined best
        )
    }
}
