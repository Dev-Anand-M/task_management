/**
 * Utility for native Web Push notifications (VAPID)
 */

const VAPID_PUBLIC_KEY = 'BIywJYLliCeDy38uq2Km1pgXg2-PjstbPuFusw-aikMwbHE7Z4M1CZnDSlJPsxL2bMFx0Dn3OfNlQAy9vqfYQcI';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(base64);
    const outputArray = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) {
        outputArray[i] = raw.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Push messaging is not supported');
        return null;
    }

    try {
        const registration = await navigator.serviceWorker.ready;
        
        // Check if already subscribed
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Request permission if needed
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                throw new Error('Notification permission denied');
            }

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        return subscription;
    } catch (error) {
        console.error('Push subscription failed:', error);
        throw error;
    }
}

export async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator)) return;
    
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
            await subscription.unsubscribe();
            return subscription;
        }
    } catch (error) {
        console.error('Unsubscribe failed:', error);
    }
    return null;
}
