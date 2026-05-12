// OneSignal Wrapper
export const getOneSignal = () => {
  return window.OneSignal || window.OneSignalDeferred;
};

export const isOneSignalLoaded = () => {
  return !!window.OneSignal;
};

export const requestOneSignalPermission = async () => {
  return new Promise((resolve) => {
    console.log("[OneSignal] Requesting permission...");
    
    // Check if SDK is loaded
    if (!window.OneSignal && !window.OneSignalDeferred) {
      console.error("[OneSignal] SDK not loaded! Check if it's blocked by ad-blockers.");
      resolve(null);
      return;
    }
    
    // Safety timeout after 15 seconds
    const timeout = setTimeout(() => {
      console.warn("[OneSignal] Request timed out after 15s. SDK might be blocked or failed to load.");
      console.warn("[OneSignal] Try disabling ad-blockers or testing in incognito mode.");
      resolve(null);
    }, 15000);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        console.log("[OneSignal] SDK loaded successfully");
        console.log("[OneSignal] Current Permission:", OneSignal.Notifications.permission);
        
        // Check if already denied
        if (OneSignal.Notifications.permission === false) {
          console.error("[OneSignal] Notifications are blocked. User must enable them in browser settings.");
          clearTimeout(timeout);
          resolve(null);
          return;
        }
        
        // Request permission
        const permissionGranted = await OneSignal.Notifications.requestPermission();
        console.log("[OneSignal] Permission granted:", permissionGranted);
        
        if (!permissionGranted) {
          console.error("[OneSignal] User denied notification permission");
          clearTimeout(timeout);
          resolve(null);
          return;
        }
        
        // Get subscription ID
        const id = await OneSignal.User.PushSubscription.id;
        console.log("[OneSignal] Subscription ID:", id);
        
        if (!id) {
          console.error("[OneSignal] Failed to get subscription ID");
          clearTimeout(timeout);
          resolve(null);
          return;
        }
        
        clearTimeout(timeout);
        resolve(id);
      } catch (err) {
        console.error("[OneSignal] Permission/Subscription Error:", err);
        console.error("[OneSignal] Error details:", err.message, err.stack);
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
};

export const getOneSignalId = async () => {
  return new Promise((resolve) => {
    console.log("[OneSignal] Getting subscription ID...");
    
    if (!window.OneSignal && !window.OneSignalDeferred) {
      console.error("[OneSignal] SDK not loaded!");
      resolve(null);
      return;
    }
    
    const timeout = setTimeout(() => {
      console.warn("[OneSignal] getOneSignalId timed out");
      resolve(null);
    }, 10000);
    
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        const id = await OneSignal.User.PushSubscription.id;
        console.log("[OneSignal] Retrieved ID:", id);
        clearTimeout(timeout);
        resolve(id);
      } catch (err) {
        console.error("[OneSignal] Error getting ID:", err);
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
};

export const logoutOneSignal = async () => {
  return new Promise((resolve) => {
    console.log("[OneSignal] Logging out (removing subscription)...");
    
    if (!window.OneSignal && !window.OneSignalDeferred) {
      console.error("[OneSignal] SDK not loaded!");
      resolve(false);
      return;
    }
    
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.User.PushSubscription.optOut();
        console.log("[OneSignal] Successfully logged out");
        resolve(true);
      } catch (err) {
        console.error("[OneSignal] Error logging out:", err);
        resolve(false);
      }
    });
  });
};
