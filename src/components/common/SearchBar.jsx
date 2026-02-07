import { Search, X } from 'lucide-react';

const SearchBar = ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
    expandable = false,
    onClear
}) => {
    return (
        <div className={`relative group flex items-center ${className}`}>
            <input
                type="text"
                placeholder={placeholder}
                className={`
                    w-full pl-11 pr-10 py-2.5 
                    bg-surface/40 hover:bg-surface/60 focus:bg-surface/80
                    border border-border/40 focus:border-primary-500/50 
                    rounded-2xl text-sm text-text
                    outline-none transition-all duration-300
                    focus:ring-4 focus:ring-primary-500/10
                    placeholder:text-muted/40
                    backdrop-blur-md
                    ${expandable ? 'md:w-64 focus:md:w-80' : ''}
                `}
                value={value}
                onChange={onChange}
            />
            <Search
                size={18}
                style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    opacity: 0.5,
                    pointerEvents: 'none',
                    transition: 'all 0.3s',
                    zIndex: 1
                }}
                className="group-focus-within:text-primary-500"
            />

            {value && (
                <button
                    onClick={() => {
                        onChange({ target: { value: '' } });
                        if (onClear) onClear();
                    }}
                    className="absolute right-3 p-1 rounded-full hover:bg-muted/10 text-muted/60 hover:text-text transition-all"
                >
                    <X size={14} />
                </button>
            )}

        </div>
    );
};

export default SearchBar;
