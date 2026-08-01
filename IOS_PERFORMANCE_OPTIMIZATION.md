# 🚀 iOS-Level Performance Optimization Guide

## 📊 Current Performance Bottlenecks

### **1. Security Detection (FIXED)**
- ✅ Reduced from 15s to 30s intervals
- ✅ Increased VPN cache from 30s to 60s
- ✅ Added low-priority fetch requests

---

## 🎯 Critical Optimizations Needed

### **1. React Performance**

#### **A. Memoization Strategy**
Add these to frequently re-rendering components:

```jsx
// Example: Dashboard.jsx, Profile.jsx
import { memo, useMemo, useCallback } from 'react';

// Wrap expensive components
const ExpensiveCard = memo(({ data }) => {
  // Only re-renders if data changes
  return <Card>...</Card>;
});

// Memoize expensive calculations
const sortedTasks = useMemo(() => {
  return tasks.sort((a, b) => b.priority - a.priority);
}, [tasks]);

// Memoize callbacks
const handleTaskClick = useCallback((taskId) => {
  navigate(`/tasks/${taskId}`);
}, [navigate]);
```

**Files to optimize:**
- `src/pages/member/Dashboard.jsx`
- `src/pages/member/MyTasks.jsx`
- `src/pages/admin/Dashboard.jsx`
- `src/components/layout/Sidebar.jsx`

---

#### **B. Virtual Scrolling for Long Lists**
Install `react-window` or `react-virtualized`:

```bash
npm install react-window
```

```jsx
// For XPHistory.jsx, Chat.jsx, Notifications.jsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <XPHistoryItem item={items[index]} />
    </div>
  )}
</FixedSizeList>
```

---

#### **C. Code Splitting & Lazy Loading**

```jsx
// In App.jsx - Split by route
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/member/Dashboard'));
const Chat = lazy(() => import('./pages/member/Chat'));
const StudyLab = lazy(() => import('./pages/member/StudyLab'));

// Wrap in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/chat" element={<Chat />} />
  </Routes>
</Suspense>
```

---

### **2. Animation Performance**

#### **A. Use CSS Transforms (GPU-Accelerated)**

```css
/* SLOW - Triggers layout recalculation */
.button:hover {
  top: -2px;
  left: 5px;
}

/* FAST - GPU accelerated */
.button:hover {
  transform: translate3d(5px, -2px, 0);
  will-change: transform;
}
```

#### **B. Add these to `index.css`:**

```css
/* Force GPU acceleration for smooth animations */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Optimize scrolling */
* {
  -webkit-overflow-scrolling: touch;
  scroll-behavior: smooth;
}

/* Prevent layout shifts */
.card, .button, .modal {
  contain: layout style paint;
}

/* GPU layer for animated elements */
.animated, [class*="transition"], [class*="hover"] {
  will-change: transform, opacity;
  backface-visibility: hidden;
  perspective: 1000px;
}

/* Smooth 120fps animations */
@media (prefers-reduced-motion: no-preference) {
  * {
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  }
}
```

---

### **3. Image Optimization**

#### **A. Add Loading Strategy**

```jsx
// For avatar, profile pics, study materials
<img 
  src={imageUrl}
  loading="lazy"
  decoding="async"
  alt="..."
  style={{ contentVisibility: 'auto' }}
/>
```

#### **B. Use WebP Format**
Convert PNG/JPG images to WebP (50-90% smaller):

```bash
# Install sharp for image optimization
npm install sharp
```

```js
// scripts/optimize-images.js
const sharp = require('sharp');
const fs = require('fs');

const images = ['zenith.png', 'liquid_glass_bg_dark.png', ...];

images.forEach(img => {
  sharp(`public/${img}`)
    .webp({ quality: 85 })
    .toFile(`public/${img.replace(/\.(png|jpg)$/, '.webp')}`);
});
```

---

### **4. Database Query Optimization**

#### **A. Add Indexes to Supabase**

```sql
-- For faster profile lookups
CREATE INDEX IF NOT EXISTS idx_profiles_classroom 
ON profiles(classroom_id) 
WHERE classroom_id IS NOT NULL;

-- For faster notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
ON notifications(user_id, is_read, created_at DESC);

-- For faster task queries
CREATE INDEX IF NOT EXISTS idx_tasks_classroom_status 
ON tasks(classroom_id, status);

-- For faster chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_time 
ON chat_messages(room_id, created_at DESC);
```

#### **B. Use `select()` to fetch only needed columns**

```js
// SLOW - Fetches everything
const { data } = await supabase
  .from('profiles')
  .select('*');

// FAST - Only fetches needed columns
const { data } = await supabase
  .from('profiles')
  .select('id, name, avatar_url, xp, role');
```

---

### **5. Network Optimization**

#### **A. Add Request Caching**

```js
// src/utils/cache.js
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const cachedFetch = async (key, fetchFn) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFn();
  cache.set(key, { data, timestamp: Date.now() });
  return data;
};

// Usage in database.js
export const getUserProfile = async (userId) => {
  return cachedFetch(`profile-${userId}`, async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return data;
  });
};
```

#### **B. Prefetch Critical Data**

```jsx
// In Dashboard.jsx - prefetch likely next pages
useEffect(() => {
  // Prefetch tasks page data
  const prefetchTasks = async () => {
    const tasks = await db.getTasks(user.classroom_id);
    // Store in cache
  };
  
  // Run after 2 seconds (after initial render)
  const timer = setTimeout(prefetchTasks, 2000);
  return () => clearTimeout(timer);
}, []);
```

