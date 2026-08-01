import React, { useState, useEffect, useRef } from 'react';

/**
 * iOS-Level Performance Optimization
 * Lazy Loading Image Component with Intersection Observer
 * 
 * Features:
 * - Only loads images when they enter viewport
 * - Smooth fade-in transition
 * - Placeholder while loading
 * - 50px rootMargin for prefetching
 * 
 * Usage:
 * <LazyImage 
 *   src="/path/to/image.jpg" 
 *   alt="Description" 
 *   className="custom-class"
 *   placeholder="#f0f0f0"
 * />
 */
const LazyImage = ({ 
  src, 
  alt = '', 
  className = '', 
  placeholder = 'var(--gray-100)',
  style = {},
  onLoad,
  onError,
  ...props 
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef();

  useEffect(() => {
    // Modern Intersection Observer API for viewport detection
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { 
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01 
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = (e) => {
    setIsLoaded(true);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setHasError(true);
    setIsLoaded(false);
    if (onError) onError(e);
  };

  return (
    <div 
      ref={imgRef} 
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        ...style
      }}
    >
      {/* Placeholder */}
      {!isLoaded && !hasError && (
        <div 
          style={{ 
            position: 'absolute',
            inset: 0,
            background: placeholder,
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }} 
        />
      )}

      {/* Error State */}
      {hasError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--gray-100)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)'
          }}
        >
          <span>⚠️ Failed to load</span>
        </div>
      )}

      {/* Actual Image */}
      {isInView && !hasError && (
        <img
          src={src}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 300ms var(--ios-spring, cubic-bezier(0.22, 1, 0.36, 1))',
            ...style
          }}
          {...props}
        />
      )}
    </div>
  );
};

export default LazyImage;

// Pulse animation for placeholder
const style = document.createElement('style');
style.textContent = `
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
`;
if (typeof document !== 'undefined') {
  document.head.appendChild(style);
}
