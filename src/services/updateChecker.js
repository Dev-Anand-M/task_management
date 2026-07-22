import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import packageJson from '../../package.json';

// Version endpoint - simple JSON file hosted on Vercel server
const VERSION_CHECK_URL = 'https://zenith-sable-alpha.vercel.app/version.json';
const APK_DOWNLOAD_URL = 'https://zenith-sable-alpha.vercel.app/zenith-v1.1.1.apk';

export const updateChecker = {
  /**
   * Check if an update is available
   * @returns {Promise<{updateAvailable: boolean, currentVersion: string, latestVersion: string, downloadUrl: string}>}
   */
  async checkForUpdates() {
    try {
      let currentVersion = packageJson.version || '1.1.0';

      if (Capacitor.isNativePlatform()) {
        try {
          const appInfo = await App.getInfo();
          if (appInfo?.version) currentVersion = appInfo.version;
        } catch (err) {
          console.warn('[UpdateChecker] Native App.getInfo failed, fallback to package version:', err);
        }
      }

      // Fetch latest version from server
      const response = await fetch(VERSION_CHECK_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error('Unable to fetch version metadata');
      
      const versionData = await response.json();
      const latestVersion = versionData.version || '1.1.0';
      const downloadUrl = versionData.downloadUrl || APK_DOWNLOAD_URL;

      // Compare versions
      const updateAvailable = this.compareVersions(currentVersion, latestVersion) < 0;

      return {
        updateAvailable,
        currentVersion,
        latestVersion,
        downloadUrl,
        releaseNotes: versionData.releaseNotes || '',
        mandatory: versionData.mandatory || false,
      };
    } catch (error) {
      console.error('[UpdateChecker] Check failed:', error);
      return { updateAvailable: false, error: error.message };
    }
  },

  /**
   * Compare two semantic versions
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = parts1[i] || 0;
      const num2 = parts2[i] || 0;

      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }

    return 0;
  },

  /**
   * Open the download URL in the system browser
   */
  async downloadUpdate(downloadUrl) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url: downloadUrl });
    } catch (error) {
      // Fallback to window.open if Browser plugin not available
      window.open(downloadUrl, '_blank');
    }
  },

  /**
   * Check if user has dismissed this version update
   */
  hasUserDismissedVersion(version) {
    const dismissedVersion = localStorage.getItem('dismissed_update_version');
    return dismissedVersion === version;
  },

  /**
   * Mark this version as dismissed by user
   */
  dismissVersion(version) {
    localStorage.setItem('dismissed_update_version', version);
  },

  /**
   * Clear dismissed version (e.g., when user manually checks for updates)
   */
  clearDismissed() {
    localStorage.removeItem('dismissed_update_version');
  },
};
