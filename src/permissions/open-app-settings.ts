import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Opens this app's system "App info" settings page — where a permanently
 * denied runtime permission (e.g. video access after a second "Don't allow")
 * can only be flipped back on by the user.
 *
 * Always keyed on `Application.applicationId`, the id of the process actually
 * running, never one derived from app.config.ts: the dev/preview/prod build
 * variants install side by side with different ids, and the JS config is not
 * a reliable witness to which one is running — Metro evaluates app.config.ts
 * with whatever APP_VARIANT it was started with, so a dev build served by a
 * plain `npx expo start` can report the production id. Deep-linking with the
 * wrong id sends the user to a settings page for a build they aren't using.
 */
export async function openAppSettings(): Promise<void> {
  const pkg = Application.applicationId;
  await IntentLauncher.startActivityAsync(
    'android.settings.APPLICATION_DETAILS_SETTINGS',
    pkg ? { data: `package:${pkg}` } : undefined,
  );
}
