import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

export default function Admission() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [role, setRole] = useState('student');
    const [extra, setExtra] = useState(''); // Age or Subject
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        const currentUser = auth.currentUser;
        if (!currentUser) {
            alert("You must be logged in to add an admission.");
            setLoading(false);
            return;
        }

        try {
            await addDoc(collection(db, "admissions"), {
                name,
                role,
                [role === 'teacher' ? 'subject' : 'age']: extra,
                status: 'waiting', // Key status for Waiting List
                institutionId: currentUser.uid, // REQUIRED: Limits visibility to this institution
                joinedAt: new Date()
            });
            alert("Admission Successful! Added to Waiting List.");
            navigate('/waiting-list');
        } catch (error) {
            console.error(error);
            alert("Error adding admission.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container" style={{ maxWidth: '500px', marginTop: '50px' }}>
            <div className="card">
                <h2 className="text-center">New Admission</h2>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '15px' }}>
                        <label>Role</label>
                        <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '15px' }}>
                        <label>Name</label>
                        <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Full Name" />
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label>{role === 'teacher' ? 'Subject' : 'Age'}</label>
                        <input className="input-field" value={extra} onChange={(e) => setExtra(e.target.value)} required placeholder={role === 'teacher' ? 'e.g. Math' : 'e.g. 10'} />
                    </div>

                    <button type="submit" className="btn" style={{ width: '100%' }} disabled={loading}>
                        {loading ? 'Processing...' : 'Submit Admission'}
                    </button>

                    <button type="button" className="btn" style={{ width: '100%', marginTop: '10px', backgroundColor: '#95a5a6' }} onClick={() => navigate(-1)}>
                        Cancel
                    </button>
                </form>
            </div>
        </div>
    );
}
