import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AnnouncementBar from '../components/AnnouncementBar';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export default function ProfileView() {
    const navigate = useNavigate();
    const location = useLocation();
    const { userData } = useUser();
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
                    const docRef = doc(db, "users", uid);
                    const docSnap = await getDoc(docRef);

                    if (docSnap.exists()) {
                        const freshData = docSnap.data();
                        // Merge fresh data with existing target data (target might have specific allotment info like Class)
                        setProfileData({ ...target, ...freshData, id: uid, uid: uid });
                    } else {
                        // Fallback to what we have
                        setProfileData({ ...target, uid: uid });
                    }
                } catch (e) {
                    console.error("Error fetching fresh profile:", e);
                    setProfileData({ ...target, uid: uid });
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

    const [feedbackStats, setFeedbackStats] = useState({ received: 0, given: 0, score: 0 });
    const [userPhotos] = useState([
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&q=80",
        "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=400&q=80",
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&q=80"
    ]);

    useEffect(() => {
        if (!profileData?.id) return;

        const fetchStats = async () => {
            try {
                // 1. Fetch Received Feedback
                const qReceived = query(collection(db, "general_feedback"), where("targetId", "==", profileData.id));
                const snapReceived = await getDocs(qReceived);
                const receivedCount = snapReceived.size;

                // 2. Fetch Given Feedback
                const qGiven = query(collection(db, "general_feedback"), where("authorId", "==", profileData.id));
                const snapGiven = await getDocs(qGiven);
                const givenCount = snapGiven.size;

                // 3. Calculate Reputation Score
                // Rule: Positive (+1%), Negative (-0.33%). 
                // Let's assume a Base Score of 50%? Or 0? "show it by percentage with 100% how many they got".
                // If we start at 0, user with 1 positive has 1%. User with 100 has 100%. 
                // If we assume a "Reputation Health" which starts at 100% and drops? No, "increase 1 percentage".

                // Interpretation: Start at 0 (or some base) and climb.
                // Let's start at 0 for now as it seems to be an accumulation metric. Or maybe 50 is neutral.
                // Let's try Base 0, but maybe visually it's filled.

                let rawScore = 0;

                snapReceived.forEach(doc => {
                    const data = doc.data();
                    // Calculate Average Rating for this feedback
                    const cats = ['behavior', 'communication', 'bodyLanguage', 'hardworking'];
                    let sum = 0;
                    let count = 0;
                    cats.forEach(c => {
                        if (data[c]?.stars) { sum += data[c].stars; count++; }
                    });
                    const avg = count > 0 ? sum / count : 0;

                    if (avg >= 4) {
                        rawScore += 1;
                    } else if (avg <= 2.5) { // Threshold for negative
                        rawScore -= 0.33;
                    }
                });

                // Cap logic: 0 to 100
                if (rawScore < 0) rawScore = 0;
                if (rawScore > 100) rawScore = 100;

                setFeedbackStats({
                    received: receivedCount,
                    given: givenCount,
                    score: Math.round(rawScore) // Round for display
                });

            } catch (e) {
                console.error("Error fetching stats:", e);
            }
        };

        fetchStats();
    }, [profileData]);

    // Check if messaging is allowed
    const canMessage = () => {
        if (!userData || !profileData) return false;

        const myRole = userData.role;
        const theirRole = profileData.role || profileData.type?.toLowerCase();

        // Teacher ↔ Parent
        if ((myRole === 'teacher' && theirRole === 'parent') ||
            (myRole === 'parent' && theirRole === 'teacher')) return true;

        // Institution ↔ Parent
        if ((myRole === 'institution' && theirRole === 'parent') ||
            (myRole === 'parent' && theirRole === 'institution')) return true;

        // Institution ↔ Teacher
        if ((myRole === 'institution' && theirRole === 'teacher') ||
            (myRole === 'teacher' && theirRole === 'institution')) return true;

        return false;
    };

    const handleMessage = () => {
        if (!canMessage()) {
            alert("Messaging is only available between:\n• Teachers ↔ Parents\n• Institution ↔ Parents\n• Institution ↔ Teachers");
            return;
        }

        navigate('/messages', {
            state: {
                recipient: {
                    uid: profileData.uid || profileData.id,
                    name: profileData.name || profileData.studentName || profileData.teacherName || profileData.institutionName,
                    role: profileData.role || profileData.type?.toLowerCase()
                }
            }
        });
    };

    if (!profileData) return <div className="container" style={{ textAlign: 'center', marginTop: '50px' }}>Loading...</div>;

    const isInstitution = profileData.type === 'Institution' || profileData.role === 'institution';
    const isTeacher = profileData.type === 'Teacher' || profileData.role === 'teacher';


    return (
        <div className="page-wrapper" style={{ background: 'var(--bg-body)', minHeight: '100vh', color: 'var(--text-main)' }}>
            {/* Custom Header for Profile View */}
            <div style={{
                background: 'linear-gradient(90deg, #6c5ce7, #a29bfe)',
                padding: '12px 20px',
                display: 'flex',
                alignItems: 'center',
                color: 'white',
                position: 'sticky',
                top: 0,
                zIndex: 1100,
                boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'white',
                        fontSize: '24px',
                        cursor: 'pointer',
                        marginRight: '15px',
                        display: 'flex',
                        alignItems: 'center'
                    }}
                >
                    ←
                </button>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>
                    {profileData.name || profileData.studentName || profileData.teacherName || "Profile"}
                </h3>
            </div>

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
                                    {profileData.name || profileData.studentName || profileData.teacherName || profileData.institutionName || '?'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Stats & Info */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <h2 style={{ fontSize: '20px', margin: 0, fontWeight: '600' }}>{profileData.name || profileData.studentName || profileData.teacherName || profileData.institutionName || "Unknown User"}</h2>
                            <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{profileData.type || profileData.role}</span>
                            {isInstitution && <span style={{ fontSize: '12px', color: 'var(--primary)', marginTop: '2px' }}>Verified Institution</span>}
                        </div>

                        {/* Updated Stats Row: Feedback Based */}
                        <div style={{ display: 'flex', gap: '20px', fontSize: '14px', textAlign: 'center' }}>
                            <div>
                                <strong style={{ display: 'block', fontSize: '16px' }}>{feedbackStats.received}</strong>
                                <span style={{ color: 'var(--text-muted)' }}>Received</span>
                            </div>
                            <div>
                                <strong style={{ display: 'block', fontSize: '16px' }}>{feedbackStats.given}</strong>
                                <span style={{ color: 'var(--text-muted)' }}>Given</span>
                            </div>
                            <div>
                                <strong style={{ display: 'block', fontSize: '16px', color: feedbackStats.score > 50 ? '#00b894' : '#fdcb6e' }}>
                                    {feedbackStats.score}%
                                </strong>
                                <span style={{ color: 'var(--text-muted)' }}>Reputation</span>
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
                            onClick={handleMessage}
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
                    {/* Grid of Photos */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                        {userPhotos.map((photoUrl, i) => (
                            <div key={i} style={{
                                aspectRatio: '1/1',
                                background: 'var(--divider)',
                                position: 'relative',
                                cursor: 'pointer',
                                overflow: 'hidden'
                            }}>
                                <img src={photoUrl} alt="Post" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
