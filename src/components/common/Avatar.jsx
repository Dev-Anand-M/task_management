import { getInitials } from '../../utils/constants';

const Avatar = ({ name, image, size = 'md', className = '' }) => {
    const sizeClasses = {
        sm: 'avatar-sm',
        md: 'avatar-md',
        lg: 'avatar-lg',
        xl: 'avatar-xl'
    };

    if (image) {
        return (
            <img
                src={image}
                alt={name}
                className={`avatar ${sizeClasses[size]} ${className}`}
                style={{ objectFit: 'cover' }}
            />
        );
    }

    return (
        <div className={`avatar ${sizeClasses[size]} ${className}`}>
            {getInitials(name || 'U')}
        </div>
    );
};

export default Avatar;
