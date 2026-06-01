import CoreWLAN
import CoreLocation
import Foundation

// One-shot helper: read current Wi-Fi SSID/BSSID/RSSI via CoreWLAN, print JSON, exit.
// macOS 14+ only returns SSID/BSSID when the calling process holds the
// com.apple.developer.networking.wifi-info entitlement AND Location Services authorization.

// Escape a string for safe embedding in a JSON string literal.
func jsonString(_ value: String?) -> String {
    guard let value = value else { return "null" }
    let escaped = value
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
    return "\"\(escaped)\""
}

// Query CoreWLAN, emit the result as JSON on stdout and terminate the process.
func emitAndExit() -> Never {
    guard let iface = CWWiFiClient.shared().interface() else {
        print("{\"ssid\":null,\"bssid\":null,\"rssi\":null,\"message\":\"nointerface\"}")
        exit(0)
    }
    let ssid = iface.ssid()
    let bssid = iface.bssid()
    let rssi = iface.rssiValue() // dBm; 0 when no signal info available
    let rssiJson = (ssid == nil && bssid == nil) ? "null" : String(rssi)
    // ssid==nil while an interface exists almost always means missing Location/entitlement
    let message = (ssid == nil && bssid == nil) ? "\"nopermissions\"" : "null"
    print("{\"ssid\":\(jsonString(ssid)),\"bssid\":\(jsonString(bssid)),\"rssi\":\(rssiJson),\"message\":\(message)}")
    exit(0)
}

// Requests Location authorization (required for SSID/BSSID since macOS 14) then emits once resolved.
final class WifiQuery: NSObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var finished = false

    func start() {
        manager.delegate = self
        if manager.authorizationStatus == .notDetermined {
            manager.requestWhenInUseAuthorization()
        } else {
            finish()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        finish()
    }

    private func finish() {
        if finished { return }
        finished = true
        emitAndExit()
    }
}

let query = WifiQuery()
query.start()
// Safety net: emit even if the authorization callback never fires.
DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { emitAndExit() }
RunLoop.main.run()
