const Card = ({
    children,
    variant = 'default',
    hover = true,
    className = '',
    onClick,
    ...props
}) => {
    const variantClasses = {
        default: 'card',
        glass: 'card-glass',
        gradient: 'card-gradient'
    };

    return (
        <div
            className={`${variantClasses[variant]} ${className}`}
            style={{
                cursor: onClick ? 'pointer' : 'default',
                transition: hover ? 'all var(--transition-base)' : 'none'
            }}
            onClick={onClick}
            {...props}
        >
            {children}
        </div>
    );
};

export default Card;
