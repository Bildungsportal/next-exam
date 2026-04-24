import Capacitor
import Foundation

@objc(NetworkInfoPlugin)
public class NetworkInfoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NetworkInfoPlugin"
    public let jsName = "NetworkInfo"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getWifiIP", returnType: CAPPluginReturnPromise)
    ]

    @objc func getWifiIP(_ call: CAPPluginCall) {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?

        if getifaddrs(&ifaddr) == 0 {
            var ptr = ifaddr
            while ptr != nil {
                defer { ptr = ptr?.pointee.ifa_next }
                let interface = ptr?.pointee
                let addrFamily = interface?.ifa_addr.pointee.sa_family

                if addrFamily == UInt8(AF_INET) {
                    let name = String(cString: (interface?.ifa_name)!)
                    if name == "en0" {  // en0 = WiFi on iOS
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        getnameinfo(
                            interface?.ifa_addr,
                            socklen_t((interface?.ifa_addr.pointee.sa_len)!),
                            &hostname,
                            socklen_t(hostname.count),
                            nil,
                            socklen_t(0),
                            NI_NUMERICHOST
                        )
                        address = String(cString: hostname)
                    }
                }
            }
            freeifaddrs(ifaddr)
        }

        if let ip = address {
            call.resolve(["ip": ip])
        } else {
            call.reject("Could not get IP address")
        }
    }
}