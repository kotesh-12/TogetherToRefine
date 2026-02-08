import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '20px',
                    color: '#d63031',
                    textAlign: 'center',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontFamily: 'system-ui'
                }}>
                    <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>⚠️ Something went wrong.</h1>
                    <p style={{ maxWidth: '600px', margin: '0 auto 20px' }}>
                        The application encountered a critical error.
                    </p>

                    <div style={{
                        background: '#f1f2f6',
                        padding: '15px',
                        borderRadius: '5px',
                        textAlign: 'left',
                        marginBottom: '20px',
                        fontSize: '12px',
                        overflow: 'auto',
                        maxHeight: '200px',
                        width: '80%',
                        maxWidth: '600px',
                        color: '#2d3436'
                    }}>
                        <strong>Error:</strong> {this.state.error?.toString()}
                        <br /><br />
                        <details>
                            <summary>Stack Trace</summary>
                            <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.errorInfo?.componentStack}</pre>
                        </details>
                    </div>

                    <button
                        onClick={() => {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.reload();
                        }}
                        style={{
                            padding: '10px 20px',
                            background: '#0984e3',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '16px'
                        }}
                    >
                        ⟳ Hard Reset & Reload
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
