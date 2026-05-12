import Capacitor
import CapacitorNetwork
import Foundation
import Network

@objc(NetworkPlugin)
public class NetworkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier      = "NetworkPlugin"
    public let jsName          = "network"
    public let pluginMethods: [CAPPluginMethod] = []

    private let wifiMonitor  = NWPathMonitor(requiredInterfaceType: .wifi)
    
    private var interfaces: [NetworkInterfaceInfo] = []
    private var preferredInterface: NetworkInterfaceInfo? = nil

    public override func load() {
        IPCBridge.shared.registerInvokeHandler("checkhostip") { [weak self] _ throws -> Any? in
            guard let self else { throw PluginError.notInitialized }
            return try await self.getNetworkInfo().asDictionary
        }
        IPCBridge.shared.registerInvokeHandler("setPreferredInterface") { [weak self] payload in
            guard let self else { throw PluginError.notInitialized }
            guard let payloadArray = payload as? [String],
                  let preferredName = payloadArray.first else {
                throw IPCError.noHandler("Invalid payload for channel: setPreferredInterface")
            }
            self.setPerferredInterface(preferredName: preferredName)
            return
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
        print("setPerferredInterface \(preferredName)")
        if let preferredInterface = self.interfaces.first(where: { $0.name == preferredName }) {
            self.preferredInterface = preferredInterface
            Config.hostip = preferredInterface.address
        }
    }
}
