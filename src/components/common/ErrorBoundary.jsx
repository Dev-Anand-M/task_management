import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';
import Card from './Card';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 'var(--space-xl)',
                    background: 'var(--bg)'
                }}>
                    <Card style={{
                        maxWidth: '500px',
                        textAlign: 'center',
                        padding: 'var(--space-2xl)'
                    }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            margin: '0 auto var(--space-lg)',
                            borderRadius: '50%',
                            background: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle size={40} style={{ color: 'var(--error-500)' }} />
                        </div>
                        <h2 style={{ marginBottom: 'var(--space-sm)' }}>
                            Something went wrong
                        </h2>
                        <p style={{
                            color: 'var(--text-muted)',
                            marginBottom: 'var(--space-lg)'
                        }}>
                            We're sorry for the inconvenience. Please try refreshing the page.
                        </p>
                        {import.meta.env.DEV && this.state.error && (
                            <pre style={{
                                padding: 'var(--space-md)',
                                background: 'var(--card)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--text-xs)',
                                textAlign: 'left',
                                overflow: 'auto',
                                marginBottom: 'var(--space-lg)'
                            }}>
                                {this.state.error.toString()}
                            </pre>
                        )}
                        <Button
                            onClick={() => window.location.reload()}
                            style={{ width: '100%' }}
                        >
                            Refresh Page
                        </Button>
                    </Card>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
