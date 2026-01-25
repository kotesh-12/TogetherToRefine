import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AnnouncementBar from '../components/AnnouncementBar';

export default function ProfileView() {
    const navigate = useNavigate();
    const location = useLocation();
    const [profileData, setProfileData] = useState(null);

    useEffect(() => {
        // Resolve profile data from route state or local storage fallback
        const stateTarget = location.state?.target;

        const fetchRealProfile = async (target) => {
            // If the target has a 'userId', 'teacherId', or 'studentId', use that as the Document ID in 'users' collection
            // Otherwise use 'id'
            const uid = target.teacherId || target.studentId || target.userId || target.id;
            console.log("Fetching profile for UID:", uid);

            if (uid) {
                try {
                    const docRef = await import('firebase/firestore').then(mod => mod.doc(db, "users", uid));
                    const docSnap = await import('firebase/firestore').then(mod => mod.getDoc(docRef));

                    if (docSnap.exists()) {
                        const freshData = docSnap.data();
                        // Merge fresh data with existing target data (target might have specific allotment info like Class)
                        setProfileData({ ...target, ...freshData, id: uid });
                    } else {
                        // Fallback to what we have
                        setProfileData(target);
                    }
                } catch (e) {
                    console.error("Error fetching fresh profile:", e);
                    setProfileData(target);
                }
            } else {
                setProfileData(target);
            }
        };

        if (stateTarget) {
            // Optimistic Set
            setProfileData(stateTarget);
            // Async Fetch Fresh
            fetchRealProfile(stateTarget);
        } else {
            // Fallback for direct access
            const selected = localStorage.getItem("selectedPerson");
            setProfileData({
                name: selected || "Unknown User",
                role: "User",
                type: "Student", // default
                initials: (selected || "U").charAt(0)
            });
        }
    }, [location]);

    if (!profileData) return <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

    const isInstitution = profileData.type === 'Institution' || profileData.role === 'institution';
    const isTeacher = profileData.type === 'Teacher' || profileData.role === 'teacher';

    return (
        <div className="page-wrapper" style={{ background: 'var(--bg-body)', minHeight: '100vh', color: 'var(--text-main)' }}>
            <AnnouncementBar title={profileData.name || "Profile"} leftIcon="back" />

            <div className="container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>

                {/* Profile Header (Instagram Style) */}
                <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '30px' }}>
                    {/* Avatar */}
                    <div style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', // Instagram-ish gradient border
                        padding: '3px',
                        flexShrink: 0
                    }}>
                        <div style={{
                            width: '100%', height: '100%', borderRadius: '50%',
                            background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            overflow: 'hidden', border: '2px solid var(--bg-body)'
                        }}>
                            {profileData.profileImageURL ? (
                                <img src={profileData.profileImageURL} alt={profileData.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <span style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                    {profileData.name ? profileData.name.charAt(0).toUpperCase() : '?'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats & Info */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ fontSize: '20px', margin: 0, fontWeight: '600' }}>{profileData.name}</h2>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{profileData.type || profileData.role}</span>
                            {isInstitution && <span style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '2px' }}>Verified Institution</span>}
                        </div>

                        {/* Follower Stats Row (Visual Only for now) */}
                        <div style={{ display: 'flex', gap: '20px', fontSize: '14px', textAlign: 'center' }}>
                            <div>
                                <strong style={{ display: 'block', fontSize: '16px' }}>{Math.floor(Math.random() * 20) + 1}</strong>
                                <span style={{ color: 'var(--text-muted)' }}>Posts</span>
                            </div>
                            <div>
                                <strong style={{ display: 'block', fontSize: '16px' }}>{Math.floor(Math.random() * 500) + 100}</strong>
                                <span style={{ color: 'var(--text-muted)' }}>{isInstitution ? 'Students' : 'Connections'}</span>
                            </div>
                            <div>
                                <strong style={{ display: 'block', fontSize: '16px' }}>{Math.floor(Math.random() * 50) + 10}</strong>
                                <span style={{ color: 'var(--text-muted)' }}>Following</span>
                            </div>
                        </div>

                        {/* Bio */}
                        <div style={{ fontSize: '14px', marginTop: '5px' }}>
                            {profileData.bio || (
                                isInstitution ? "Welcome to our official platform profile." :
                                    isTeacher ? `Teacher at ${profileData.institutionId || 'Local School'}` :
                                        "Student • Learning & Growing"
                            )}
                        </div>
                    </div>
                </div>

                {/* Actions Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
                    <button
                        onClick={() => navigate('/general-feedback', { state: { target: profileData } })}
                        className="btn"
                        style={{ width: '100%', background: 'var(--primary)', color: 'white', fontWeight: '600' }}
                    >
                        Give Feedback
                    </button>
                    {!isInstitution && (
                        <button
                            className="btn"
                            style={{ width: '100%', background: 'var(--bg-surface)', color: 'var(--text-main)', border: '1px solid var(--divider)' }}
                            onClick={() => alert("Message feature coming soon!")}
                        >
                            Message
                        </button>
                    )}
                </div>

                {/* Posts/Content Tab */}
                <div style={{ borderTop: '1px solid var(--divider)', marginTop: '10px', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '20px', borderBottom: '1px solid transparent' }}>
                        <div style={{ borderTop: '1px solid var(--text-main)', paddingTop: '10px', fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', cursor: 'pointer' }}>POSTS</div>
                        <div style={{ paddingTop: '10px', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '1px', cursor: 'pointer' }}>ABOUT</div>
                    </div>

                    {/* Grid of Empty Posts (Placeholder) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} style={{
                                aspectRatio: '1/1',
                                background: 'var(--divider)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '24px',
                                color: 'var(--bg-surface)',
                                cursor: 'pointer'
                            }}>
                                📷
                            </div>
                        ))}
                    </div>
                </div>

                {/* Reporting Zone Footer */}
                <div style={{ marginTop: '40px', padding: '20px', background: 'var(--bg-surface)', borderRadius: '10px', border: '1px solid var(--divider)' }}>
                    <h4 style={{ margin: '0 0 10px 0', color: 'var(--error)' }}>Report User</h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '15px' }}>
                        If this user is violating community guidelines, please report them immediately.
                    </p>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <button onClick={() => navigate('/report-misbehavior')} style={{ flex: 1, padding: '8px', background: 'var(--secondary)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                            Report Misbehavior
                        </button>
                        <button onClick={() => navigate('/report-harassment')} style={{ flex: 1, padding: '8px', background: 'var(--secondary)', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                            Report Harassment
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
