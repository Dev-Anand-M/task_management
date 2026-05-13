// OneSignal Wrapper
const SDK_TIMEOUT_MS = 10000;

const waitForOneSignal = (timeoutMs = SDK_TIMEOUT_MS) => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('OneSignal is only available in the browser'));
      return;
    }

    if (window.OneSignal?.Notifications) {
      resolve(window.OneSignal);
      return;
    }

    const timeout = setTimeout(() => {
      reject(new Error('OneSignal SDK did not load in time'));
    }, timeoutMs);

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push((OneSignal) => {
      clearTimeout(timeout);
      resolve(OneSignal);
    });
  });
};

const removeConflictingPushWorkers = async () => {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    const conflictingWorkers = registrations.filter((registration) => {
      const scriptUrl = registration.active?.scriptURL
        || registration.waiting?.scriptURL
        || registration.installing?.scriptURL
        || '';

      return scriptUrl.includes('firebase-messaging-sw.js');
    });

    if (conflictingWorkers.length === 0) return;

    console.warn(`[OneSignal] Removing ${conflictingWorkers.length} conflicting Firebase push worker(s).`);
    await Promise.all(conflictingWorkers.map((registration) => registration.unregister()));
  } catch (err) {
    console.warn('[OneSignal] Could not inspect service workers:', err.message);
  }
};

const ensureOneSignalWorker = async () => {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const registration = await navigator.serviceWorker.register('/OneSignalSDKWorker.js', {
      scope: '/'
    });
    await registration.update();
    return registration;
  } catch (err) {
    console.warn('[OneSignal] Could not register OneSignal service worker:', err.message);
    return null;
  }
};

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
      console.log("OneSignal.User.onesignalId:", window.OneSignal.User?.onesignalId);
      console.log("OneSignal.User.PushSubscription.id:", window.OneSignal.User?.PushSubscription?.id);
      console.log("OneSignal.User.PushSubscription.optedIn:", window.OneSignal.User?.PushSubscription?.optedIn);
    } catch (e) {
      console.log("Error checking permission:", e.message);
    }
  }
  
  console.log("Browser Notification.permission:", Notification.permission);
  console.log("HTTPS:", location.protocol === 'https:' || location.hostname === 'localhost');
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      console.log("Service workers:", registrations.map((registration) => ({
        scope: registration.scope,
        active: registration.active?.scriptURL,
        waiting: registration.waiting?.scriptURL,
        installing: registration.installing?.scriptURL
      })));
    });
  }
  console.log("==============================");
};

export const syncOneSignalUser = async (userId) => {
  if (!userId) return null;

  try {
    const OneSignal = await waitForOneSignal();
    console.log("[OneSignal] Logging in external user:", userId);
    await OneSignal.login(String(userId));
    return OneSignal.User?.PushSubscription?.id || null;
  } catch (err) {
    console.warn("[OneSignal] Could not sync user:", err.message);
    return null;
  }
};

const waitForSubscriptionId = async (OneSignal, timeoutMs = 8000) => {
  const currentId = OneSignal.User?.PushSubscription?.id;
  if (currentId) return currentId;

  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(OneSignal.User?.PushSubscription?.id || null);
      }
    }, timeoutMs);

    const onChange = (event) => {
      const id = event?.current?.id || OneSignal.User?.PushSubscription?.id;
      if (!settled && id) {
        settled = true;
        clearTimeout(timeout);
        try {
          OneSignal.User.PushSubscription.removeEventListener('change', onChange);
        } catch {
          // Older SDK builds may not expose removeEventListener; timeout keeps this bounded.
        }
        resolve(id);
      }
    };

    OneSignal.User.PushSubscription.addEventListener('change', onChange);
  });
};

export const requestOneSignalPermission = async (userId) => {
  console.log("[OneSignal] Requesting permission...");

  try {
    const OneSignal = await waitForOneSignal();

    await removeConflictingPushWorkers();
    await ensureOneSignalWorker();

    if (userId) {
      await OneSignal.login(String(userId));
    }

    console.log("[OneSignal] Current Permission:", OneSignal.Notifications.permission);

    if (OneSignal.Notifications.permission === false || Notification.permission === 'denied') {
      console.error("[OneSignal] Notifications are blocked. User must enable them in browser settings.");
      return null;
    }

    const permissionGranted = OneSignal.Notifications.permission === true
      ? true
      : await OneSignal.Notifications.requestPermission();

    console.log("[OneSignal] Permission granted:", permissionGranted);

    if (!permissionGranted) {
      console.error("[OneSignal] User denied notification permission");
      return null;
    }

    if (OneSignal.User?.PushSubscription?.optIn) {
      await OneSignal.User.PushSubscription.optIn();
    }

    const id = await waitForSubscriptionId(OneSignal);
    console.log("[OneSignal] Subscription ID:", id);

    if (!id) {
      console.error("[OneSignal] Failed to get subscription ID after permission granted");
      return null;
    }

    return id;
  } catch (err) {
    console.error("[OneSignal] Permission/Subscription Error:", err);
    console.error("[OneSignal] Error details:", err.message, err.stack);
    return null;
  }
};

export const getOneSignalId = async () => {
  try {
    console.log("[OneSignal] Getting subscription ID...");
    const OneSignal = await waitForOneSignal();
    const id = await waitForSubscriptionId(OneSignal, 3000);
    console.log("[OneSignal] Retrieved ID:", id);
    return id;
  } catch (err) {
    console.error("[OneSignal] Error getting ID:", err);
    return null;
  }
};

export const logoutOneSignal = async () => {
  try {
    console.log("[OneSignal] Logging out (removing subscription)...");
    const OneSignal = await waitForOneSignal();
    await OneSignal.User.PushSubscription.optOut();
    await OneSignal.logout();
    console.log("[OneSignal] Successfully logged out");
    return true;
  } catch (err) {
    console.error("[OneSignal] Error logging out:", err);
    return false;
  }
};
