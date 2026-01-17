import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export default function FeedbackOverview() {
    const navigate = useNavigate();
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterClass, setFilterClass] = useState('');
    const [searchName, setSearchName] = useState('');

    useEffect(() => {
        const fetchFeedback = async () => {
            try {
                // Fetch all general feedback
                const q = query(collection(db, "general_feedback"), orderBy("timestamp", "desc"));
                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setFeedbacks(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchFeedback();
    }, []);

    // Helper to calculate total score
    const getScore = (f) => {
        // Safe access in case older data structure
        const b = f.behavior?.stars || 0;
        const c = f.communication?.stars || 0;
        const bl = f.bodyLanguage?.stars || 0;
        const hw = f.hardworking?.stars || 0;
        return ((b + c + bl + hw) / 20) * 100; // Percentage
    };

    const filtered = feedbacks.filter(f => {
        // Simple client-side search by Target Person Name
        return f.targetPerson?.toLowerCase().includes(searchName.toLowerCase());
    });

    return (
        <div className="container" style={{ maxWidth: '900px', margin: '20px auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 className="text-center" style={{ margin: 0 }}>📊 Institutional Feedback Overview</h2>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}>⬅ Back</button>
            </div>

            <div className="card" style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <input
                    className="input-field"
                    placeholder="Search by Teacher/Student Name..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    style={{ flex: 1 }}
                />
                <select className="input-field" style={{ width: '150px' }} value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                    <option value="">All Classes</option>
                    <option value="10">Class 10</option>
                    <option value="9">Class 9</option>
                    {/* Add more as needed */}
                </select>
            </div>

            {loading && <p className="text-center">Loading Data...</p>}

            <div style={{ display: 'grid', gap: '20px' }}>
                {filtered.map(item => {
                    const score = getScore(item);
                    return (
                        <div key={item.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                                <div>
                                    <h3 style={{ margin: 0 }}>{item.targetPerson || "Unknown User"}</h3>
                                    <div style={{ fontSize: '12px', color: '#888' }}>
                                        {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: score >= 75 ? '#2ecc71' : (score > 40 ? '#f1c40f' : '#e74c3c') }}>
                                        {score.toFixed(0)}%
                                    </div>
                                    <div style={{ fontSize: '12px' }}>Approval Rating</div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '14px' }}>
                                <div><strong>🤝 Behavior:</strong> {item.behavior?.dropdown} ({item.behavior?.stars}★)</div>
                                <div><strong>🗣️ Comm:</strong> {item.communication?.dropdown} ({item.communication?.stars}★)</div>
                                <div><strong>🕺 Body Lang:</strong> {item.bodyLanguage?.dropdown} ({item.bodyLanguage?.stars}★)</div>
                                <div><strong>🚀 Hard Work:</strong> {item.hardworking?.dropdown} ({item.hardworking?.stars}★)</div>
                            </div>

                            {item.comment && (
                                <div style={{ background: '#f9f9f9', padding: '10px', borderRadius: '8px', fontSize: '14px' }}>
                                    <strong>💬 Comment:</strong> "{item.comment}"
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
