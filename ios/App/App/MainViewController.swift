import Capacitor
import WidgetKit
import WebKit

private final class WidgetMessageHandler: NSObject, WKScriptMessageHandler {
    private let storageKey = "uw:widget:data:v2"
    private let appGroup = "group.com.ugandaweather.app"
    private let widgetKind = "UgandaWeatherWidget"
    private var pendingReloadWorkItem: DispatchWorkItem?

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == "widgetUpdate",
              message.frameInfo.isMainFrame,
              message.frameInfo.securityOrigin.protocol == "https",
              ["uganda-weather.com", "www.uganda-weather.com"].contains(
                  message.frameInfo.securityOrigin.host
              ),
              let jsonString = message.body as? String,
              jsonString.utf8.count <= 16_384,
              let data = jsonString.data(using: .utf8),
              let payload = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              payload["districtName"] is String,
              payload["districtSlug"] is String,
              let defaults = UserDefaults(suiteName: appGroup) else {
            return
        }

        defaults.set(jsonString, forKey: storageKey)

        // Debounce widget updates to conserve OS daily reload budget
        pendingReloadWorkItem?.cancel()
        let workItem = DispatchWorkItem {
            WidgetCenter.shared.reloadAllTimelines()
        }
        pendingReloadWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5, execute: workItem)
    }
}

final class MainViewController: CAPBridgeViewController {
    private let widgetMessageHandler = WidgetMessageHandler()

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.configuration.userContentController.add(
            widgetMessageHandler,
            name: "widgetUpdate"
        )
    }
}
