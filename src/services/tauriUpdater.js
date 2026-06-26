import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export const tauriUpdater = {
  /**
   * Check for updates (Tauri desktop only)
   */
  async checkForUpdates() {
    try {
      // Only works in Tauri
      if (!window.__TAURI__) {
        return { updateAvailable: false, platform: 'web' };
      }

      const update = await check();

      if (update?.available) {
        return {
          updateAvailable: true,
          currentVersion: update.currentVersion,
          latestVersion: update.version,
          releaseDate: update.date,
          releaseNotes: update.body,
          update, // Keep update object for download
        };
      }

      return { updateAvailable: false, platform: 'tauri' };
    } catch (error) {
      console.error('[TauriUpdater] Check failed:', error);
      return { updateAvailable: false, error: error.message };
    }
  },

  /**
   * Download and install update
   */
  async downloadAndInstall(update) {
    try {
      console.log('[TauriUpdater] Downloading update...');
      
      // Download with progress callback
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            console.log(`[TauriUpdater] Download started (${event.data.contentLength} bytes)`);
            break;
          case 'Progress':
            const percent = Math.round((event.data.chunkLength / event.data.contentLength) * 100);
            console.log(`[TauriUpdater] Download progress: ${percent}%`);
            break;
          case 'Finished':
            console.log('[TauriUpdater] Download finished!');
            break;
        }
      });

      console.log('[TauriUpdater] Update installed! Restarting...');
      
      // Restart the app to apply update
      await relaunch();
      
      return { success: true };
    } catch (error) {
      console.error('[TauriUpdater] Download/install failed:', error);
      return { success: false, error: error.message };
    }
  },
};
