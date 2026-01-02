import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useUser } from '../context/UserContext';

export default function Profile() {
    const navigate = useNavigate();
    const { user, userData, setUserData } = useUser(); // Consuming global state

    // If we have context data, use it. If not (e.g. direct link load), it might be null initially 
    // but the Provider handles the loading state usually.
    const [isEditing, setIsEditing] = useState(false);
    const [editData, setEditData] = useState({});

    // When we enter edit mode, populate fields
    useEffect(() => {
        if (userData) {
            setEditData(userData);
        }
    }, [userData, isEditing]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/');
    };

    const handleChange = (e) => {
        setEditData({ ...editData, [e.target.name]: e.target.value });
    };

    const handleSave = async () => {
        if (!userData || !userData.collection) return;

        try {
            const docRef = doc(db, userData.collection, user.uid);
            await updateDoc(docRef, editData);

            // Context update (Instant UI reflection)
            setUserData({ ...userData, ...editData });

            setIsEditing(false);
            alert("Profile updated successfully!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile.");
        }
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Limit size to 100KB for Firestore Base64 safety
        if (file.size > 100 * 1024) {
            alert("Image too large! Please choose an image under 100KB.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            try {
                // Save to Firestore
                const docRef = doc(db, userData.collection, user.uid);
                await updateDoc(docRef, { profileImageURL: base64String });

                // Update local state
                setUserData({ ...userData, profileImageURL: base64String });
                alert("Profile Photo Updated!");
            } catch (err) {
                console.error(err);
                alert("Failed to save photo.");
            }
        };
        reader.readAsDataURL(file);
    };

    // If data is still loading from context (very first load), the UserProvider might hold back rendering children,
    // so here we might just see null briefly if logic differs, but generally it's safe.
    if (!userData) return <div className="container">Loading Profile...</div>;

    return (
        <div className="container" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <div className="card" style={{ textAlign: 'center', position: 'relative' }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ position: 'absolute', left: '20px', top: '20px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
                >
                    ⬅
                </button>

                <div style={{ position: 'relative', display: 'inline-block', margin: '20px auto' }}>
                    <img
                        src={userData.profileImageURL || "https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png"}
                        alt="Profile"
                        style={{
                            width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover',
                            border: '4px solid white', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
                        }}
                    />
                    <label htmlFor="photo-upload" style={{
                        position: 'absolute', bottom: '0', right: '0',
                        backgroundColor: '#2d3436', color: 'white',
                        padding: '8px', borderRadius: '50%', cursor: 'pointer',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
                    }} title="Change Photo">
                        📷
                    </label>
                    <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handlePhotoChange}
                    />
                </div>

                <h2>{userData.name || userData.schoolName || "User"}</h2>
                <p style={{ color: '#666', textTransform: 'capitalize' }}>{userData.role}</p>
                {userData.institutionName && <p style={{ color: '#888', fontSize: '14px' }}>🏫 {userData.institutionName}</p>}

                {/* Progress Bar Placeholder */}
                <div style={{ background: '#eee', borderRadius: '10px', height: '20px', margin: '20px 0', overflow: 'hidden' }}>
                    <div style={{
                        width: `${userData.feedbackPercentage || 0}%`,
                        background: '#00b894', height: '100%',
                        color: 'white', fontSize: '12px', lineHeight: '20px'
                    }}>
                        {userData.feedbackPercentage || 0}%
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
                    <button className="btn" style={{ backgroundColor: '#0984e3' }} onClick={() => setIsEditing(true)}>✏️ Edit Profile</button>
                    <button className="btn" style={{ backgroundColor: '#d63031' }} onClick={handleLogout}>🚪 Logout</button>
                </div>
            </div>

            {/* Edit Modal */}
            {isEditing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px', position: 'relative' }}>
                        <h3>Edit Profile</h3>

                        <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>
                            {userData.role === 'institution' ? "School Name" : "Name"}
                        </label>
                        <input
                            name="name"
                            value={editData.name || ""}
                            onChange={handleChange}
                            className="input-field"
                        />

                        {userData.role === 'student' && (
                            <>
                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Class</label>
                                <input name="class" value={editData.class || ""} onChange={handleChange} className="input-field" />

                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Age</label>
                                <input name="age" type="number" value={editData.age || ""} onChange={handleChange} className="input-field" />

                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Institution Name</label>
                                <input name="institutionName" value={editData.institutionName || ""} onChange={handleChange} className="input-field" placeholder="Enter School/College Name" />
                            </>
                        )}

                        {userData.role === 'teacher' && (
                            <>
                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Subject</label>
                                <input name="subject" value={editData.subject || ""} onChange={handleChange} className="input-field" />

                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Institution Name</label>
                                <input name="institutionName" value={editData.institutionName || ""} onChange={handleChange} className="input-field" placeholder="Enter School/College Name" />
                            </>
                        )}

                        {userData.role === 'institution' && (
                            <>
                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Principal Name</label>
                                <input name="principalName" value={editData.principalName || ""} onChange={handleChange} className="input-field" />

                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Address</label>
                                <textarea name="address" value={editData.address || ""} onChange={handleChange} className="input-field" style={{ resize: 'none', height: '60px' }} />

                                <label style={{ display: 'block', textAlign: 'left', marginTop: '10px' }}>Contact Phone</label>
                                <input name="phone" type="tel" value={editData.phone || ""} onChange={handleChange} className="input-field" />
                            </>
                        )}

                        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                            <button className="btn" onClick={handleSave}>💾 Save</button>
                            <button className="btn" style={{ backgroundColor: '#aaa' }} onClick={() => setIsEditing(false)}>❌ Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
