import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export default function GeneralFeedback() {
    const navigate = useNavigate();
    const [selectedPerson, setSelectedPerson] = useState('');
    const [ratings, setRatings] = useState({
        behavior: { dropdown: '', stars: 0 },
        communication: { dropdown: '', stars: 0 },
        bodyLanguage: { dropdown: '', stars: 0 },
        hardworking: { dropdown: '', stars: 0 }
    });
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const person = localStorage.getItem('selectedPerson');
        if (person) setSelectedPerson(person);
    }, []);

    const handleDropdown = (category, val) => {
        setRatings(prev => ({ ...prev, [category]: { ...prev[category], dropdown: val } }));
    };

    const handleStars = (category, val) => {
        setRatings(prev => ({ ...prev, [category]: { ...prev[category], stars: val } }));
    };

    const handleSubmit = async () => {
        // Validation
        const r = ratings;
        if (!r.behavior.dropdown || !r.behavior.stars ||
            !r.communication.dropdown || !r.communication.stars ||
            !r.bodyLanguage.dropdown || !r.bodyLanguage.stars ||
            !r.hardworking.dropdown || !r.hardworking.stars) {
            return alert("Please fill all ratings (Stars & Options).");
        }

        setLoading(true);
        try {
            await addDoc(collection(db, "general_feedback"), {
                targetPerson: selectedPerson,
                behavior: r.behavior,
                communication: r.communication,
                bodyLanguage: r.bodyLanguage,
                hardworking: r.hardworking,
                comment,
                timestamp: serverTimestamp()
            });
            alert("Feedback Submitted Successfully!");
            navigate('/student'); // Return home
        } catch (e) {
            console.error(e);
            alert("Error submitting feedback.");
        } finally {
            setLoading(false);
        }
    };

    const categories = [
        { key: 'behavior', label: 'Behavior', icon: '🤝' },
        { key: 'communication', label: 'Communication', icon: '🗣️' },
        { key: 'bodyLanguage', label: 'Body Language', icon: '🕺' },
        { key: 'hardworking', label: 'Hard Working', icon: '🚀' }
    ];

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
            padding: '40px 20px',
            fontFamily: "'Inter', sans-serif"
        }}>
            <button
                onClick={() => navigate(-1)}
                style={{
                    marginBottom: '20px', background: 'rgba(255,255,255,0.2)',
                    border: 'none', color: 'white', padding: '10px 20px',
                    borderRadius: '30px', cursor: 'pointer', backdropFilter: 'blur(10px)',
                    display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold'
                }}
            >
                ⬅ Back
            </button>

            <div style={{
                maxWidth: '650px',
                margin: '0 auto',
                background: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '24px',
                padding: '40px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                position: 'relative',
                overflow: 'hidden'
            }}>
                {/* Decorative background blob */}
                <div style={{
                    position: 'absolute', top: '-50px', right: '-50px',
                    width: '150px', height: '150px', background: '#4facfe',
                    borderRadius: '50%', filter: 'blur(60px)', opacity: '0.4'
                }}></div>

                <div className="text-center" style={{ marginBottom: '40px', position: 'relative' }}>
                    <div style={{ fontSize: '60px', marginBottom: '10px' }}>🌟</div>
                    <h2 style={{
                        background: 'linear-gradient(to right, #00f2fe, #4facfe)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                        margin: '0', fontSize: '28px', fontWeight: '800'
                    }}>
                        Feedback for {selectedPerson || "User"}
                    </h2>
                    <p style={{ color: '#888', marginTop: '5px' }}>Help us improve by rating honestly</p>
                </div>

                <div style={{ display: 'grid', gap: '25px' }}>
                    {categories.map(cat => (
                        <div key={cat.key} style={{
                            background: '#f8f9fa', padding: '20px', borderRadius: '16px',
                            border: '1px solid #cbd5e0', transition: 'transform 0.2s', // Darker border
                            display: 'flex', flexDirection: 'column', gap: '15px',
                            boxShadow: '0 2px 5px rgba(0,0,0,0.05)' // Subtle shadow for depth
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{
                                    fontSize: '30px', background: 'white', width: '60px', height: '60px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0'
                                }}>
                                    {cat.icon}
                                </div>
                                <div>
                                    <label style={{ fontSize: '18px', fontWeight: '700', color: '#2d3748' }}>{cat.label}</label>
                                    <div style={{ fontSize: '12px', color: '#718096' }}>Rate their {cat.label.toLowerCase()}</div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                                <select
                                    style={{
                                        padding: '10px 15px', borderRadius: '12px', border: '1px solid #a0aec0', // Darker border for dropdown
                                        background: 'white', color: '#2d3748', fontWeight: '500', outline: 'none',
                                        minWidth: '140px', cursor: 'pointer'
                                    }}
                                    value={ratings[cat.key].dropdown}
                                    onChange={(e) => handleDropdown(cat.key, e.target.value)}
                                >
                                    <option value="" disabled>Select Rating...</option>
                                    <option>Excellent</option><option>Good</option><option>Average</option><option>Poor</option>
                                </select>

                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <span
                                            key={s}
                                            style={{
                                                fontSize: '28px', cursor: 'pointer',
                                                color: s <= ratings[cat.key].stars ? '#fbbf24' : '#e2e8f0',
                                                transition: 'all 0.2s', transform: s <= ratings[cat.key].stars ? 'scale(1.1)' : 'scale(1)'
                                            }}
                                            onClick={() => handleStars(cat.key, s)}
                                        >★</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '30px' }}>
                    <label style={{ fontWeight: '700', color: '#2d3748', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span>📝</span> Additional Comments
                    </label>
                    <textarea
                        className="input-field"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Share any specific details or suggestions..."
                        style={{
                            height: '100px', resize: 'vertical', borderRadius: '16px',
                            border: '2px solid #edf2f7', padding: '15px', background: '#f8f9fa'
                        }}
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading}
                    style={{
                        width: '100%', padding: '18px', marginTop: '20px',
                        background: 'linear-gradient(to right, #00c6fb, #005bea)',
                        color: 'white', border: 'none', borderRadius: '16px',
                        fontSize: '18px', fontWeight: 'bold', cursor: 'pointer',
                        boxShadow: '0 10px 20px rgba(0, 91, 234, 0.3)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 15px 30px rgba(0, 91, 234, 0.4)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 91, 234, 0.3)'; }}
                >
                    {loading ? '🚀 Sending Feedback...' : '🚀 Submit Feedback'}
                </button>
            </div>
        </div>
    );
}
