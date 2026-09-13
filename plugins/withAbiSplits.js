const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Emit one APK per ABI plus a universal APK from a single Gradle build.
 *
 * 53XY is distributed as a side-loaded APK on GitHub releases, not through
 * Play. Users pick the APK for their device; the universal one is the
 * fallback. Same versionCode across all of them is fine (Play would require
 * distinct codes, but Play is not the target).
 *
 * `expo-build-properties` `buildArchs` sets `reactNativeArchitectures`, which
 * limits which ABIs get compiled; `splits.abi` decides how the compiled ABIs
 * are packaged. Keep `abis` a subset of `buildArchs`.
 */
const withAbiSplits = (config, { abis = ['arm64-v8a', 'armeabi-v7a'], universalApk = true } = {}) =>
  withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      throw new Error('withAbiSplits: only Groovy build.gradle is supported');
    }
    const contents = config.modResults.contents;
    if (contents.includes('splits {')) return config;

    const include = abis.map((a) => `"${a}"`).join(', ');
    const block = `
    splits {
        abi {
            enable true
            reset()
            include ${include}
            universalApk ${universalApk}
        }
    }
`;
    // Insert at the top of the `android { ... }` block; the split config is
    // independent of defaultConfig/buildTypes so order is not significant.
    config.modResults.contents = contents.replace(/^android \{\n/m, (m) => m + block);
    return config;
  });

module.exports = withAbiSplits;
