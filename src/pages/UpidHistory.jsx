import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import AnnouncementBar from '../components/AnnouncementBar';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

export default function UpidHistory() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!userData?.uid) return;
            try {
                // Fetch fresh user data to ensure we have the latest history
                const userDoc = await getDoc(doc(db, "users", userData.uid));
                if (userDoc.exists()) {
                    const data = userDoc.data();
                    setHistory(data.upidHistory || []);
                }
            } catch (e) {
                console.error("Error fetching UPID history:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, [userData]);

    return (
        <div className="page-wrapper">
            <AnnouncementBar title="My Private IDs (UPIDs)" leftIcon={false} backPath="/student" />

            <div className="container" style={{ maxWidth: '800px', margin: '20px auto' }}>
                <div className="card" style={{ padding: '25px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div style={{ fontSize: '50px', marginBottom: '10px' }}>🕵️‍♂️</div>
                        <h2 style={{ margin: 0, color: '#2d3436' }}>Anonymous Identity History</h2>
                        <p style={{ color: '#636e72', marginTop: '10px' }}>
                            These are the Private IDs (UPIDs) used for your anonymous feedback submissions.
                            Only you can see this list.
                        </p>
                    </div>

                    {loading ? (
                        <div className="text-center">Loading history...</div>
                    ) : (
                        <>
                            {history.length === 0 ? (
                                <div className="text-center" style={{ padding: '40px', color: '#b2bec3' }}>
                                    <p>No feedback submitted anonymously yet.</p>
                                    <button
                                        className="btn"
                                        onClick={() => navigate('/select-feedback-target')}
                                        style={{ marginTop: '10px', background: '#0984e3' }}
                                    >
                                        Give Feedback Now
                                    </button>
                                </div>
                            ) : (
                                <div className="list-container">
                                    {[...history].reverse().map((item, index) => (
                                        <div key={index} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '15px', borderBottom: '1px solid #eee',
                                            background: '#f8f9fa', borderRadius: '8px', marginBottom: '10px'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#0984e3', fontSize: '1.1rem' }}>
                                                    {item.upid}
                                                </div>
                                                <div style={{ fontSize: '13px', color: '#636e72' }}>
                                                    Target: <strong>{item.target}</strong>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right', fontSize: '12px', color: '#b2bec3' }}>
                                                {item.date && new Date(item.date.seconds * 1000).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
