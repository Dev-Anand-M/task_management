package com.idl.zenith;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;
import android.webkit.URLUtil;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DownloadPlugin")
public class DownloadPlugin extends Plugin {

    @PluginMethod
    public void downloadFile(PluginCall call) {
        String url = call.getString("url");
        
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        try {
            Context context = getContext();
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            
            // Set title and description
            String fileName = URLUtil.guessFileName(url, null, null);
            request.setTitle("Zenith Update");
            request.setDescription("Downloading " + fileName);
            
            // Show notification
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            
            // Set destination in Downloads folder
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            
            // Allow download over mobile and WiFi
            request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI | DownloadManager.Request.NETWORK_MOBILE);
            
            // Queue the download
            DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            long downloadId = downloadManager.enqueue(request);
            
            JSObject ret = new JSObject();
            ret.put("downloadId", downloadId);
            ret.put("success", true);
            call.resolve(ret);
            
        } catch (Exception e) {
            call.reject("Download failed: " + e.getMessage());
        }
    }
}
