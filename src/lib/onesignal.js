// OneSignal Wrapper
export const getOneSignal = () => {
  return window.OneSignal || window.OneSignalDeferred;
};

export const requestOneSignalPermission = async () => {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.Notifications.requestPermission();
        const id = await OneSignal.User.PushSubscription.id;
        resolve(id);
      } catch (err) {
        console.error("OneSignal Permission Error:", err);
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
