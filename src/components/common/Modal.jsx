import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

const Modal = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    size = 'md',
    showClose = true
}) => {
    const modalRef = useRef(null);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen) return null;

    const sizeStyles = {
        sm: { maxWidth: '400px' },
        md: { maxWidth: '600px' },
        lg: { maxWidth: '800px' },
        xl: { maxWidth: '1000px' },
        full: { maxWidth: '95vw', width: '100%' }
    };

    return (
        <div className="modal-overlay" onClick={handleBackdropClick}>
            <div
                ref={modalRef}
                className="modal animate-slide-up"
                style={sizeStyles[size]}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h3 style={{ margin: 0 }}>{title}</h3>
                    {showClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}>
                            <X size={20} />
                        </Button>
                    )}
                </div>
                <div className="modal-body">
                    {children}
                </div>
                {footer && (
                    <div className="modal-footer">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
