package com.idl.zenith;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SecurityStatus")
public class SecurityStatusPlugin extends Plugin {
    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("isVpnActive", isVpnActive());
        result.put("isDeveloperOptionsEnabled", isDeveloperOptionsEnabled());
        result.put("isAdbEnabled", isAdbEnabled());
        call.resolve(result);
    }

    private boolean isVpnActive() {
        ConnectivityManager manager = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (manager == null) return false;

        Network[] networks = manager.getAllNetworks();
        for (Network network : networks) {
            NetworkCapabilities capabilities = manager.getNetworkCapabilities(network);
            if (capabilities != null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) {
                return true;
            }
        }

        Network activeNetwork = manager.getActiveNetwork();
        NetworkCapabilities activeCapabilities = manager.getNetworkCapabilities(activeNetwork);
        return activeCapabilities != null && activeCapabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN);
    }

    private boolean isDeveloperOptionsEnabled() {
        return Settings.Global.getInt(
            getContext().getContentResolver(),
            Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
            0
        ) == 1;
    }

    private boolean isAdbEnabled() {
        return Settings.Global.getInt(
            getContext().getContentResolver(),
            Settings.Global.ADB_ENABLED,
            0
        ) == 1;
    }
}
