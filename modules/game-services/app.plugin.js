const {
  AndroidConfig,
  withAndroidManifest,
  withStringsXml,
} = require('expo/config-plugins');

const APP_ID_KEY = 'com.google.android.gms.games.APP_ID';
const STRING_NAME = 'game_services_project_id';

/**
 * Adds the Play Games project ID to the Android manifest. It goes through a
 * string resource because Android reads an all-digit `android:value` as a
 * number, and the SDK expects a string. Without an ID the plugin does nothing
 * and the module reports rankings as unavailable.
 */
module.exports = function withGameServices(config, { playGamesAppId } = {}) {
  if (!playGamesAppId) return config;

  config = withStringsXml(config, (c) => {
    c.modResults = AndroidConfig.Strings.setStringItem(
      [
        AndroidConfig.Resources.buildResourceItem({
          name: STRING_NAME,
          value: String(playGamesAppId),
          translatable: false,
        }),
      ],
      c.modResults,
    );
    return c;
  });

  return withAndroidManifest(config, (c) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(c.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(
      app,
      APP_ID_KEY,
      `@string/${STRING_NAME}`,
    );
    return c;
  });
};
