import { Download, X } from 'lucide-react';

const UpdateDialog = ({ updateInfo, onDownload, onDismiss, onClose }) => {
  const { latestVersion, currentVersion, releaseNotes, mandatory } = updateInfo;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(10px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--primary-500)',
          borderRadius: '24px',
          padding: '40px',
          maxWidth: '500px',
          width: '100%',
          position: 'relative',
          boxShadow: '0 0 50px rgba(99,102,241,0.5)',
        }}
      >
        {/* Close button (only if not mandatory) */}
        {!mandatory && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '8px',
            }}
            className="hover:text-white"
          >
            <X size={20} />
          </button>
        )}

        {/* Logo Icon */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <img
            src="/zenith.png"
            alt="Zenith Logo"
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'contain',
              borderRadius: '20px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              border: '2px solid rgba(255,255,255,0.1)',
            }}
          />
        </div>

        {/* Title */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: '800',
            textAlign: 'center',
            margin: '0 0 10px 0',
          }}
        >
          Update Available!
        </h2>

        {/* Version info */}
        <p
          style={{
            textAlign: 'center',
            color: 'var(--text-muted)',
            marginBottom: '20px',
          }}
        >
          Version {latestVersion} is now available
          <br />
          <span style={{ fontSize: '14px' }}>
            (You have version {currentVersion})
          </span>
        </p>

        {/* Release notes */}
        {releaseNotes && (
          <div
            style={{
              background: 'var(--background)',
              padding: '16px',
              borderRadius: '12px',
              marginBottom: '24px',
              fontSize: '14px',
              color: 'var(--text-muted)',
              whiteSpace: 'pre-line',
              lineHeight: '1.6',
            }}
          >
            {releaseNotes}
          </div>
        )}

        {/* Mandatory notice */}
        {mandatory && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgb(239, 68, 68)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '14px',
              color: 'rgb(239, 68, 68)',
              textAlign: 'center',
            }}
          >
            ⚠️ This is a mandatory update
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onDownload}
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--primary-500)',
              color: 'white',
              fontWeight: '800',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(99,102,241,0.3)',
            }}
            className="hover:opacity-90 active:scale-95"
          >
            <Download size={20} />
            Download Update
          </button>

          {!mandatory && (
            <button
              onClick={onDismiss}
              style={{
                padding: '16px 24px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontWeight: '600',
                fontSize: '16px',
                cursor: 'pointer',
              }}
              className="hover:bg-gray-800"
            >
              Later
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpdateDialog;
