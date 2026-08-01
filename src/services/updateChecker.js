import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import packageJson from '../../package.json';

// Version endpoint - simple JSON file hosted on Vercel server
const VERSION_CHECK_URL = 'https://zenith-sable-alpha.vercel.app/version.json';
const APK_DOWNLOAD_URL = 'https://zenith-sable-alpha.vercel.app/zenith-v1.2.0.apk';

export const updateChecker = {
  /**
   * Check if an update is available
   * @returns {Promise<{updateAvailable: boolean, currentVersion: string, latestVersion: string, downloadUrl: string}>}
   */
  async checkForUpdates() {
    try {
      let currentVersion = packageJson.version || '1.2.0';

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
      const latestVersion = versionData.version || '1.4.0';
      const downloadUrl = versionData.downloadUrl || APK_DOWNLOAD_URL;
      const isMaintenance = Boolean(versionData.maintenance);

      // If maintenance mode is active on server, show popup on all client versions
      const updateAvailable = isMaintenance || this.compareVersions(currentVersion, latestVersion) < 0;

      return {
        updateAvailable,
        isMaintenance,
        maintenanceMessage: versionData.maintenanceMessage || '🛠️ App is in maintenance mode. Please check back shortly!',
        currentVersion,
        latestVersion,
        downloadUrl,
        releaseNotes: versionData.releaseNotes || '',
        mandatory: isMaintenance ? false : (versionData.mandatory || false),
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
    const clean1 = (v1 || '').toString().replace(/^v/i, '').trim();
    const clean2 = (v2 || '').toString().replace(/^v/i, '').trim();
    const parts1 = clean1.split('.').map(Number);
    const parts2 = clean2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const num1 = isNaN(parts1[i]) ? 0 : parts1[i];
      const num2 = isNaN(parts2[i]) ? 0 : parts2[i];

      if (num1 < num2) return -1;
      if (num1 > num2) return 1;
    }

    return 0;
  },

  /**
   * Directly download/open the update APK file
   */
  async downloadUpdate(downloadUrl = APK_DOWNLOAD_URL) {
    try {
      if (Capacitor.isNativePlatform()) {
        const { Browser } = await import('@capacitor/browser');
        await Browser.open({ url: downloadUrl });
      } else {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = downloadUrl.split('/').pop() || 'zenith-latest.apk';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (error) {
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
