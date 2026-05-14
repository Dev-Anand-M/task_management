// Debug endpoint to check VAPID keys
export default async function handler(req, res) {
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VITE_VAPID_PUBLIC_KEY = process.env.VITE_VAPID_PUBLIC_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

    return res.status(200).json({
        keys: {
            VAPID_PUBLIC_KEY: {
                exists: !!VAPID_PUBLIC_KEY,
                length: VAPID_PUBLIC_KEY?.length,
                first20: VAPID_PUBLIC_KEY?.substring(0, 20),
                last20: VAPID_PUBLIC_KEY?.substring(VAPID_PUBLIC_KEY?.length - 20)
            },
            VITE_VAPID_PUBLIC_KEY: {
                exists: !!VITE_VAPID_PUBLIC_KEY,
                length: VITE_VAPID_PUBLIC_KEY?.length,
                first20: VITE_VAPID_PUBLIC_KEY?.substring(0, 20),
                last20: VITE_VAPID_PUBLIC_KEY?.substring(VITE_VAPID_PUBLIC_KEY?.length - 20)
            },
            VAPID_PRIVATE_KEY: {
                exists: !!VAPID_PRIVATE_KEY,
                length: VAPID_PRIVATE_KEY?.length,
                first10: VAPID_PRIVATE_KEY?.substring(0, 10),
                last10: VAPID_PRIVATE_KEY?.substring(VAPID_PRIVATE_KEY?.length - 10)
            },
            VAPID_SUBJECT: {
                exists: !!VAPID_SUBJECT,
                value: VAPID_SUBJECT
            }
        },
        match: {
            publicKeysMatch: VAPID_PUBLIC_KEY === VITE_VAPID_PUBLIC_KEY
        }
    });
}
