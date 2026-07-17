import Foundation

struct FileObject: Codable {
    var filename: String?
    var filetype: String?
    var filecontent: String?
    var checksum: String?
    
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["filename"]    = filename    ?? NSNull()
        dict["filetype"]    = filetype    ?? NSNull()
        dict["filecontent"] = filecontent ?? NSNull()
        dict["checksum"]    = checksum    ?? NSNull()
        return dict
    }
}

struct WebsiteConfig: Codable {
    var url: String?
    var blockSubdomains: Bool?
    var blockSubfolders: Bool?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["url"]             = url             ?? NSNull()
        dict["blockSubdomains"] = blockSubdomains ?? NSNull()
        dict["blockSubfolders"] = blockSubfolders ?? NSNull()
        return dict
    }
}

struct EduvidualConfig: Codable {
    var url: String?
    var moodleDomain: String?
    var moodleTestId: String?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["url"]          = url          ?? NSNull()
        dict["moodleDomain"] = moodleDomain ?? NSNull()
        dict["moodleTestId"] = moodleTestId ?? NSNull()
        return dict
    }
}

struct RdpConfig: Codable {
    var domain: String?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["domain"] = domain ?? NSNull()
        return dict
    }
}

struct EditorConfig: Codable {
    var editorTemplate: EditorTemplate? = nil
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["editorTemplate"] = editorTemplate?.asDictionary ?? NSNull()
        return dict
    }
}

struct EditorTemplate: Codable {
    var filename: String?
    var filecontent: String?
    var filetype: String?
    var checksum: String?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["filename"]    = filename    ?? NSNull()
        dict["filecontent"] = filecontent ?? NSNull()
        dict["filetype"]    = filetype    ?? NSNull()
        dict["checksum"]    = checksum    ?? NSNull()
        return dict
    }
}

struct Microsoft365Config: Codable {
    var template: Microsoft365Template?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["template"] = template?.asDictionary ?? NSNull()
        return dict
    }
}

struct Microsoft365Template: Codable {
    var filename: String?
    var filecontent: String?
    var mimetype: String?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["filename"]    = filename    ?? NSNull()
        dict["filecontent"] = filecontent ?? NSNull()
        dict["mimetype"]    = mimetype    ?? NSNull()
        return dict
    }
}

struct GFormsConfig: Codable {
    var url: String?
    var provider: String?
    
    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["url"]      = url      ?? NSNull()
        dict["provider"] = provider ?? NSNull()
        return dict
    }
}

struct LocalVMConfig: Codable {
    var asDictionary: [String: Any] { return [:] }
}

struct MathConfig: Codable {
    var asDictionary: [String: Any] { return [:] }
}

struct ExamConfig: Codable {
    var activeSheets: FileObject?       = nil
    var editor:       EditorConfig?     = nil
    var eduvidual:    EduvidualConfig?  = nil
    var gforms:       GFormsConfig?     = nil
    var website:      WebsiteConfig?    = nil
    var math:         MathConfig?       = nil
    var microsoft365: Microsoft365Config? = nil
    var rdp:          RdpConfig?        = nil
    var localvm:      LocalVMConfig?    = nil

    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["activeSheets"] = activeSheets?.asDictionary  ?? NSNull()
        dict["editor"]       = editor?.asDictionary ?? NSNull()
        dict["eduvidual"]    = eduvidual?.asDictionary  ?? NSNull()
        dict["gforms"]       = gforms?.asDictionary ?? NSNull()
        dict["website"]      = website?.asDictionary    ?? NSNull()
        dict["math"]         = math?.asDictionary   ?? NSNull()
        dict["microsoft365"] = microsoft365?.asDictionary   ?? NSNull()
        dict["rdp"]          = rdp?.asDictionary    ?? NSNull()
        dict["localvm"]      = localvm?.asDictionary    ?? NSNull()
        return dict
    }
}
