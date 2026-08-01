# Zenith OS v1.4.0 — Master Verification & Wind-Up Documentation

## Executive Overview
**Zenith OS** (v1.4.0) is a major milestone release introducing the complete **Sprint Tracker & Peer Evaluation System**, strict **Role & Classroom Access Control**, an upgraded **Sentient ZEN AI Prompt Model**, an **App-Closing Mandatory Maintenance System**, and a **Scaled-Down 21.5 MB Android Debug APK**.

---

## 1. Release Architecture & Feature Audit

| Component | Status | Description |
| :--- | :--- | :--- |
| **Sprint Tracker Scoreboard** | ✅ Shipped | 8-Week peer evaluation system with Tarot Club assignments & Tarothon milestone weeks. |
| **4-Pillar Evaluation Rubric** | ✅ Shipped | Evaluates *Task Ownership (10 pts)*, *Code Quality (10 pts)*, *Demo & Understanding (10 pts)*, and *Autonomy (10 pts)*. |
| **Admin Roster Management** | ✅ Shipped | Admins can select any classroom, add/remove members from `sprint_participants`, lock weeks, and export evaluation data to CSV. |
| **Non-Participant Access Lock** | ✅ Shipped | Non-admin members not enrolled in the active sprint roster are blocked with a `🔒 Sprint Access Restricted` page. |
| **App-Closing Maintenance Mode** | ✅ Shipped | Server-controlled (`version.json`) mandatory maintenance dialog. No dismiss button; tapping "Close App" invokes `App.exitApp()` on mobile & closes/redirects on web. |
| **ZEN AI v1.4.0 Knowledge** | ✅ Shipped | Upgraded `aiService.js` prompt block with full awareness of Sprint Tracker, rubrics, admin controls, and navigation commands. |
| **Optimized APK Packaging** | ✅ Shipped | Scaled down debug APK size from **163.4 MB** to **21.5 MB** by excluding nested `.apk` asset patterns. |

---

## 2. Automated Test Commands

Run the following commands in PowerShell from the project root (`c:\Users\Warp Gate\Documents\IDL_SkillEnhancement`) to execute full automated verification:

### A. Web Bundle Compilation & Asset Sync
```powershell
npm run build
```
* **Expected Result**: 
  - Vite compiles web assets cleanly into `dist/`.
  - Capacitor copies assets to `android/app/src/main/assets/public/` and `ios/App/App/public/`.
  - `scripts/copy-apk.js` copies output APKs into `dist/`.

### B. Android Native APK Compilation
```powershell
cmd /c "cd android && gradlew clean assembleDebug"
```
* **Expected Result**:
  - Gradle task returns `BUILD SUCCESSFUL`.
  - Clean APK generated at `android\app\build\outputs\apk\debug\app-debug.apk`.

### C. APK Size Verification
```powershell
$file = Get-Item "android\app\build\outputs\apk\debug\app-debug.apk"
[math]::Round($file.Length / 1MB, 2)
```
* **Expected Result**: Size is approximately **21.5 MB** (must be < 30 MB).

---

## 3. Step-by-Step Manual Verification Protocol

Perform these manual tests to verify end-to-end functionality before handing off:

### Test 1: Non-Participant Sprint Access Lockout
1. Log in as a student user who is **not** added to the active classroom's sprint roster.
2. Navigate to `/sprint-tracker`.
3. **Pass Criteria**: Page intercepts rendering and displays `🔒 Sprint Access Restricted` card with a "Return to Dashboard" button.

### Test 2: Admin Roster & Classroom Switching
1. Log in as an **Admin** user.
2. Navigate to `/sprint-tracker`.
3. Use the **Classroom** dropdown in the header to switch between classrooms.
4. Click **Manage Sprint Roster**. Toggle student checkboxes to add/remove members from the sprint.
5. **Pass Criteria**: Members added immediately appear on the Master Scoreboard; members removed are removed from the roster and blocked from accessing the sprint.

### Test 3: Peer Evaluation & Multi-Evaluator Averaging
1. As an Admin or active sprint member, click **Evaluate** next to a teammate's name in Week 1.
2. Rate across all 4 pillars: *Task Ownership*, *Code Quality*, *Demo & Understanding*, *Autonomy* (1-10 stars each).
3. Click **Submit Evaluation**.
4. **Pass Criteria**: 
   - Modal closes cleanly (rendered via React Portal).
   - Scoreboard updates automatically showing the averaged score out of 40.

