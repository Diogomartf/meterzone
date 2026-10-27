const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

/**
 * iOS 27 refuses to launch apps built with its SDK unless they adopt the
 * UIScene life cycle ("UIScene life cycle is required for apps built with this
 * SDK"). Expo 57's template still creates its window in the app delegate, so
 * this moves window creation into a scene delegate.
 *
 * With scenes, UIKit stops calling the app delegate's open-URL and user-activity
 * methods. The scene delegate forwards them back, so Expo's subscribers (dev
 * client, linking) keep working unchanged.
 */
module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return c;
  });

  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') {
      throw new Error('withSceneLifecycle expects a Swift AppDelegate');
    }
    c.modResults.contents = patchAppDelegate(c.modResults.contents);
    return c;
  });
};

function replaceOnce(source, search, replacement) {
  if (!source.includes(search)) {
    throw new Error(
      `withSceneLifecycle: AppDelegate template changed, could not find:\n${search}`,
    );
  }
  return source.replace(search, replacement);
}

function patchAppDelegate(contents) {
  if (contents.includes('class SceneDelegate')) return contents;

  let next = replaceOnce(
    contents,
    '  var reactNativeFactory: RCTReactNativeFactory?\n',
    '  var reactNativeFactory: RCTReactNativeFactory?\n' +
      '  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
  );

  next = replaceOnce(
    next,
    `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`,
    `    // The window is created by SceneDelegate once UIKit connects a scene.
    self.launchOptions = launchOptions
`,
  );

  return `${next}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  private var appDelegate: AppDelegate? {
    UIApplication.shared.delegate as? AppDelegate
  }

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate,
          let factory = appDelegate.reactNativeFactory else { return }

    // A cold-start link arrives on the scene, not in the launch options, so
    // hand it to React Native where Linking.getInitialURL looks for it.
    var launchOptions = appDelegate.launchOptions ?? [:]
    if let url = connectionOptions.urlContexts.first?.url {
      launchOptions[.url] = url
    }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)

    if let url = connectionOptions.urlContexts.first?.url {
      _ = appDelegate.application(UIApplication.shared, open: url, options: [:])
    }
    if let activity = connectionOptions.userActivities.first {
      _ = appDelegate.application(
        UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = appDelegate?.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = appDelegate?.application(
      UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;
}
