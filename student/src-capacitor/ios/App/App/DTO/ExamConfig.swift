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
    var languagetool: Bool? = nil
    var languagetoolhost: String? = nil
    var languagetoolport: String? = nil
    var spellchecklang: String? = nil
    var suggestions: Bool? = nil
    var cmargin: CMargin? = nil
    var linespacing: String? = nil
    var fontfamily: String? = nil
    var fontsize: String? = nil
    var audioRepeat: String? = nil

    enum CodingKeys: String, CodingKey {
        case editorTemplate, languagetool, languagetoolhost, languagetoolport,
             spellchecklang, suggestions, cmargin, linespacing, fontfamily, fontsize, audioRepeat
    }

    init() {}

    /// Tolerant decode: a missing/mismatched key yields nil instead of failing the whole exam config.
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        editorTemplate   = try? container.decode(EditorTemplate.self, forKey: .editorTemplate)
        languagetool     = try? container.decode(Bool.self, forKey: .languagetool)
        languagetoolhost = try? container.decode(String.self, forKey: .languagetoolhost)
        languagetoolport = try? container.decode(String.self, forKey: .languagetoolport)
        spellchecklang   = try? container.decode(String.self, forKey: .spellchecklang)
        suggestions      = try? container.decode(Bool.self, forKey: .suggestions)
        cmargin          = try? container.decode(CMargin.self, forKey: .cmargin)
        linespacing      = try? container.decode(String.self, forKey: .linespacing)
        fontfamily       = try? container.decode(String.self, forKey: .fontfamily)
        fontsize         = try? container.decode(String.self, forKey: .fontsize)
        audioRepeat      = try? container.decode(String.self, forKey: .audioRepeat)
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encodeIfPresent(editorTemplate, forKey: .editorTemplate)
        try container.encodeIfPresent(languagetool, forKey: .languagetool)
        try container.encodeIfPresent(languagetoolhost, forKey: .languagetoolhost)
        try container.encodeIfPresent(languagetoolport, forKey: .languagetoolport)
        try container.encodeIfPresent(spellchecklang, forKey: .spellchecklang)
        try container.encodeIfPresent(suggestions, forKey: .suggestions)
        try container.encodeIfPresent(cmargin, forKey: .cmargin)
        try container.encodeIfPresent(linespacing, forKey: .linespacing)
        try container.encodeIfPresent(fontfamily, forKey: .fontfamily)
        try container.encodeIfPresent(fontsize, forKey: .fontsize)
        try container.encodeIfPresent(audioRepeat, forKey: .audioRepeat)
    }

    var asDictionary: [String: Any] {
        var dict = [String: Any]()
        dict["editorTemplate"]   = editorTemplate?.asDictionary ?? NSNull()
        dict["languagetool"]     = languagetool ?? NSNull()
        dict["languagetoolhost"] = languagetoolhost ?? NSNull()
        dict["languagetoolport"] = languagetoolport ?? NSNull()
        dict["spellchecklang"]   = spellchecklang ?? NSNull()
        dict["suggestions"]      = suggestions ?? NSNull()
        dict["cmargin"]          = cmargin?.asDictionary ?? NSNull()
        dict["linespacing"]      = linespacing ?? NSNull()
        dict["fontfamily"]       = fontfamily ?? NSNull()
        dict["fontsize"]         = fontsize ?? NSNull()
        dict["audioRepeat"]      = audioRepeat ?? NSNull()
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
