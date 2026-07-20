/**
 * Universal file sharing / downloading helper for mobile apps (Capacitor) and browsers.
 */
export const shareOrDownloadFile = async (data, fileName, mimeType) => {
    const isMobileDevice = /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.Capacitor;
    
    if (isMobileDevice && navigator.canShare) {
        try {
            const file = new File([data], fileName, { type: mimeType });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: fileName,
                    text: `Exported: ${fileName}`
                });
                return true;
            }
        } catch (error) {
            console.error("Failed to share file on mobile platform:", error);
        }
    }
    
    // Fallback: standard web download
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup URL
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 100);
    
    return false;
};
