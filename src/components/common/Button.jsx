import { forwardRef } from 'react';

const Button = forwardRef(({
    children,
    variant = 'primary',
    size = 'md',
    icon: Icon,
    iconPosition = 'left',
    loading = false,
    disabled = false,
    className = '',
    ...props
}, ref) => {
    const sizeClasses = {
        sm: 'btn-sm',
        md: '',
        lg: 'btn-lg',
        icon: 'btn-icon'
    };

    const variantClasses = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        ghost: 'btn-ghost',
        danger: 'btn-danger',
        success: 'btn-success'
    };

    return (
        <button
            ref={ref}
            className={`btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
            disabled={disabled || loading}
            {...props}
        >
            {loading && (
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="31.416" strokeDashoffset="10" />
                </svg>
            )}
            {!loading && Icon && iconPosition === 'left' && <Icon size={size === 'sm' ? 14 : 18} />}
            {children}
            {!loading && Icon && iconPosition === 'right' && <Icon size={size === 'sm' ? 14 : 18} />}
        </button>
    );
});

Button.displayName = 'Button';

export default Button;
