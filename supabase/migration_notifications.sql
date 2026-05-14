-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES classrooms(id), -- Optional: for classroom-wide alerts
  title TEXT NOT NULL,
  message TEXT,
  type TEXT CHECK (type IN ('success', 'info', 'warning', 'error', 'award')),
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (
    auth.uid() = user_id
  );

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (
    auth.uid() = user_id
  );

-- Admins or System can insert notifications
-- (For now, we'll allow authenticated users to insert if needed, e.g. "User submitted task" trigger? 
--  Actually better if only system/admin does. But for simplicity, let's allow inserts if they are related to the user or if admin)
CREATE POLICY "Admins can insert notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Function to broadcast notification to a classroom (Optional utility)
-- This would be useful if we want to "Send Announcement"
