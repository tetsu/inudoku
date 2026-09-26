import UIKit
import WebKit
import GameController
import Capacitor

/// Makes a hardware keyboard (iPad, Bluetooth) drive the game.
///
/// WKWebView is unreliable here: whether its content view turns key presses
/// into DOM `keydown`/`keyup` events depends on focus it won't grant
/// programmatically, and even when focused it lets arrow keys fall through
/// while swallowing Return, Escape and Backspace. So this view controller
/// keeps keyboard focus itself and forwards every press to the page as a
/// synthetic KeyboardEvent (with key repeat, which UIKit doesn't provide).
/// Focus is only left with WebKit while a text field / select on the page is
/// being edited. A small page-side helper drops any forwarded event whose
/// trusted (WebKit-delivered) twin has just fired, so a key is never handled
/// twice.
///
/// Game controllers go through the Gamepad API and don't depend on any of this.
class MainViewController: CAPBridgeViewController, UIGestureRecognizerDelegate {
    private var observers: [NSObjectProtocol] = []
    private var repeatTimer: Timer?
    private var repeatingKey: UIKey?

    private static let repeatDelay: TimeInterval = 0.4
    private static let repeatInterval: TimeInterval = 0.07

    /// Installs `window.__nativeKeys`:
    /// - `forward(type, init)` dispatches a synthetic key event unless WebKit
    ///   already delivered the real one, then performs what a browser would do
    ///   by default for it in a focused text field (synthetic events don't
    ///   type anything by themselves), so e.g. the settings name field focused
    ///   from the keyboard can still be typed into.
    /// - `isEditing()` tells whether a form field currently has focus.
    /// It also posts `nativeKeysReclaim` when focus leaves a form field.
    private static let forwarderScript = """
    (() => {
      if (window.__nativeKeys) return;
      const held = new Set();
      const lastUp = new Map();
      addEventListener('keydown', e => { if (e.isTrusted) held.add(e.key); }, true);
      addEventListener('keyup', e => {
        if (!e.isTrusted) return;
        held.delete(e.key);
        lastUp.set(e.key, performance.now());
      }, true);

      const TEXT_TYPES = ['text', 'search', 'number', 'email', 'url', 'tel', 'password'];
      const isTextField = el =>
        !!el && !el.readOnly && !el.disabled &&
        (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.includes(el.type)));

      // Default editing action for a keydown the page didn't cancel
      const edit = (el, init) => {
        if (init.ctrlKey || init.metaKey || init.altKey) return;
        let caret = null;
        try { caret = el.selectionStart; } catch {}
        const hasCaret = typeof caret === 'number';
        const start = hasCaret ? el.selectionStart : el.value.length;
        const end = hasCaret ? el.selectionEnd : el.value.length;
        const replace = (text, from, to, inputType) => {
          if (hasCaret) {
            el.setRangeText(text, from, to, 'end');
          } else {
            el.value = el.value.slice(0, from) + text + el.value.slice(to);
          }
          el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: text || null }));
        };
        const key = init.key;
        if (key.length === 1) {
          replace(key, start, end, 'insertText');
        } else if (key === 'Enter' && el.tagName === 'TEXTAREA') {
          replace('\\n', start, end, 'insertLineBreak');
        } else if (key === 'Backspace') {
          if (start !== end) replace('', start, end, 'deleteContentBackward');
          else if (start > 0) replace('', start - 1, start, 'deleteContentBackward');
        } else if (key === 'Delete') {
          if (start !== end) replace('', start, end, 'deleteContentForward');
          else if (start < el.value.length) replace('', start, start + 1, 'deleteContentForward');
        } else if (hasCaret && (key === 'ArrowLeft' || key === 'ArrowRight')) {
          const pos = key === 'ArrowLeft' ? Math.max(0, start - (start === end ? 1 : 0))
                                          : Math.min(el.value.length, end + (start === end ? 1 : 0));
          el.setSelectionRange(pos, pos);
        }
      };

      // Leaving a form field: hand keyboard focus back to the native side
      addEventListener('focusout', () => {
        setTimeout(() => {
          if (!window.__nativeKeys.isEditing()) {
            window.webkit?.messageHandlers?.nativeKeysReclaim?.postMessage(null);
          }
        }, 0);
      }, true);

      window.__nativeKeys = {
        forward(type, init) {
          if (type === 'keydown' && held.has(init.key)) return;
          if (type === 'keyup' && performance.now() - (lastUp.get(init.key) ?? -1e9) < 150) return;
          const target = document.activeElement || document.body;
          const notCancelled = target.dispatchEvent(new KeyboardEvent(type, init));
          if (type === 'keydown' && notCancelled && isTextField(target) && target === document.activeElement) {
            edit(target, init);
          }
        },
        isEditing() {
          const el = document.activeElement;
          return !!el && (isTextField(el) || el.isContentEditable || el.tagName === 'SELECT');
        },
      };
    })();
    """

