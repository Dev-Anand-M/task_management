/**
 * Universal file sharing / downloading helper for mobile apps (Capacitor) and browsers.
 */
export const shareOrDownloadFile = async (data, fileName, mimeType) => {
    try {
        const isCapacitor = typeof window !== 'undefined' && (!!window.Capacitor || !!window.Capacitor?.isNativePlatform?.());
        const isMobileDevice = typeof navigator !== 'undefined' && (/android|iphone|ipad|ipod/i.test(navigator.userAgent) || isCapacitor);
        const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });

        // 1. Try Native Web Share API if supported on mobile
        if (isMobileDevice && typeof navigator !== 'undefined' && navigator.canShare) {
            try {
                const file = new File([blob], fileName, { type: mimeType });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: fileName,
                        text: `Exported: ${fileName}`
                    });
                    return true;
                }
            } catch (shareErr) {
                console.warn("[FileExporter] Mobile share cancelled or unsupported, falling back to download:", shareErr);
            }
        }

        // 2. Data URL Download Fallback (Guaranteed to work in Android/iOS Capacitor WebViews & standard browsers)
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = fileName;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                if (link.parentNode) {
                    document.body.removeChild(link);
                }
            }, 300);
        };
        reader.readAsDataURL(blob);
        return true;
    } catch (error) {
        console.error("[FileExporter] Export file failed:", error);
        alert("Export failed: " + (error.message || "Unable to save file"));
        return false;
    }
};
