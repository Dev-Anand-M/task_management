const LoadingSpinner = ({ size = 'md' }) => {
    const sizes = {
        sm: '24px',
        md: '40px',
        lg: '60px'
    };

    return (
        <div
            className="loading-spinner"
            style={{
                width: sizes[size],
                height: sizes[size],
                border: '3px solid var(--border)',
                borderTopColor: 'var(--primary-500)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
            }}
        />
    );
};

export default LoadingSpinner;
