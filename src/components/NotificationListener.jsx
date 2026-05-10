import React, { useEffect, useState } from 'react';
import { onMessageListener } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';

const NotificationListener = () => {
    // DISABLED: No more in-app toast notifications
    // All notifications will be handled by the service worker (both foreground and background)
    // This prevents duplicate notifications and refresh issues
    
    return null;
};

export default NotificationListener;
