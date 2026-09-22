import CoreWLAN
import Foundation

// One-shot helper: read current Wi-Fi info via CoreWLAN, print JSON, exit.
// SSID/BSSID require wifi-info entitlement (unavailable on Developer ID) → always null on macOS 14+.
// RSSI, noise, and txRate work without any entitlement and are always returned.

func jsonString(_ value: String?) -> String {
    guard let value = value else { return "null" }
    let escaped = value
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "\"", with: "\\\"")
    return "\"\(escaped)\""
}

guard let iface = CWWiFiClient.shared().interface() else {
    print("{\"ssid\":null,\"bssid\":null,\"rssi\":null,\"noise\":null,\"txRate\":null,\"message\":\"nointerface\"}")
    exit(0)
}

let ssid  = iface.ssid()
let bssid = iface.bssid()
let rssi  = iface.rssiValue()       // dBm; available without entitlement
let noise = iface.noiseMeasurement() // dBm; available without entitlement
let txRate = iface.transmitRate()    // Mbps

// rssi == 0 means no interface association (not connected)
let connected = rssi != 0
let rssiJson   = connected ? String(rssi)           : "null"
let noiseJson  = connected ? String(noise)          : "null"
let txRateJson = connected ? String(Int(txRate))    : "null"

print("{\"ssid\":\(jsonString(ssid)),\"bssid\":\(jsonString(bssid)),\"rssi\":\(rssiJson),\"noise\":\(noiseJson),\"txRate\":\(txRateJson)}")
exit(0)
