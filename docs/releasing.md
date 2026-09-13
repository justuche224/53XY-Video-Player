# Releasing 53XY (side-loaded APKs on GitHub Releases)

53XY is not on Play. Each release ships three APKs as GitHub release assets and
users pick the one for their phone. One local EAS build produces all three.

## Why three APKs, and why they're small now

The first release candidate was a single 115 MB fat APK. Breakdown (uncompressed):
four ABIs of native libs (x86_64 23 MB, x86 23 MB, arm64-v8a 22 MB, armeabi-v7a
15 MB) plus 47 MB of unminified dex across five `classes*.dex`. Two fixes,
both in `app.config.ts`:

- **`expo-build-properties`** — `buildArchs: ['arm64-v8a', 'armeabi-v7a']`
  (x86/x86_64 are emulator-only) and `enableMinifyInReleaseBuilds` +
  `enableShrinkResourcesInReleaseBuilds` (R8).
- **`plugins/withAbiSplits.js`** — a config plugin that injects Gradle
  `splits { abi { … universalApk true } }` into `app/build.gradle`, so one
  `assembleRelease` emits a per-ABI APK for each arch plus a universal one.

Result for v1.0.0: **arm64-v8a 38.4 MB · armeabi-v7a 31.7 MB · universal 87.9 MB.**

Dev flows are unaffected: `expo run:android` passes
`-PreactNativeArchitectures=<device abi>` on the command line (overrides
`gradle.properties`) and already picks `app-universal-debug.apk` /
`app-arm64-v8a-debug.apk` by name, so the x86_64 emulator still works.

An AAB + `bundletool` does **not** help here: `--mode=universal` gives the same
fat APK, and device-targeted splits (`.apks`) can only be installed with
`bundletool install-apks`, not downloaded and tapped.

## Build

```bash
eas build --platform android --profile production-apk --local
```

Because Gradle now emits three APKs, the EAS local-build plugin packs them into
**`build-<timestamp>.tar.gz`** (a single APK would be a bare `.apk`). The
tarball's paths are relative to `outputs/`, i.e. `apk/release/app-*-release.apk`.
Takes ~15 min on the laptop.

`production` has `autoIncrement: true` with a remote `appVersionSource`, so every
build bumps `versionCode` once; all three APKs from one build share it, which is
fine for side-loading.

## Extract, rename, publish

```bash
V=1.0.0   # must match `version` in app.config.ts
cd ~/Projects/53XY
mkdir -p release && tar xzf build-*.tar.gz -C release
mv release/apk/release/app-arm64-v8a-release.apk   release/53XY-v$V-arm64-v8a.apk
mv release/apk/release/app-armeabi-v7a-release.apk release/53XY-v$V-armeabi-v7a.apk
mv release/apk/release/app-universal-release.apk   release/53XY-v$V-universal.apk
rm -r release/apk

gh release create v$V release/53XY-v$V-*.apk \
  --title "53XY v$V" \
  --notes "$(cat <<'EOF_NOTES'
Most phones: download the **arm64-v8a** APK.
Older 32-bit phones: **armeabi-v7a**.
Not sure: **universal** (works everywhere, larger).
EOF_NOTES
)"
```

Notes:

- `gh release create` tags the current commit if the tag doesn't exist yet —
  commit first so the tag points at the code that was built.
- Add `--draft` to review on GitHub before publishing; `--generate-notes` to
  append the commit list.
- **Use `gh`, not the browser.** The browser release uploader spent hours on a
  single 115 MB file on the same network; `gh` pushed all three APKs (158 MB) in
  under two minutes.
- Existing release, new/replaced asset: `gh release upload v$V <file> --clobber`.
- `release/` and `build-*.tar.gz` are gitignored; the old `build-*.apk` glob
  only covered single-APK builds.

## Smoke test before publishing

R8 is on, so a missing keep rule would show up as a runtime crash, not a build
error. Install the arm64 APK on the phone and check playback, subtitle load, and
a library rescan:

```bash
adb install -r release/53XY-v$V-arm64-v8a.apk
```

If something breaks, add the rule via `extraProguardRules` in the
`expo-build-properties` block rather than editing `android/` (it's generated).
