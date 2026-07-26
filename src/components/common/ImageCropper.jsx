import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * ImageCropper — zero-dependency canvas-based square profile cropper.
 * Outputs a clean full-bleed 512x512 square image without baked-in black circular borders.
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

    const CROP_W = 310;
    const CROP_H = 310;
    const CANVAS_W = 330;
    const CANVAS_H = 330;

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        if (!canvas || !img || !imgLoaded) return;

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const cx = W / 2;
        const cy = H / 2;
        const rw = CROP_W;
        const rh = CROP_H;
        const rx = cx - rw / 2;
        const ry = cy - rh / 2;
        const radius = 16;

        ctx.clearRect(0, 0, W, H);

        // 1. Draw image
        const iw = img.naturalWidth * scale;
        const ih = img.naturalHeight * scale;
        const ix = cx - iw / 2 + offset.x;
        const iy = cy - ih / 2 + offset.y;
        ctx.drawImage(img, ix, iy, iw, ih);

        // 2. Dim outside crop box (evenodd rule: keeps square area 100% bright & visible)
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.rect(0, 0, W, H);
        if (ctx.roundRect) {
            ctx.roundRect(rx, ry, rw, rh, radius);
        } else {
            ctx.rect(rx, ry, rw, rh);
        }
        ctx.fill('evenodd');
        ctx.restore();

        // 3. Green guide border
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(rx, ry, rw, rh, radius);
        } else {
            ctx.rect(rx, ry, rw, rh);
        }
        ctx.stroke();

        // Grid lines (rule of thirds)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
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
        const coverScale = Math.max(CROP_W / (img.naturalWidth || 1), CROP_H / (img.naturalHeight || 1));
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
            setScale(s => Math.min(5, Math.max(0.3, s * delta)));
        }
    };
    const onTouchEnd = () => {
        dragRef.current.dragging = false;
        pinchRef.current.touching = false;
    };

    const onWheel = (e) => {
        const delta = e.deltaY > 0 ? 0.92 : 1.08;
        setScale(s => Math.min(5, Math.max(0.3, s * delta)));
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

        // Output full square image WITHOUT clipping to circle or adding black padding
        const ratio = size / CROP_W;
        const iw = img.naturalWidth * scale * ratio;
        const ih = img.naturalHeight * scale * ratio;
        const x = size / 2 - iw / 2 + offset.x * ratio;
        const y = size / 2 - ih / 2 + offset.y * ratio;
        ctx.drawImage(img, x, y, iw, ih);

        out.toBlob((blob) => {
            setUploading(false);
            onCrop(blob);
        }, 'image/jpeg', 0.95);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.88)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 99999,
            padding: '16px'
        }}>
            <img
                ref={imgRef}
                src={imageSrc}
                onLoad={() => setImgLoaded(true)}
                crossOrigin="anonymous"
                style={{ display: 'none' }}
                alt=""
            />

            <div style={{ marginBottom: '14px', textAlign: 'center' }}>
                <p style={{ color: 'white', fontWeight: 700, fontSize: '18px', margin: '0 0 4px' }}>Crop Profile Picture</p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', margin: 0 }}>
                    Drag to align · Pinch / scroll to zoom
                </p>
            </div>

            <div
                style={{
                    cursor: 'grab',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    background: '#0d1117',
                    touchAction: 'none',
                    userSelect: 'none',
                    boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 0 2px rgba(16,185,129,0.4)'
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
                    width={CANVAS_W}
                    height={CANVAS_H}
                    style={{ display: 'block', maxWidth: 'min(330px, calc(100vw - 32px))' }}
                />
            </div>

            {/* Zoom slider */}
            <div style={{ marginTop: '14px', width: 'min(280px, calc(100vw - 64px))', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>−</span>
                <input
                    type="range"
                    min="0.3" max="5" step="0.01"
                    value={scale}
                    onChange={e => setScale(Number(e.target.value))}
                    style={{ flex: 1, accentColor: '#10b981' }}
                />
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>+</span>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '18px' }}>
                <button
                    onClick={onCancel}
                    style={{
                        padding: '10px 22px',
                        background: 'rgba(255,255,255,0.1)',
                        color: 'white',
                        border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleCrop}
                    disabled={!imgLoaded || uploading}
                    style={{
                        padding: '10px 26px',
                        background: uploading ? 'rgba(16,185,129,0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 700,
                        boxShadow: '0 4px 16px rgba(16,185,129,0.4)'
                    }}
                >
                    {uploading ? 'Processing…' : '✓ Save Photo'}
                </button>
            </div>
        </div>
    );
};

export default ImageCropper;