    override func viewDidLoad() {
        // The web view already exists (built in loadView) but the bridge only
        // starts loading the page in super.viewDidLoad(), so register first. The
        // script is also prepended to every call in case it's missing.
        let contentController = webView?.configuration.userContentController
        contentController?.addUserScript(WKUserScript(
            source: Self.forwarderScript, injectionTime: .atDocumentStart, forMainFrameOnly: true
        ))
        contentController?.add(ReclaimMessageHandler(owner: self), name: "nativeKeysReclaim")
        super.viewDidLoad()

        // A tap hands focus to WebKit; take it back unless it landed in a field
        let tap = UITapGestureRecognizer(target: self, action: #selector(webViewTapped(_:)))
        tap.cancelsTouchesInView = false
        tap.delaysTouchesEnded = false
        tap.delegate = self
        webView?.addGestureRecognizer(tap)
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        becomeFirstResponder()

        guard observers.isEmpty else { return }
        let center = NotificationCenter.default
        let scene = view.window?.windowScene
        observers.append(center.addObserver(
            forName: UIScene.didActivateNotification, object: scene, queue: .main
        ) { [weak self] _ in self?.reclaimKeyboardFocus() })
        observers.append(center.addObserver(
            forName: UIScene.willDeactivateNotification, object: scene, queue: .main
        ) { [weak self] _ in self?.stopRepeat() })
        observers.append(center.addObserver(
            forName: .GCKeyboardDidConnect, object: nil, queue: .main
        ) { [weak self] _ in self?.reclaimKeyboardFocus() })
    }

    deinit {
        observers.forEach(NotificationCenter.default.removeObserver)
        repeatTimer?.invalidate()
    }

    override var canBecomeFirstResponder: Bool { true }

    @objc private func webViewTapped(_ recognizer: UITapGestureRecognizer) {
        guard recognizer.state == .ended else { return }
        // Let WebKit finish focusing whatever was tapped first
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.reclaimKeyboardFocus()
        }
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        true
    }

    /// Takes keyboard focus back from WebKit unless a field is being edited.
    fileprivate func reclaimKeyboardFocus() {
        guard !isFirstResponder, let webView else { return }
        webView.evaluateJavaScript(Self.forwarderScript + "window.__nativeKeys.isEditing()") { [weak self] result, _ in
            if (result as? Bool) != true { self?.becomeFirstResponder() }
        }
    }

    // MARK: - Key forwarding

