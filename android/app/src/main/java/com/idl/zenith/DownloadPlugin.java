package com.idl.zenith;

import android.content.Intent;
import android.net.Uri;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DownloadPlugin")
public class DownloadPlugin extends Plugin {

    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url");
        
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        try {
            // Create intent to view URL
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // Create chooser to let user pick browser/app
            Intent chooser = Intent.createChooser(intent, "Open download link with");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            
            // Start chooser
            getContext().startActivity(chooser);
            
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            call.reject("Failed to open URL: " + e.getMessage());
        }
    }
}