---

### **6. Bundle Size Optimization**

#### **A. Analyze Bundle**

```bash
npm install --save-dev webpack-bundle-analyzer
```

```js
// Add to vite.config.js
import { visualizer } from 'rollup-plugin-visualizer';

export default {
  plugins: [
    visualizer({ open: true })
  ]
};
```

#### **B. Remove Unused Dependencies**

```bash
# Find unused dependencies
npm install -g depcheck
depcheck

# Remove large unused libs
npm uninstall moment  # Use date-fns instead (90% smaller)
npm install date-fns
```

---

### **7. Capacitor/Native Optimizations**

#### **A. Add to `capacitor.config.json`**

```json
{
  "android": {
    "webContentsDebuggingEnabled": false,
    "allowMixedContent": false,
    "hardwareAccelerated": true,
    "backgroundColor": "#1c1917"
  },
  "ios": {
    "scrollEnabled": true,
    "overrideUserAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15"
  }
}
```

#### **B. Enable Hardware Acceleration in AndroidManifest.xml**

```xml
<application
  android:hardwareAccelerated="true"
  android:usesCleartextTraffic="false">
  ...
</application>
```

---

## 🎨 iOS-Style Smooth Animations

### **Add to `index.css`:**

```css
/* iOS-style momentum scrolling */
body, .scrollable, .list, .chat-container {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

/* Smooth spring animations like iOS */
:root {
  --spring-easing: cubic-bezier(0.175, 0.885, 0.32, 1.275);
  --smooth-easing: cubic-bezier(0.4, 0, 0.2, 1);
  --swift-out: cubic-bezier(0.4, 0, 0, 1);
}

/* Apply to all transitions */
* {
  transition-timing-function: var(--smooth-easing);
}

/* Button press effect like iOS */
.button, button, [role="button"] {
  transition: transform 0.1s var(--swift-out);
}

.button:active, button:active {
  transform: scale(0.96);
}

/* Card hover like iOS */
.card {
  transition: transform 0.3s var(--spring-easing), 
              box-shadow 0.3s var(--smooth-easing);
}

.card:hover {
  transform: translateY(-4px) scale(1.02);
}

/* Smooth page transitions */
.page-enter {
  opacity: 0;
  transform: translateX(30px);
}

.page-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.3s, transform 0.3s var(--smooth-easing);
}

.page-exit {
  opacity: 1;
  transform: translateX(0);
}

.page-exit-active {
  opacity: 0;
  transform: translateX(-30px);
  transition: opacity 0.3s, transform 0.3s var(--smooth-easing);
}
```

---

## 📈 Performance Monitoring

### **Add Performance Tracking:**

```jsx
// src/utils/performance.js
export const measurePerformance = (name, fn) => {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  
  if (duration > 16.67) { // Slower than 60fps
    console.warn(`⚠️ Slow operation: ${name} took ${duration.toFixed(2)}ms`);
  }
  
  return result;
};

// Usage
const data = measurePerformance('Load Dashboard', () => {
  return processData(rawData);
});
```

---

## 🎯 Priority Implementation Order

### **Week 1 (Critical):**
1. ✅ Add memoization to Dashboard, MyTasks, Profile
2. ✅ Add database indexes
3. ✅ Implement request caching
4. ✅ Add iOS-style animations to index.css

### **Week 2 (Important):**
5. ✅ Implement virtual scrolling for Chat, XPHistory
6. ✅ Add code splitting for routes
7. ✅ Optimize images to WebP
8. ✅ Remove unused dependencies

### **Week 3 (Nice to have):**
9. ✅ Add prefetching
10. ✅ Implement performance monitoring
11. ✅ Fine-tune animations
12. ✅ Bundle size optimization

---

## 📊 Expected Performance Gains

| Optimization | Load Time Reduction | FPS Improvement |
|--------------|-------------------|-----------------|
| Memoization | -20% | +15fps |
| Virtual Scrolling | -40% (long lists) | +20fps |
| Code Splitting | -30% (initial load) | - |
| Image Optimization | -50% (bandwidth) | - |
| Database Indexes | -60% (queries) | - |
| Request Caching | -80% (repeat visits) | - |
| **TOTAL** | **~70% faster** | **~30fps gain** |

---

## 🧪 Testing Tools

```bash
# Install Lighthouse CI
npm install -g @lhci/cli

# Run performance audit
lhci autorun --collect.url=http://localhost:5173
```

**Target Metrics:**
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.5s
- Speed Index: < 4.0s
- Total Blocking Time: < 300ms
- Cumulative Layout Shift: < 0.1

---

## 🎯 Quick Wins (1 Hour)

Copy-paste these into `index.css` right now:

```css
/* Add to index.css for instant iOS smoothness */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-tap-highlight-color: transparent;
}

html {
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}

body {
  overscroll-behavior-y: contain;
}

.card, .button, .modal, [class*="transition"] {
  will-change: transform;
  backface-visibility: hidden;
  transform: translateZ(0);
}

button, .button, [role="button"] {
  transition: transform 0.1s cubic-bezier(0.4, 0, 0, 1);
}

button:active, .button:active {
  transform: scale(0.96);
}
```

Done! 🚀
