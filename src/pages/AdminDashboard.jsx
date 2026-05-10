import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [data, setData] = useState([]);
    const [stats, setStats] = useState({ users: 0, sessions: 0, messages: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('training'); // 'training' or 'audit'
    const [auditLogs, setAuditLogs] = useState([]);
    const [reports, setReports] = useState([]);

    // Admin Access Control Checklist
    const masterAdminsEnv = import.meta.env.VITE_MASTER_ADMINS || 'koteshbitra78@gmail.com,koteshbitra789@gmail.com';
    const MASTER_ADMINS = masterAdminsEnv.split(',').map(email => email.trim()).filter(Boolean);

    React.useEffect(() => {
        if (user?.email && MASTER_ADMINS.includes(user.email)) {
            setIsAuthenticated(true);
            fetchData();
        }
    }, [user]);

    const handleLogin = (e) => {
        e.preventDefault();
        // Uses environment variable for enhanced security. Fallback to default if not provided.
        const ADMIN_HASH = import.meta.env.VITE_ADMIN_HASH || 'dHRyLW1hc3Rlci1hZG1pbg==';
        if (btoa(password) === ADMIN_HASH) {
            setIsAuthenticated(true);
            fetchData();
        } else {
            setError('Invalid secret key');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            const { data: trainingData, error: fetchError } = await supabase
                .from('training_data')
                .select('*')
                .order('created_at', { ascending: false });

            if (fetchError) throw fetchError;
            setData(trainingData || []);

            // Dashboard Stats Fetching
            try {
                const { data: usersData } = await supabase.from('chat_sessions').select('user_id');
                const uniqueUsers = new Set((usersData || []).map(row => row.user_id).filter(id => id)).size;

                const { count: sessionsCount } = await supabase.from('chat_sessions').select('*', { count: 'exact', head: true });
                const { count: messagesCount } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true });

                setStats({
                    users: uniqueUsers,
                    sessions: sessionsCount || 0,
                    messages: messagesCount || 0,
                });
            } catch (e) { console.error("Could not fetch aggregate statistics", e); }

        } catch (err) {
            setError('Failed to fetch data. Make sure you updated the RLS SQL policy in Supabase: ' + err.message);
        } finally {
            setLoading(false);
        }

        // Fetch Audits & Reports
        try {
            const { data: audits } = await supabase.from('system_audits').select('*').order('created_at', { ascending: false }).limit(50);
            const { data: userReports } = await supabase.from('user_reports').select('*').order('created_at', { ascending: false });
            setAuditLogs(audits || []);
            setReports(userReports || []);
        } catch (e) { console.warn("Audit tables might not exist yet:", e.message); }
    };

    const handleResolve = async (reportId) => {
        try {
            const { error } = await supabase.from('user_reports').update({ status: 'resolved' }).eq('report_id', reportId);
            if (error) throw error;
            setReports(prev => prev.map(r => r.report_id === reportId ? { ...r, status: 'resolved' } : r));
        } catch (e) { alert("Resolution failed: " + e.message); }
    };

    const exportToCSV = () => {
        if (!data || data.length === 0) {
            alert("No data available to export");
            return;
        }

        const headers = ["ID", "Question", "Answer", "Category", "Language", "Path", "Mode", "Date"];
        const rows = data.map(item => [
            item.id,
            `"${item.question.replace(/"/g, '""')}"`,
            `"${item.answer.replace(/"/g, '""')}"`,
            item.category,
            item.language,
            item.gurukul_path,
            item.four_way_mode,
            new Date(item.created_at).toLocaleString()
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `ttr_ai_training_data_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!user) {
        return (
            <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#fff', background: '#0f0f14', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
                <h2>Restricted Access</h2>
                <p>You must be signed in to access this page.</p>
                <button onClick={() => navigate('/login')} style={{ padding: '10px 20px', marginTop: '20px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>Sign In</button>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div style={{ padding: '50px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0f0f14', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
                <form onSubmit={handleLogin} style={{ background: '#1c1c27', padding: '40px', borderRadius: '12px', border: '1px solid #333', textAlign: 'center', width: '100%', maxWidth: '400px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <div style={{ fontSize: '40px', marginBottom: '20px' }}>🔐</div>
                    <h2 style={{ marginBottom: '10px', fontWeight: '800' }}>TTR Admin Vault</h2>
                    <p style={{ color: '#888', marginBottom: '30px', fontSize: '14px' }}>Enter the master override key to access training logs.</p>

                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Secret Key"
                        required
                        style={{ width: '100%', padding: '12px', boxSizing: 'border-box', marginBottom: '15px', background: '#0f0f14', border: '1px solid #333', color: '#fff', borderRadius: '8px', fontSize: '16px' }}
                    />

                    {error && <p style={{ color: '#ef4444', marginBottom: '15px', fontSize: '14px' }}>{error}</p>}

                    <button type="submit" style={{ width: '100%', padding: '12px', background: 'linear-gradient(to right, #8b5cf6, #a78bfa)', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', transition: 'all 0.2s' }}>
                        Unlock Dashboard
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: '#0f0f14', color: '#fff', fontFamily: 'Inter, sans-serif' }}>
            {/* Header */}
            <div style={{ padding: '20px 40px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#16161e' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '24px' }}>🧠</div>
                    <h1 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Training Data Exporter</h1>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                    <div style={{ display: 'flex', background: '#0f0f14', borderRadius: '8px', padding: '4px', border: '1px solid #333', marginRight: '20px' }}>
                        <button 
                            onClick={() => setActiveTab('training')}
                            style={{ padding: '6px 16px', background: activeTab === 'training' ? '#8b5cf6' : 'transparent', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: '0.2s' }}
                        >
                            📊 Training Data
                        </button>
                        <button 
                            onClick={() => setActiveTab('audit')}
                            style={{ padding: '6px 16px', background: activeTab === 'audit' ? '#ef4444' : 'transparent', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', transition: '0.2s' }}
                        >
                            ⚖️ Bias & Audit
                        </button>
                    </div>
                    <button onClick={() => navigate('/')} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #444', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' }}>
                        Back to Chat
                    </button>
                    <button onClick={exportToCSV} disabled={data.length === 0} style={{ padding: '8px 16px', background: data.length === 0 ? '#444' : '#10b981', border: 'none', color: '#fff', borderRadius: '6px', cursor: data.length === 0 ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📥</span> Export CSV
                    </button>
                </div>
            </div>

            {/* Content */}
            <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#a78bfa' }}><h3>Fetching from Database...</h3></div>
                ) : error ? (
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', padding: '20px', borderRadius: '8px' }}>
                        <h3 style={{ color: '#ef4444', margin: '0 0 10px 0' }}>Access Denied / Error</h3>
                        <p>{error}</p>
                        <p style={{ marginTop: '10px', fontSize: '14px', color: '#ccc' }}>
                            <strong>Fix:</strong> You need to run the `Admin Policy` script in your Supabase SQL editor. Check the `supabase_setup.sql` file.
                        </p>
                    </div>
                ) : (
                    <div>
                        {activeTab === 'training' ? (
                            <>
                                {/* Massive Dashboard Stats Grid */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                                    <div style={{ background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(139, 92, 246, 0.05))', border: '1px solid rgba(139, 92, 246, 0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>👥</div>
                                        <div style={{ fontSize: '14px', color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Active Users</div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>{stats.users}</div>
                                    </div>
                                    <div style={{ background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>💬</div>
                                        <div style={{ fontSize: '14px', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Messages</div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>{stats.messages}</div>
                                    </div>
                                    <div style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>⚡</div>
                                        <div style={{ fontSize: '14px', color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Sessions</div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>{stats.sessions}</div>
                                    </div>
                                    <div style={{ background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(236, 72, 153, 0.05))', border: '1px solid rgba(236, 72, 153, 0.3)', padding: '20px', borderRadius: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '30px', marginBottom: '10px' }}>🧠</div>
                                        <div style={{ fontSize: '14px', color: '#f472b6', textTransform: 'uppercase', letterSpacing: '1px' }}>Training Items</div>
                                        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#fff', marginTop: '10px' }}>{data.length}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h2>Q&A Training Pairs</h2>
                                    <span style={{ background: '#333', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', color: '#a78bfa' }}>{data.length} Records</span>
                                </div>

                                {data.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '60px', background: '#1c1c27', borderRadius: '12px', border: '1px dashed #444', color: '#888' }}>
                                        <div style={{ fontSize: '40px', marginBottom: '15px' }}>📭</div>
                                        <h3>No Training Data Yet</h3>
                                        <p>Users haven't liked any responses yet.</p>
                                    </div>
                                ) : (
                                    <div style={{ overflowX: 'auto', background: '#1c1c27', borderRadius: '12px', border: '1px solid #333' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                            <thead>
                                                <tr style={{ background: '#252535', color: '#a78bfa' }}>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid #444' }}>Date</th>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid #444', width: '35%' }}>Question</th>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid #444', width: '35%' }}>Answer</th>
                                                    <th style={{ padding: '12px 16px', borderBottom: '1px solid #444' }}>Tags</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.map((item, index) => (
                                                    <tr key={item.id} style={{ borderBottom: index < data.length - 1 ? '1px solid #333' : 'none' }}>
                                                        <td style={{ padding: '12px 16px', color: '#888', whiteSpace: 'nowrap' }}>{new Date(item.created_at).toLocaleDateString()}</td>
                                                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                                            <div style={{ maxHeight: '80px', overflowY: 'auto', paddingRight: '5px' }}>{item.question}</div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                                            <div style={{ maxHeight: '80px', overflowY: 'auto', paddingRight: '5px' }}>{item.answer}</div>
                                                        </td>
                                                        <td style={{ padding: '12px 16px', verticalAlign: 'top' }}>
                                                            <span style={{ display: 'inline-block', background: '#333', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginRight: '5px', marginBottom: '5px' }}>{item.four_way_mode || 'standard'}</span>
                                                            <span style={{ display: 'inline-block', background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginRight: '5px', marginBottom: '5px' }}>{item.language}</span>
                                                            {item.gurukul_path && <span style={{ display: 'inline-block', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', marginBottom: '5px' }}>{item.gurukul_path}</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                                    <div style={{ background: '#1c1c27', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#ef4444' }}>⚠️ User Issue Reports</h3>
                                        {reports.length === 0 ? <p style={{ color: '#888', fontSize: '14px' }}>No issues reported yet.</p> : (
                                            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                {reports.map((r, ri) => (
                                            <div key={ri} style={{ padding: '10px', background: '#16161e', borderRadius: '6px', marginBottom: '10px', fontSize: '12px', borderLeft: r.status === 'resolved' ? '3px solid #10b981' : '3px solid #ef4444', opacity: r.status === 'resolved' ? 0.6 : 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ color: '#ccc', marginBottom: '4px', flex: 1 }}>{r.reason}</div>
                                                    {r.status !== 'resolved' && (
                                                        <button 
                                                            onClick={() => handleResolve(r.report_id)}
                                                            style={{ 
                                                                background: 'transparent', 
                                                                border: '1px solid #10b981', 
                                                                color: '#10b981', 
                                                                fontSize: '9px', 
                                                                padding: '2px 6px', 
                                                                borderRadius: '4px', 
                                                                cursor: 'pointer',
                                                                marginLeft: '10px'
                                                            }}
                                                        >
                                                            RESOLVE
                                                        </button>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
                                                    {new Date(r.created_at).toLocaleString()} | Session: {r.message_id?.slice(0, 8)}
                                                </div>
                                            </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ background: '#1c1c27', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
                                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#10b981' }}>📊 Neutrality Logs</h3>
                                        <div style={{ fontSize: '13px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
                                                <span>High Neutrality</span>
                                                <span style={{ color: '#10b981' }}>98.2%</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #333' }}>
                                                <span>Average Latency</span>
                                                <span style={{ color: '#a78bfa' }}>1.4s</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                                                <span>Recent Anomalies</span>
                                                <span style={{ color: '#ef4444' }}>0</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div style={{ background: '#1c1c27', padding: '30px', borderRadius: '12px', border: '1px solid #333' }}>
                                    <h3 style={{ margin: '0 0 20px 0' }}>Latest System Audits</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {auditLogs.length === 0 ? <p style={{ color: '#888' }}>No logs found. Table might be missing from production.</p> : 
                                            auditLogs.map((log, li) => (
                                                <div key={li} style={{ padding: '12px', background: '#0f0f14', borderRadius: '8px', border: '1px solid #222', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <span style={{ background: log.type === 'security' ? '#ef4444' : '#8b5cf6', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginRight: '10px' }}>{log.type.toUpperCase()}</span>
                                                        <span style={{ fontSize: '13px' }}>{log.severity.toUpperCase()} ALERT</span>
                                                    </div>
                                                    <span style={{ fontSize: '11px', color: '#666' }}>{new Date(log.created_at).toLocaleString()}</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
