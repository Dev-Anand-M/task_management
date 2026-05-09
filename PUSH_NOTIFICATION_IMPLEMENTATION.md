# Automated Push Notification System

To fulfill the requirement that "any notification received inside the app should also be sent to mobile," we need a server-side relay. Since the client cannot securely send pushes directly (it requires private keys), we use a Supabase Edge Function.

## Architecture

1.  **Database Trigger**: A trigger on the `notifications` table in Supabase.
2.  **Edge Function**: A Deno-based function that receives the trigger payload, looks up the user's `fcm_token`, and sends a push via Firebase Admin SDK.
3.  **Firebase**: Delivers the push to the device.

## Step 1: Create the Edge Function

Create a file at `supabase/functions/send-push/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID')
const FIREBASE_MESSAGING_KEY = Deno.env.get('FIREBASE_MESSAGING_KEY') // Server key or Service Account

serve(async (req) => {
  const payload = await req.json()
  const { record } = payload // The new notification record

  // 1. Initialize Supabase Admin
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // 2. Get User's FCM Token
  const { data: profile } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('id', record.user_id)
    .single()

  const fcmToken = profile?.preferences?.fcm_token

  if (!fcmToken) {
    return new Response(JSON.stringify({ message: 'No token found' }), { status: 200 })
  }

  // 3. Send to Firebase
  const response = await fetch(`https://fcm.googleapis.com/fcm/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `key=${FIREBASE_MESSAGING_KEY}`,
    },
    body: JSON.stringify({
      to: fcmToken,
      notification: {
        title: record.title,
        body: record.message,
        click_action: record.link || '/',
      },
      data: {
        type: record.type,
        link: record.link || '/',
      }
    }),
  })

  const result = await response.json()
  return new Response(JSON.stringify(result), { status: 200 })
})
```

## Step 2: Enable the Trigger

Run this SQL in your Supabase SQL Editor:

```sql
-- Create the webhook trigger
CREATE TRIGGER on_notification_created
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://your-project.supabase.co/functions/v1/send-push',
    'POST',
    '{"Content-Type":"application/json", "Authorization":"Bearer YOUR_ANON_KEY"}',
    '{}',
    '1000'
  );
```

## Step 3: Environment Variables

You need to set these in the Supabase Dashboard:
- `FIREBASE_MESSAGING_KEY`: Your Firebase Cloud Messaging Server Key (Found in Project Settings -> Cloud Messaging).
- `FIREBASE_PROJECT_ID`: Your project ID.

---

## What I have implemented in this turn:
1.  **Automatic Requests**: App now asks for notification permission automatically 2 seconds after every login.
2.  **Settings Cleanup**: Removed the "Email" option (since we don't use it).
3.  **Dynamic Push Toggle**: The "Push Notifications" toggle in Settings now correctly reflects the device's status and allows the user to turn it on/off (registering/unregistering the token) directly.
4.  **Removed Setup Device**: The manual button is gone; everything is now handled by the toggles and auto-prompts.