    override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        guard let key = presses.first?.key, let dom = DOMKey(key) else {
            super.pressesBegan(presses, with: event)
            return
        }
        forward("keydown", dom, key.modifierFlags, isRepeat: false)
        if dom.repeats { startRepeat(key) }
        // Let system shortcuts (Cmd-Tab, Cmd-H, ...) keep working
        if key.modifierFlags.contains(.command) { super.pressesBegan(presses, with: event) }
    }

    override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if !forwardKeyUp(presses) { super.pressesEnded(presses, with: event) }
    }

    override func pressesCancelled(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
        if !forwardKeyUp(presses) { super.pressesCancelled(presses, with: event) }
    }

    private func forwardKeyUp(_ presses: Set<UIPress>) -> Bool {
        guard let key = presses.first?.key, let dom = DOMKey(key) else { return false }
        if repeatingKey?.keyCode == key.keyCode { stopRepeat() }
        forward("keyup", dom, key.modifierFlags, isRepeat: false)
        return true
    }

    private func startRepeat(_ key: UIKey) {
        stopRepeat()
        repeatingKey = key
        repeatTimer = Timer.scheduledTimer(withTimeInterval: Self.repeatDelay, repeats: false) { [weak self] _ in
            self?.repeatTimer = Timer.scheduledTimer(withTimeInterval: Self.repeatInterval, repeats: true) { [weak self] _ in
                guard let self, let key = self.repeatingKey, let dom = DOMKey(key) else { return }
                self.forward("keydown", dom, key.modifierFlags, isRepeat: true)
            }
        }
    }

    private func stopRepeat() {
        repeatTimer?.invalidate()
        repeatTimer = nil
        repeatingKey = nil
    }

    private func forward(_ type: String, _ dom: DOMKey, _ flags: UIKeyModifierFlags, isRepeat: Bool) {
        let options: [String: Any] = [
            "key": dom.key,
            "code": dom.code,
            "shiftKey": flags.contains(.shift),
            "ctrlKey": flags.contains(.control),
            "altKey": flags.contains(.alternate),
            "metaKey": flags.contains(.command),
            "repeat": isRepeat,
            "bubbles": true,
            "cancelable": true,
        ]
        guard let json = try? JSONSerialization.data(withJSONObject: options),
              let optionsJSON = String(data: json, encoding: .utf8) else { return }
        webView?.evaluateJavaScript(
            Self.forwarderScript + "window.__nativeKeys.forward('\(type)', \(optionsJSON));"
        )
    }
}

/// Forwards the page's `nativeKeysReclaim` message without the content
/// controller retaining the view controller.
private final class ReclaimMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var owner: MainViewController?

    init(owner: MainViewController) {
        self.owner = owner
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.reclaimKeyboardFocus()
    }
}

/// The DOM `key` / `code` pair for a UIKit key press.
private struct DOMKey {
    let key: String
    let code: String
    /// Held keys auto-repeat like in a browser (everything but modifiers).
    let repeats: Bool

    init?(_ uiKey: UIKey) {
        let usage = uiKey.keyCode
        if let special = Self.special[usage] {
            (key, code, repeats) = special
            return
        }
        // Printable keys: `key` is the produced character (respecting Shift),
        // `code` the physical key
        guard !uiKey.characters.isEmpty else { return nil }
        key = uiKey.characters
        code = Self.physicalCode(usage) ?? ""
        repeats = true
    }

    private static let special: [UIKeyboardHIDUsage: (String, String, Bool)] = [
        .keyboardUpArrow: ("ArrowUp", "ArrowUp", true),
        .keyboardDownArrow: ("ArrowDown", "ArrowDown", true),
        .keyboardLeftArrow: ("ArrowLeft", "ArrowLeft", true),
        .keyboardRightArrow: ("ArrowRight", "ArrowRight", true),
        .keyboardReturnOrEnter: ("Enter", "Enter", true),
        .keypadEnter: ("Enter", "NumpadEnter", true),
        .keyboardSpacebar: (" ", "Space", true),
        .keyboardEscape: ("Escape", "Escape", true),
        .keyboardTab: ("Tab", "Tab", true),
        .keyboardDeleteOrBackspace: ("Backspace", "Backspace", true),
        .keyboardDeleteForward: ("Delete", "Delete", true),
        .keyboardLeftShift: ("Shift", "ShiftLeft", false),
        .keyboardRightShift: ("Shift", "ShiftRight", false),
        .keyboardLeftControl: ("Control", "ControlLeft", false),
        .keyboardRightControl: ("Control", "ControlRight", false),
        .keyboardLeftAlt: ("Alt", "AltLeft", false),
        .keyboardRightAlt: ("Alt", "AltRight", false),
        .keyboardLeftGUI: ("Meta", "MetaLeft", false),
        .keyboardRightGUI: ("Meta", "MetaRight", false),
    ]

    private static func physicalCode(_ usage: UIKeyboardHIDUsage) -> String? {
        let raw = usage.rawValue
        let a = UIKeyboardHIDUsage.keyboardA.rawValue
        if (a...UIKeyboardHIDUsage.keyboardZ.rawValue).contains(raw) {
            return "Key" + String(UnicodeScalar(UInt8(65 + raw - a)))
        }
        let one = UIKeyboardHIDUsage.keyboard1.rawValue
        if (one...UIKeyboardHIDUsage.keyboard9.rawValue).contains(raw) {
            return "Digit\(raw - one + 1)"
        }
        return usage == .keyboard0 ? "Digit0" : nil
    }
}
