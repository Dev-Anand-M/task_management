import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ImageCropper — zero-dependency canvas-based responsive profile cropper.
 * Outputs a clean full-bleed 512x512 square profile image.
 * Perfectly square 1:1 aspect ratio on laptops, tablets, and mobile screens without distortion or stretching.
 * Props:
 *   imageSrc   — object URL of the selected image
 *   onCrop     — callback(blob) called with the cropped image blob
 *   onCancel   — callback to close without cropping
 */
const ImageCropper = ({ imageSrc, onCrop, onCancel }) => {
    const canvasRef = useRef(null);
    const imgRef = useRef(null);

    const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });
    const pinchRef = useRef({ touching: false, lastDist: 0 });

    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Internal canvas resolution
    const CANVAS_SIZE = 400;
    const CROP_SIZE = 400; // circular crop frame area (full bleed inside circular container)

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || !imgLoaded) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const radius = CROP_SIZE / 2;

        ctx.clearRect(0, 0, W, H);

        // 1. Draw scaled & offset image
        const iw = img.naturalWidth * scale;
        const ih = img.naturalHeight * scale;
        const ix = cx - iw / 2 + offset.x;
        const iy = cy - ih / 2 + offset.y;

        ctx.drawImage(img, ix, iy, iw, ih);

        // 2. Dim backdrop outside circle crop mask
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        ctx.arc(cx, cy, radius, 0, Math.PI * 2, true); // Counter-clockwise for evenodd hole
        ctx.fill('evenodd');
        ctx.restore();

        // 3. Glowing Emerald circular guide border
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();

        // 4. Rule-of-thirds grid lines (clipped inside circle)
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.clip();

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        const rx = cx - radius;
        const ry = cy - radius;
        const rw = CROP_SIZE;
        const rh = CROP_SIZE;

        ctx.beginPath();
        ctx.moveTo(rx + rw / 3, ry); ctx.lineTo(rx + rw / 3, ry + rh);
        ctx.moveTo(rx + (rw * 2) / 3, ry); ctx.lineTo(rx + (rw * 2) / 3, ry + rh);
        ctx.moveTo(rx, ry + rh / 3); ctx.lineTo(rx + rw, ry + rh / 3);
        ctx.moveTo(rx, ry + (rh * 2) / 3); ctx.lineTo(rx + rw, ry + (rh * 2) / 3);
        ctx.stroke();
        ctx.restore();
    }, [offset, scale, imgLoaded]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        if (!imgLoaded || !imgRef.current) return;
        const img = imgRef.current;
        const coverScale = Math.max(CROP_SIZE / (img.naturalWidth || 1), CROP_SIZE / (img.naturalHeight || 1));
        setScale(coverScale);
        setOffset({ x: 0, y: 0 });
    }, [imgLoaded]);

    const onMouseDown = (e) => {
        dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
    };
    const onMouseMove = (e) => {
        if (!dragRef.current.dragging) return;
        const dx = e.clientX - dragRef.current.lastX;
        const dy = e.clientY - dragRef.current.lastY;
        dragRef.current.lastX = e.clientX;
        dragRef.current.lastY = e.clientY;
        setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
    };
    const onMouseUp = () => { dragRef.current.dragging = false; };

    const onTouchStart = (e) => {
        if (e.touches.length === 1) {
            dragRef.current = { dragging: true, lastX: e.touches[0].clientX, lastY: e.touches[0].clientY };
        } else if (e.touches.length === 2) {
            dragRef.current.dragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchRef.current = { touching: true, lastDist: Math.hypot(dx, dy) };
        }
    };
    const onTouchMove = (e) => {
        if (e.touches.length === 1 && dragRef.current.dragging) {
            const dx = e.touches[0].clientX - dragRef.current.lastX;
            const dy = e.touches[0].clientY - dragRef.current.lastY;
            dragRef.current.lastX = e.touches[0].clientX;
            dragRef.current.lastY = e.touches[0].clientY;
            setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
        } else if (e.touches.length === 2 && pinchRef.current.touching) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const delta = dist / (pinchRef.current.lastDist || 1);
            pinchRef.current.lastDist = dist;
            setScale(s => Math.min(6, Math.max(0.2, s * delta)));
        }
    };
    const onTouchEnd = () => {
        dragRef.current.dragging = false;
        pinchRef.current.touching = false;
    };

    const onWheel = (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        setScale(s => Math.min(6, Math.max(0.2, s * delta)));
    };

    const handleCrop = () => {
        setUploading(true);
        const img = imgRef.current;
        if (!img) return;
        const out = document.createElement('canvas');
        const size = 512;
        out.width = size;
        out.height = size;
        const ctx = out.getContext('2d');

        // Clip output canvas to a clean 1:1 circle with 100% transparency outside
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();

        const ratio = size / CROP_SIZE;
        const iw = img.naturalWidth * scale * ratio;
        const ih = img.naturalHeight * scale * ratio;
        const x = size / 2 - iw / 2 + offset.x * ratio;
        const y = size / 2 - ih / 2 + offset.y * ratio;
        ctx.drawImage(img, x, y, iw, ih);

        out.toBlob((blob) => {
            setUploading(false);
            onCrop(blob);
        }, 'image/png');
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 99999,
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <img
                ref={imgRef}
                src={imageSrc}
                onLoad={() => setImgLoaded(true)}
                crossOrigin="anonymous"
                style={{ display: 'none' }}
                alt=""
            />

            <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                <h3 style={{ color: 'white', fontWeight: 800, fontSize: '20px', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                    Crop Profile Picture
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13px', margin: 0, fontWeight: 500 }}>
                    Drag to align · Pinch or scroll mouse wheel to zoom
                </p>
            </div>

            {/* Responsive Circular Canvas Frame Box */}
            <div
                style={{
                    cursor: 'grab',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    background: '#0a0d12',
                    touchAction: 'none',
                    userSelect: 'none',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 0 3.5px #10b981, 0 0 30px rgba(16,185,129,0.45)',
                    width: 'min(300px, 75vw)',
                    height: 'min(300px, 75vw)',
                    maxWidth: '300px',
                    maxHeight: '300px',
                    aspectRatio: '1 / 1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onWheel={onWheel}
            >
                <canvas
                    ref={canvasRef}
                    width={CANVAS_SIZE}
                    height={CANVAS_SIZE}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        aspectRatio: '1 / 1',
                        display: 'block'
                    }}
                />
            </div>

            {/* Zoom Slider Controls */}
            <div style={{
                marginTop: '18px',
                width: 'min(300px, 80vw)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.06)',
                padding: '8px 16px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.1)'
            }}>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontWeight: 700, userSelect: 'none' }}>−</span>
                <input
                    type="range"
                    min="0.2" max="6" step="0.01"
                    value={scale}
                    onChange={e => setScale(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '16px', fontWeight: 700, userSelect: 'none' }}>+</span>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '14px', marginTop: '22px' }}>
                <button
                    type="button"
                    onClick={onCancel}
                    style={{
                        padding: '11px 24px',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 700,
                        transition: 'all 0.15s ease'
                    }}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleCrop}
                    disabled={!imgLoaded || uploading}
                    style={{
                        padding: '11px 28px',
                        background: uploading ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '14px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 800,
                        boxShadow: '0 6px 20px rgba(16,185,129,0.45)',
                        transition: 'all 0.15s ease'
                    }}
                >
                    {uploading ? 'Processing…' : '✓ Save Photo'}
                </button>
            </div>
        </div>
    );
};

export default ImageCropper;
