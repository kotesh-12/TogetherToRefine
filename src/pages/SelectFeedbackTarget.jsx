import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useUser } from '../context/UserContext';
import AIBadge from '../components/AIBadge';
import AnnouncementBar from '../components/AnnouncementBar';

export default function SelectFeedbackTarget() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("Select Person");

    // Teacher Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('name'); // 'name', 'class', 'section'

    useEffect(() => {
        const fetchData = async () => {
            if (!userData) return;

            const role = userData.role;
            let list = [];

            try {
                if (role === 'student') {
                    setTitle("Select Teacher for Feedback");
                    const userClass = userData.class || userData.assignedClass;
                    const userSection = userData.section || userData.assignedSection;

                    if (userClass) {
                        const q = query(
                            collection(db, "teacher_allotments"),
                            where("classAssigned", "==", userClass),
                            where("section", "==", userSection)
                        );
                        const snap = await getDocs(q);
                        list = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'Teacher' }));
                    }
                }
                else if (role === 'teacher') {
                    setTitle("Select Student for Feedback");
                    const myClass = userData.assignedClass;
                    const mySection = userData.assignedSection;

                    if (myClass) {
                        const q = query(
                            collection(db, "student_allotments"),
                            where("classAssigned", "==", myClass),
                            where("section", "==", mySection)
                        );
                        const snap = await getDocs(q);
                        list = snap.docs.map(d => ({ id: d.id, ...d.data(), type: 'Student' }));
                    }
                }

                setTargets(list);
            } catch (e) {
                console.error("Error fetching targets:", e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userData]);

    const handleSelect = (person) => {
        const label = person.type === 'Teacher'
            ? `${person.name} (${person.subject})`
            : `${person.name} (${person.classAssigned}-${person.section})`;

        localStorage.setItem("selectedPerson", label);
        navigate('/general-feedback');
    };

    // Filter & Sort Logic
    const filteredTargets = targets
        .filter(t => {
            if (userData?.role === 'teacher') {
                return t.name.toLowerCase().includes(searchTerm.toLowerCase());
            }
            return true; // No search for students (as per instructions "don't change anything in student role", though search is harmless)
        })
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'class') return (a.classAssigned || '').localeCompare(b.classAssigned || '');
            if (sortBy === 'section') return (a.section || '').localeCompare(b.section || '');
            return 0;
        });

    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar title={title} leftIcon="back" />

            <div className="container" style={{ maxWidth: '600px', margin: '20px auto' }}>
                <p className="text-center text-muted" style={{ marginBottom: '20px' }}>
                    Who do you want to give feedback to?
                </p>

                {/* Teacher Controls: Search & Sort */}
                {userData?.role === 'teacher' && (
                    <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <input
                            className="input-field"
                            placeholder="🔍 Search Student..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ flex: 1, margin: 0 }}
                        />
                        <select
                            className="input-field"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            style={{ width: '120px', margin: 0 }}
                        >
                            <option value="name">A-Z Name</option>
                            <option value="class">By Class</option>
                            <option value="section">By Section</option>
                        </select>
                    </div>
                )}

                {loading ? (
                    <div className="text-center">Loading List...</div>
                ) : (
                    <div style={{ display: 'grid', gap: '15px' }}>
                        {filteredTargets.length === 0 ? (
                            <div className="card text-center text-muted">
                                {userData?.role === 'teacher'
                                    ? "No students found matching criteria."
                                    : "No teachers found for your class yet."}
                            </div>
                        ) : (
                            filteredTargets.map(t => (
                                <div
                                    key={t.id}
                                    onClick={() => handleSelect(t)}
                                    className="card"
                                    style={{
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        transition: 'transform 0.2s',
                                        border: '1px solid #dfe6e9'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{
                                            width: '50px', height: '50px',
                                            borderRadius: '50%',
                                            background: '#0984e3', color: 'white',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '20px', fontWeight: 'bold'
                                        }}>
                                            {t.name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 style={{ margin: 0, color: '#2d3436' }}>{t.name}</h4>
                                            <p style={{ margin: 0, fontSize: '13px', color: '#636e72' }}>
                                                {t.type === 'Teacher' ? t.subject : `Student • ${t.classAssigned}-${t.section}`}
                                            </p>
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '20px' }}>📝</span>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
