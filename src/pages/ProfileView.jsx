import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ProfileView() {
    const navigate = useNavigate();
    const [personName, setPersonName] = useState("");
    const [role, setRole] = useState("Teacher"); // Defaulting to teacher as per student view
    const [showBreakdown, setShowBreakdown] = useState(false);

    useEffect(() => {
        const selected = localStorage.getItem("selectedPerson");
        if (selected) {
            setPersonName(selected);
        } else {
            setPersonName("Unknown Person");
        }
    }, []);

    return (
        <div className="container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '20px' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                    Back
                </button>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                        <h2>{personName}</h2>
                        <h4 style={{ color: '#666' }}>{role}</h4>

                        <div style={{ marginTop: '20px' }}>
                            <p><strong>Qualification:</strong> M.Sc. Physics (Demo)</p>
                            <p><strong>Experience:</strong> 8 Years (Demo)</p>

                            <p style={{ marginTop: '10px' }}><strong>Overall Rating:</strong></p>
                            <div style={{ background: '#eee', borderRadius: '10px', height: '20px', width: '100%', maxWidth: '300px' }}>
                                <div style={{ width: '92%', background: '#27ae60', height: '100%', borderRadius: '10px', color: 'white', fontSize: '12px', textAlign: 'center' }}>92%</div>
                            </div>
                        </div>

                        <p
                            style={{ color: '#0984e3', textDecoration: 'underline', cursor: 'pointer', marginTop: '10px' }}
                            onClick={() => setShowBreakdown(!showBreakdown)}
                        >
                            {showBreakdown ? "Hide Breakdown" : "View Details"}
                        </p>

                        {showBreakdown && (
                            <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
                                <ul style={{ listStyle: 'none', padding: 0 }}>
                                    <li>Behavior: 93%</li>
                                    <li>Communication: 91%</li>
                                    <li>Body Language: 90%</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '200px' }}>
                        <img src="https://via.placeholder.com/240x300" alt="Profile" style={{ borderRadius: '8px', border: '1px solid #ddd', marginBottom: '15px' }} />
                        <button className="btn" style={{ width: '100%' }} onClick={() => navigate('/general-feedback')}>Give Feedback</button>
                        <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '20px' }}>
                            <p style={{ color: '#aaa', fontSize: '14px' }}>Reporting Zone</p>
                            <button onClick={() => navigate('/report-misbehavior')} style={{ width: '100%', padding: '10px', marginTop: '10px', background: '#f39c12', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                ⚠️ Report Misbehavior
                            </button>
                            <button onClick={() => navigate('/report-harassment')} style={{ width: '100%', padding: '10px', marginTop: '10px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>
                                🚨 Report Sexual Harassment
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
