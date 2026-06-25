-- 1. Create push_subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    device_id UUID NOT NULL,                        -- Unique installation ID
    transport VARCHAR(50) NOT NULL,                -- 'web' | 'fcm'
    platform VARCHAR(50) NOT NULL,                 -- 'web' | 'android' | 'ios'
    endpoint TEXT,                                -- Web Push subscription endpoint
    token TEXT,                                   -- Native FCM token
    keys JSONB,                                   -- Web Push keys (auth, p256dh)
    browser VARCHAR(100),                         -- Browser signature (Chrome, Safari, etc.)
    user_agent TEXT,                              -- Client user agent string
    app_version VARCHAR(50),                      -- Client application version
    os_version VARCHAR(50),                       -- Client OS version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    notifications_enabled BOOLEAN DEFAULT true NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL,
    CONSTRAINT unique_device_for_user UNIQUE (user_id, device_id),
    CONSTRAINT unique_endpoint_for_user UNIQUE (user_id, endpoint),
    CONSTRAINT unique_token_for_user UNIQUE (user_id, token)
);

-- 2. Create notification_logs table for delivery metrics and auditing
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id VARCHAR(100),                 -- Event identifier / FCM Message ID
    device_id UUID,                               -- Link to target device
    type VARCHAR(50) NOT NULL,                    -- 'web' | 'android' | 'ios'
    status VARCHAR(50) NOT NULL,                  -- 'queued' | 'sent' | 'failed' | 'expired' | 'opened' | 'clicked' | 'dismissed'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    clicked_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT
);

-- 3. Configure search indexes
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_device ON public.push_subscriptions(device_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_active ON public.push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_notif_logs_device ON public.notification_logs(device_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
CREATE POLICY "Users can manage their own subscriptions" 
    ON public.push_subscriptions
    FOR ALL 
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own notification logs" 
    ON public.notification_logs
    FOR SELECT 
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.push_subscriptions 
        WHERE push_subscriptions.device_id = notification_logs.device_id 
        AND push_subscriptions.user_id = auth.uid()
    ));

-- 6. Migrate legacy push subscriptions
INSERT INTO public.push_subscriptions (user_id, device_id, transport, platform, endpoint, keys, browser, is_active)
SELECT 
    id AS user_id, 
    gen_random_uuid() AS device_id,
    'web' AS transport,
    'web' AS platform,
    push_subscription->>'endpoint' AS endpoint,
    push_subscription->'keys' AS keys,
    'unknown' AS browser,
    true AS is_active
FROM public.profiles
WHERE push_subscription IS NOT NULL
ON CONFLICT DO NOTHING;
