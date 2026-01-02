import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useUser } from '../context/UserContext';
import ReactPlayer from 'react-player'; // Using standard import for better compatibility

export default function VideoLibrary() {
    const { userData } = useUser();
    const role = userData?.role;

    // State
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Add Video State (Teachers/Institution)
    const [showAdd, setShowAdd] = useState(false);
    const [newVideo, setNewVideo] = useState({ title: '', url: '', subject: 'General', targetClass: '' });

    // Filter State (Students)
    const [filterSubject, setFilterSubject] = useState('All');

    useEffect(() => {
        if (userData) fetchVideos();
    }, [userData, filterSubject]);

    const fetchVideos = async () => {
        setLoading(true);
        try {
            let q;
            const videoRef = collection(db, "videos");

            if (role === 'student') {
                // Students see videos for their class (or 'All')
                // Firestore OR queries are tricky. For now, fetch matching class.
                const userClass = userData.class || userData.assignedClass;
                if (!userClass) {
                    setVideos([]);
                    return;
                }
                // Order by date desc
                q = query(videoRef, where("targetClass", "==", userClass));
                // Note: We can't easily complex sort with where filter without index.
                // Let's optimize: fetch all for class, sort client side.
            } else {
                // Teachers/Institution see all (or filtered by what they uploaded? Let's show all for simplicity)
                q = query(videoRef, orderBy("timestamp", "desc"));
            }

            const snapshot = await getDocs(q);
            let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Student Filter: Subject
            if (role === 'student' && filterSubject !== 'All') {
                list = list.filter(v => v.subject === filterSubject);
            }

            // Client-side sort by date descending (since we didn't add compound index for student query)
            list.sort((a, b) => b.timestamp - a.timestamp);

            setVideos(list);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddVideo = async () => {
        if (!newVideo.title || !newVideo.url || !newVideo.targetClass) {
            alert("Please fill all fields!");
            return;
        }

        // ReactPlayer handles validation well, but basic check:
        if (!ReactPlayer.canPlay(newVideo.url)) {
            alert("Invalid Video URL. Please verify.");
            return;
        }

        try {
            await addDoc(collection(db, "videos"), {
                ...newVideo,
                url: newVideo.url, // Save original URL, ReactPlayer handles the rest
                createdBy: userData.uid,
                authorName: userData.name,
                timestamp: new Date()
            });
            setShowAdd(false);
            setNewVideo({ title: '', url: '', subject: 'General', targetClass: '' });
            fetchVideos();
            alert("Video Added Successfully! 🎥");
        } catch (e) {
            console.error(e);
            alert("Error adding video");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Delete this video?")) return;
        try {
            await deleteDoc(doc(db, "videos", id));
            setVideos(prev => prev.filter(v => v.id !== id));
        } catch (e) {
            console.error(e);
        }
    };

    // Render Logic
    return (
        <div className="page-wrapper">
            <AIBadge />
            <AnnouncementBar title="Video Library 🎬" leftIcon="back" />

            <div className="container" style={{ maxWidth: '1000px', margin: '20px auto' }}>

                {/* Controls Area */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                    {role === 'student' && (
                        <select
                            className="input-field"
                            style={{ maxWidth: '200px', margin: 0 }}
                            value={filterSubject}
                            onChange={(e) => setFilterSubject(e.target.value)}
                        >
                            <option value="All">All Subjects</option>
                            <option value="Mathematics">Mathematics</option>
                            <option value="Science">Science (PS/NS)</option>
                            <option value="Social Studies">Social Studies</option>
                            <option value="English">English</option>
                            <option value="Telugu">Telugu</option>
                            <option value="Hindi">Hindi</option>
                        </select>
                    )}

                    {(role === 'teacher' || role === 'institution') && (
                        <button className="btn" onClick={() => setShowAdd(true)}>+ Add New Video</button>
                    )}
                </div>

                {/* Add Video Modal (Inline) */}
                {showAdd && (
                    <div className="card" style={{ marginBottom: '20px', border: '2px solid #6c5ce7', background: '#f8f9fa' }}>
                        <h3>Upload New Video</h3>
                        <p className="text-muted" style={{ fontSize: '13px' }}>Upload your video to YouTube (Unlisted/Public) and paste the link here.</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                            <input className="input-field" placeholder="Video Title" value={newVideo.title} onChange={e => setNewVideo({ ...newVideo, title: e.target.value })} />
                            <input className="input-field" placeholder="YouTube URL (e.g. https://youtu.be/...)" value={newVideo.url} onChange={e => setNewVideo({ ...newVideo, url: e.target.value })} />

                            <select className="input-field" value={newVideo.targetClass} onChange={e => setNewVideo({ ...newVideo, targetClass: e.target.value })}>
                                <option value="">Select Target Class</option>
                                {['Nursery-A', 'LKG-A', 'UKG-A', '1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A', '10-B'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>

                            <select className="input-field" value={newVideo.subject} onChange={e => setNewVideo({ ...newVideo, subject: e.target.value })}>
                                <option value="General">General</option>
                                <option value="Mathematics">Mathematics</option>
                                <option value="Science">Science</option>
                                <option value="Social Studies">Social Studies</option>
                                <option value="English">English</option>
                                <option value="Telugu">Telugu</option>
                                <option value="Hindi">Hindi</option>
                            </select>
                        </div>

                        <div style={{ marginTop: '15px', textAlign: 'right' }}>
                            <button className="btn-outline" onClick={() => setShowAdd(false)} style={{ marginRight: '10px' }}>Cancel</button>
                            <button className="btn" onClick={handleAddVideo}>Post Video</button>
                        </div>
                    </div>
                )}

                {/* Video Grid */}
                {loading && <p className="text-center">Loading Library...</p>}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '25px' }}>
                    {!loading && videos.length === 0 && (
                        <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#888', padding: '40px' }}>
                            No videos found for this selection.
                        </div>
                    )}

                    {videos.map(video => (
                        <div key={video.id} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                            {/* Video Player Wrapper */}
                            <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
                                <ReactPlayer
                                    url={video.url}
                                    width='100%'
                                    height='100%'
                                    style={{ position: 'absolute', top: 0, left: 0 }}
                                    controls={true}
                                    light={false} // Load proper player
                                />
                            </div>

                            {/* Info */}
                            <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                    <h4 style={{ margin: 0, color: '#2d3436', fontSize: '16px', lineHeight: '1.4' }}>{video.title}</h4>
                                    {(role === 'teacher' || role === 'institution') && (
                                        <button
                                            onClick={() => handleDelete(video.id)}
                                            style={{ background: 'none', border: 'none', color: '#ff7675', cursor: 'pointer', fontSize: '16px', marginLeft: '10px' }}
                                            title="Delete Video"
                                        >🗑️</button>
                                    )}
                                </div>
                                <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#636e72' }}>
                                    <span style={{
                                        background: '#dfe6e9',
                                        padding: '4px 8px',
                                        borderRadius: '4px',
                                        fontWeight: '600',
                                        color: '#2d3436'
                                    }}>
                                        {video.subject}
                                    </span>
                                    <span>{video.timestamp?.seconds ? new Date(video.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</span>
                                </div>
                                {(role === 'teacher' || role === 'institution') && (
                                    <div style={{ fontSize: '11px', color: '#b2bec3', marginTop: '8px', textAlign: 'right' }}>
                                        Target: {video.targetClass}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
