// OneSignal Wrapper
export const getOneSignal = () => {
  return window.OneSignal || window.OneSignalDeferred;
};

export const requestOneSignalPermission = async () => {
  return new Promise((resolve) => {
    console.log("[OneSignal] Requesting permission...");
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        console.log("[OneSignal] Current Permission:", OneSignal.Notifications.permission);
        await OneSignal.Notifications.requestPermission();
        console.log("[OneSignal] Permission after request:", OneSignal.Notifications.permission);
        
        const id = await OneSignal.User.PushSubscription.id;
        console.log("[OneSignal] Subscription ID:", id);
        resolve(id);
      } catch (err) {
        console.error("[OneSignal] Permission/Subscription Error:", err);
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
