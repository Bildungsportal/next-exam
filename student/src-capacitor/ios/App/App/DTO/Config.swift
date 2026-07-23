//
//  Config.swift
//  App
//
//  Created by Michael Pointner on 05.05.26.
//

struct Config {
    static var development: Bool = true  // disable kiosk mode on exam mode and other stuff (autofill input fields)
    static var showdevtools: Bool = true
    static var useBundledJRE: Bool = true
    static var bipIntegration: Bool = true
    static var bipDemo: Bool = true
    static var bipApiUrl: String = "https://localhost:8444"
    
    static var workdirectory : String = ""   // (desktop path + examdir)
    static var tempdirectory : String = ""   // (desktop path + "tmp")
    static var homedirectory : String = ""   // set in main.ts
    static var examdirectory : String = ""    // set after registering in ipcHandler
    static var clientdirectory: String = "EXAM-STUDENT"
    
    static var serverApiPort: Int = 22422  // this is needed to be reachable on the teachers pc for basic functionality
    static var multicastClientPort: Int = 6024  // only needed for exam autodiscovery
    
    static var multicastServerAdrr: String = "239.1.1.1"
    static var hostip: String = ""       // server.js
    static var gateway: Bool = true
    static var virtualized: Bool = false
    static var isPuavo: Bool = false
    
    static var version: String = "2.0.0.1"
    static var buildDate: String = "20260504"
    static var buildNumber: String = "1"
    static var info: String = "Release"
}
