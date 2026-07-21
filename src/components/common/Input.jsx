import { forwardRef } from 'react';

const Input = forwardRef(({
    label,
    error,
    icon: Icon,
    className = '',
    wrapperClassName = '',
    ...props
}, ref) => {
    const isTextarea = props.type === 'textarea';
    const isSelect = props.type === 'select';

    const InputComponent = isTextarea ? 'textarea' : isSelect ? 'select' : 'input';

    return (
        <div className={`input-group ${wrapperClassName}`}>
            {label && <label className="input-label">{label}</label>}
            <div style={{ position: 'relative' }}>
                {Icon && (
                    <span style={{
                        position: 'absolute',
                        left: '12px',
                        top: 0,
                        bottom: 0,
                        color: 'var(--text-muted)',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2
                    }}>
                        <Icon size={18} />
                    </span>
                )}
                <InputComponent
                    ref={ref}
                    className={`input ${isTextarea ? 'textarea' : ''} ${isSelect ? 'select' : ''} ${error ? 'input-error' : ''} ${className}`}
                    {...((isTextarea || isSelect) ? (() => { const { type, ...rest } = props; return rest; })() : props)}
                    style={{
                        ...(Icon ? { paddingLeft: '40px' } : {}),
                        ...(props.style || {})
                    }}
                />
            </div>
            {error && (
                <span style={{ color: 'var(--error-500)', fontSize: 'var(--text-sm)' }}>
                    {error}
                </span>
            )}
        </div>
    );
});

Input.displayName = 'Input';

export default Input;