### Test 4: CSV Data Export
1. Log in as Admin on `/sprint-tracker`.
2. Click **Export CSV** in the header.
3. **Pass Criteria**: A file named `Zenith_Sprint_Evaluations_Summary.csv` downloads containing Ranks, Member Names, Emails, Total Scores, and Evaluation Counts.

### Test 5: Mandatory Maintenance Mode Popup
1. In `public/version.json`, ensure `"maintenance": true` and `"mandatory": true`.
2. Open the Zenith OS web app or Android APK.
3. **Pass Criteria**: 
   - A full-screen amber Maintenance modal (`System Under Maintenance`) pops up after 2 seconds.
   - **No `X` close button** is visible.
   - Clicking **Close App** on mobile triggers `App.exitApp()` and closes the Android app.

### Test 6: ZEN AI Knowledge Verification
1. Open Zen AI widget or navigate to `/ai/zen`.
2. Ask: *"What are the evaluation criteria in Sprint Tracker?"*
3. **Pass Criteria**: Zen AI responds with exact details on Task Ownership, Code Quality, Demo & Understanding, and Autonomy.

---

## 4. Final Wind-Up Checklist

- [x] Version numbers bumped in `package.json` (`1.4.0`), `android/app/build.gradle` (`versionCode 13`, `versionName "1.4.0"`), and `public/version.json`.
- [x] Database migration script saved at [migration_sprint_evaluations.sql](file:///c:/Users/Warp%20Gate/Documents/IDL_SkillEnhancement/supabase/migration_sprint_evaluations.sql).
- [x] Built clean 21.5 MB APK (`public/zenith-v1.4.0.apk` & `releases/zenith-v1.4.0.apk`).
- [x] All changes committed and pushed to GitHub main branch (`git push origin main`).
- [x] Vercel auto-deployment verified.

---
*Documentation generated by Antigravity AI — Zenith OS Master Release Suite.*

---

## 5. Sprint Template Configuration (v1.5.0 Feature)

### SQL Step — Run Once in Supabase

> **Required before testing.** Open [supabase_sprint_templates.sql](file:///c:/Users/Warp%20Gate/Documents/IDL_SkillEnhancement/supabase_sprint_templates.sql) and run the full content in **Supabase → SQL Editor**.

Confirms the `sprint_templates` table, RLS policies, and unique constraint are created.

### Test 7: Admin Configures Sprint Template

1. Log in as **Admin** and go to `/sprint-tracker`.
2. Select the target **Classroom** from the dropdown.
3. Click **⚙️ Configure Sprint Weeks (N wks)** in the admin toolbar.
4. A modal opens pre-populated with the current template.
5. **Edit** an existing week's title, description, start/end dates, and resource link (e.g. `/study-materials` or external doc URL).
6. **Toggle** the "Showcase" checkbox on a week — its badge turns purple.
7. **Add Week** — a new row appears at the bottom.
8. **Reorder** weeks using the ▲ / ▼ arrows.
9. **Delete** a week using the 🗑️ icon.
10. Click **💾 Save Template**.
11. **Pass Criteria**:
    - Modal closes with no errors.
    - The Sprint Tracker immediately reflects the new titles, short descriptions, dates, and resource hyperlinks (e.g., `📖 View Study Material`) in both the active week header and weekly details accordion.
    - If today's date exceeds the week's `end_date`, the week locks automatically (disabling rate/edit buttons).
    - Changes are per-classroom (switching to a different classroom shows its own template).

### Test 8: Student View (Template is Read-Only)

1. Log in as a **non-admin participant**.
2. Navigate to `/sprint-tracker`.
3. **Pass Criteria**:
    - The "Configure Sprint Weeks" button is **not visible**.
    - The student sees the week titles and descriptions configured by the admin.
    - All evaluation, scoreboard, and lock features work normally.

### Test 9: Fallback Behaviour (No Template Configured)

1. If no rows exist in `sprint_templates` for a classroom:
2. **Pass Criteria**: The Sprint Tracker falls back to the generic 8-week default template (visible as "Week 1", "Week 2", etc. with a hint to configure via admin panel).
