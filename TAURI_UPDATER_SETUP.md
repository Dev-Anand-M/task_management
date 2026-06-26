# Tauri Auto-Updater Setup

## ✅ What's Been Done

### 1. Auto-Updater Configuration
- Enabled Tauri updater plugin in `tauri.conf.json`
- Generated signing key pair (stored in `~/.tauri/zenith.key`)
- Added public key to config for signature verification
- Created update manifest at `public/tauri-update.json`

### 2. Frontend Integration
- Created `tauriUpdater.js` service for checking and installing updates
- Modified `App.jsx` to check for updates on startup
- Supports both Tauri (Windows) and Capacitor (Android) updates
- Shows unified update dialog for both platforms

### 3. Update Flow
1. App checks for updates 2 seconds after launch
2. Checks again every hour
3. If update available, shows dialog with release notes
4. User clicks "Download Update":
   - **Tauri (Windows)**: Downloads and installs silently, then restarts app
   - **Android**: Opens browser to download APK

## 🔐 Security

The updater uses **Ed25519 signature verification**:
- Private key: `~/.tauri/zenith.key` (KEEP SECRET!)
- Public key: Embedded in app config
- Only signed updates can be installed

## 📦 Building Signed Updates

### When releasing v1.0.2:

1. **Update version**:
   ```json
   // src-tauri/tauri.conf.json
   "version": "1.0.2"
   ```

2. **Build with signature**:
   ```bash
   set TAURI_SIGNING_PRIVATE_KEY_PATH=%USERPROFILE%\.tauri\zenith.key
   set TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_password
   npx tauri build
   ```

3. **Get the signature**:
   The build creates a `.sig` file:
   ```
   src-tauri\target\release\bundle\nsis\Zenith_1.0.2_x64-setup.nsis.zip.sig
   ```

4. **Update the manifest**:
   ```json
   // public/tauri-update.json
   {
     "version": "1.0.2",
     "date": "2026-XX-XX",
     "platforms": {
       "windows-x86_64": {
         "signature": "PASTE_SIGNATURE_HERE",
         "url": "https://zenith-sable-alpha.vercel.app/Zenith_1.0.2_x64-setup.nsis.zip"
       }
     },
     "notes": "Your release notes here"
   }
   ```

5. **Upload files**:
   - `Zenith_1.0.2_x64-setup.nsis.zip` → `public/`
   - Updated `tauri-update.json` → `public/`

6. **Deploy to Vercel**

## 🎯 Current Version

**v1.0.1** - Initial release with auto-updater support

## 📝 Notes

- **Private key password**: You set this during key generation - DON'T LOSE IT!
- **Signature verification**: Prevents malicious updates
- **Update check interval**: 1 hour (configurable in App.jsx)
- **Silent updates**: Downloads in background, installs on next restart (optional)

## 🔧 Environment Variables (for CI/CD)

```bash
TAURI_SIGNING_PRIVATE_KEY_PATH=path/to/zenith.key
TAURI_SIGNING_PRIVATE_KEY_PASSWORD=your_password
```

## 🚀 Testing Updates

1. Install v1.0.1
2. Update `tauri-update.json` with v1.0.2
3. App should detect update within 2 seconds
4. Click "Download Update" to test installation
