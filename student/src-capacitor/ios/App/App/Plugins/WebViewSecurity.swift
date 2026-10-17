import Foundation
import WebKit

/// Injected into every app-managed WKWebView: file inputs are blocked so the native photo /
/// file picker (camera, photo library, files) can never open on iOS; an error is shown instead.
enum WebViewSecurity {
    /// Injected into every app-managed WKWebView at document start. The message is resolved via
    /// NSLocalizedString so iOS picks the language (en.lproj / de.lproj) automatically.
    static let blockFileInputScript: WKUserScript = {
        let message = NSLocalizedString("webviewFilePickerBlocked", comment: "Shown when a photo or file input is tapped inside a webview")
        let source = """
        (() => {
            const msg = "\(message)";
            let busy = false;
            const warn = () => {
                if (busy) return;
                busy = true;
                alert(msg);
                setTimeout(() => { busy = false; }, 1000);
            };
            const isFileInput = (el) => el && el.tagName === 'INPUT' && el.type === 'file';
            document.addEventListener('click', (e) => {
                if (isFileInput(e.target)) { e.preventDefault(); e.stopPropagation(); warn(); }
            }, true);
            const proto = HTMLInputElement.prototype;
            const origClick = proto.click;
            proto.click = function () {
                if (isFileInput(this)) { warn(); return; }
                return origClick.apply(this, arguments);
            };
            if (typeof proto.showPicker === 'function') {
                const origShowPicker = proto.showPicker;
                proto.showPicker = function () {
                    if (isFileInput(this)) { warn(); return; }
                    return origShowPicker.apply(this, arguments);
                };
            }
        })();
        """
        return WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: false)
    }()

    static func apply(_ configuration: WKWebViewConfiguration) {
        configuration.userContentController.addUserScript(blockFileInputScript)
    }
}
