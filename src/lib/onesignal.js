// OneSignal Wrapper
export const getOneSignal = () => {
  return window.OneSignal || window.OneSignalDeferred;
};

export const requestOneSignalPermission = async () => {
  return new Promise((resolve) => {
    console.log("[OneSignal] Requesting permission...");
    
    // Safety timeout after 10 seconds
    const timeout = setTimeout(() => {
      console.warn("[OneSignal] Request timed out. SDK might be blocked or failed to load.");
      resolve(null);
    }, 10000);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        console.log("[OneSignal] Current Permission:", OneSignal.Notifications.permission);
        await OneSignal.Notifications.requestPermission();
        console.log("[OneSignal] Permission after request:", OneSignal.Notifications.permission);
        
        const id = await OneSignal.User.PushSubscription.id;
        console.log("[OneSignal] Subscription ID:", id);
        clearTimeout(timeout);
        resolve(id);
      } catch (err) {
        console.error("[OneSignal] Permission/Subscription Error:", err);
        clearTimeout(timeout);
        resolve(null);
      }
    });
  });
};

export const getOneSignalId = async () => {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      const id = await OneSignal.User.PushSubscription.id;
      resolve(id);
    });
  });
};

export const logoutOneSignal = async () => {
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    await OneSignal.User.PushSubscription.remove();
  });
};
