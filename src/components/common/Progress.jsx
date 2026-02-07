const ProgressBar = ({ value, max = 100, showLabel = false, size = 'md' }) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

    const heights = {
        sm: '4px',
        md: '8px',
        lg: '12px'
    };

    return (
        <div style={{ width: '100%' }}>
            {showLabel && (
                <div className="flex justify-between mb-sm" style={{ fontSize: 'var(--text-sm)' }}>
                    <span className="text-muted">{Math.round(percentage)}%</span>
                    <span className="text-muted">{value}/{max}</span>
                </div>
            )}
            <div
                className="progress"
                style={{ height: heights[size] }}
            >
                <div
                    className="progress-bar"
                    style={{ width: `${percentage}%` }}
                />
            </div>
        </div>
    );
};

export const ProgressRing = ({ value, max = 100, size = 60, strokeWidth = 4 }) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <svg
            width={size}
            height={size}
            className="progress-ring"
        >
            <circle
                stroke="var(--border)"
                strokeWidth={strokeWidth}
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
            />
            <circle
                className="progress-ring-circle"
                stroke="url(#gradient)"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="transparent"
                r={radius}
                cx={size / 2}
                cy={size / 2}
                style={{
                    strokeDasharray: circumference,
                    strokeDashoffset
                }}
            />
            <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--primary-500)" />
                    <stop offset="100%" stopColor="var(--accent-500)" />
                </linearGradient>
            </defs>
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dy="0.35em"
                fill="var(--text)"
                fontSize="14"
                fontWeight="600"
            >
                {Math.round(percentage)}%
            </text>
        </svg>
    );
};

export default ProgressBar;
