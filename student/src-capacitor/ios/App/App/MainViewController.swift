import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(IPCPlugin())
        bridge?.registerPluginInstance(CheckHostIPPlugin())
    }
}