// OneSignal Wrapper
export const getOneSignal = () => {
  return window.OneSignal || window.OneSignalDeferred;
};

export const isOneSignalLoaded = () => {
  return !!window.OneSignal;
};

// Debug helper - call this to check OneSignal status
export const debugOneSignalStatus = () => {
  console.log("=== OneSignal Debug Status ===");
  console.log("window.OneSignal exists:", !!window.OneSignal);
  console.log("window.OneSignalDeferred exists:", !!window.OneSignalDeferred);
  console.log("window.OneSignalDeferred length:", window.OneSignalDeferred?.length || 0);
  
  if (window.OneSignal) {
    console.log("OneSignal.Notifications exists:", !!window.OneSignal.Notifications);
    try {
      console.log("OneSignal.Notifications.permission:", window.OneSignal.Notifications?.permission);
    } catch (e) {
      console.log("Error checking permission:", e.message);
    }
  }
  
  console.log("Browser Notification.permission:", Notification.permission);
  console.log("HTTPS:", location.protocol === 'https:' || location.hostname === 'localhost');
  console.log("==============================");
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
    
    // Safety timeout after 8 seconds
    const timeout = setTimeout(() => {
      console.error("[OneSignal] Request timed out after 8s. SDK might be stuck or blocked.");
      console.error("[OneSignal] This usually means:");
      console.error("  1. Ad-blocker is blocking OneSignal");
      console.error("  2. Browser extension is interfering");
      console.error("  3. Network issue loading OneSignal SDK");
      console.error("[OneSignal] Try: Disable ad-blockers, test in incognito mode, or use different browser");
      resolve(null);
    }, 8000);

    // Check if OneSignal is already initialized
    if (window.OneSignal && typeof window.OneSignal.Notifications !== 'undefined') {
      console.log("[OneSignal] SDK already initialized, using directly");
      
      (async () => {
        try {
          const OneSignal = window.OneSignal;
          console.log("[OneSignal] Current Permission:", OneSignal.Notifications.permission);
          
          // Check if already denied
          if (OneSignal.Notifications.permission === false) {
            console.error("[OneSignal] Notifications are blocked. User must enable them in browser settings.");
            clearTimeout(timeout);
            resolve(null);
            return;
          }
          
          // Request permission
          console.log("[OneSignal] Calling requestPermission()...");
          const permissionGranted = await OneSignal.Notifications.requestPermission();
          console.log("[OneSignal] Permission granted:", permissionGranted);
          
          if (!permissionGranted) {
            console.error("[OneSignal] User denied notification permission");
            clearTimeout(timeout);
            resolve(null);
            return;
          }
          
          // Wait a bit for subscription to complete
          await new Promise(r => setTimeout(r, 1000));
          
          // Get subscription ID
          const id = await OneSignal.User.PushSubscription.id;
          console.log("[OneSignal] Subscription ID:", id);
          
          if (!id) {
            console.error("[OneSignal] Failed to get subscription ID after permission granted");
            clearTimeout(timeout);
            resolve(null);
            return;
          }
          
          clearTimeout(timeout);
          resolve(id);
        } catch (err) {
          console.error("[OneSignal] Error:", err);
          clearTimeout(timeout);
          resolve(null);
        }
      })();
      return;
    }

    // Otherwise use deferred queue
    console.log("[OneSignal] Waiting for SDK to initialize via deferred queue...");
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        console.log("[OneSignal] SDK loaded via deferred queue");
        console.log("[OneSignal] Current Permission:", OneSignal.Notifications.permission);
        
        // Check if already denied
        if (OneSignal.Notifications.permission === false) {
          console.error("[OneSignal] Notifications are blocked. User must enable them in browser settings.");
          clearTimeout(timeout);
          resolve(null);
          return;
        }
        
        // Request permission
        console.log("[OneSignal] Calling requestPermission()...");
        const permissionGranted = await OneSignal.Notifications.requestPermission();
        console.log("[OneSignal] Permission granted:", permissionGranted);
        
        if (!permissionGranted) {
          console.error("[OneSignal] User denied notification permission");
          clearTimeout(timeout);
          resolve(null);
          return;
        }
        
        // Wait a bit for subscription to complete
        await new Promise(r => setTimeout(r, 1000));
        
        // Get subscription ID
        const id = await OneSignal.User.PushSubscription.id;
        console.log("[OneSignal] Subscription ID:", id);
        
        if (!id) {
          console.error("[OneSignal] Failed to get subscription ID after permission granted");
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
