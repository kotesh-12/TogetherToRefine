import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, deleteDoc, updateDoc, doc, orderBy } from 'firebase/firestore'; // Added updateDoc
import AnnouncementBar from '../components/AnnouncementBar';
import AIBadge from '../components/AIBadge';
import { useUser } from '../context/UserContext';
import ReactPlayer from 'react-player'; // Using standard import for better compatibility

// Helper to extract ID
const getYouTubeID = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

export default function VideoLibrary() {
    const { userData } = useUser();
    const role = userData?.role;

    // State
    const [videos, setVideos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Editing State
    const [editingId, setEditingId] = useState(null); // ID of video being edited
    const [editTitle, setEditTitle] = useState('');

    // Add Video State (Teachers/Institution)
    const [showAdd, setShowAdd] = useState(false);
    const [newVideo, setNewVideo] = useState({ title: '', url: '', subject: 'General', targetClass: '' });

    // Filter State (Students & Teachers)
    const [filterSubject, setFilterSubject] = useState('All');
    const [filterClass, setFilterClass] = useState(''); // Teacher/Inst Filter

    useEffect(() => {
        if (userData) fetchVideos();
    }, [userData, filterSubject, filterClass]);

    const fetchVideos = async () => {
        setLoading(true);
        try {
            let q;
            const videoRef = collection(db, "videos");

            // Build variants for students
            let variants = [];
            if (role === 'student') {
                const rawClass = userData.class || userData.assignedClass || '';
                const section = userData.section || userData.assignedSection || 'A';

                if (!rawClass) {
                    setVideos([]);
                    return;
                }

                variants.push(`${rawClass}-${section}`);
                const normalizedClass = rawClass.toString().replace(/(\d+)(st|nd|rd|th)/i, '$1');
                if (normalizedClass !== rawClass.toString()) {
                    variants.push(`${normalizedClass}-${section}`);
                }
            }

            // SECURE FETCH: explicitly specify your institutionId for the strict rule, no orderby/where combo.
            const instId = role === 'institution' ? userData.uid : userData.institutionId;
            q = query(videoRef, where("institutionId", "==", instId));

            const snapshot = await getDocs(q);
            let list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

            // Filter locally to avoid FAILED_PRECONDITION indexing errors
            if (role === 'student') {
                list = list.filter(v => variants.includes(v.targetClass));
                if (filterSubject !== 'All') {
                    list = list.filter(v => v.subject === filterSubject);
                }
            } else {
                if (filterClass && filterClass !== 'All') {
                    list = list.filter(v => v.targetClass === filterClass);
                }
            }

            // Client-side sort by date descending (safe array sort)
            list.sort((a, b) => {
                const tA = a.timestamp?.seconds || 0;
                const tB = b.timestamp?.seconds || 0;
                return tB - tA;
            });

            setVideos(list);
        } catch (e) {
            console.error("Fetch Videos Error:", e);
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
                institutionId: userData.institutionId, // Track Institution
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
            alert("Error deleting: " + e.message);
        }
    };

    const startEditing = (video) => {
        setEditingId(video.id);
        setEditTitle(video.title);
    };

    const handleUpdate = async (id) => {
        if (!editTitle.trim()) return alert("Title cannot be empty");
        try {
            await updateDoc(doc(db, "videos", id), {
                title: editTitle
            });

            // Update local state
            setVideos(prev => prev.map(v => v.id === id ? { ...v, title: editTitle } : v));
            setEditingId(null);
            setEditTitle('');
        } catch (e) {
            console.error(e);
            alert("Error updating: " + e.message);
        }
    };

    // Render Logic
    return (
        <div className="page-wrapper">
            <AIBadge />


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
                        <>
                            <select
                                className="input-field"
                                style={{ maxWidth: '200px', margin: 0 }}
                                value={filterClass}
                                onChange={(e) => setFilterClass(e.target.value)}
                            >
                                <option value="All">All Classes</option>
                                {['Nursery-A', 'LKG-A', 'UKG-A', '1-A', '2-A', '3-A', '4-A', '5-A', '6-A', '7-A', '8-A', '9-A', '10-A', '10-B'].map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                            <button className="btn" onClick={() => setShowAdd(true)}>+ Add New Video</button>
                        </>
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

                    {videos.map(video => {
                        // Permission Check
                        // 1. Institution: Can manage ALL videos
                        // 2. Teacher: Can manage ONLY their own videos
                        const canManage = role === 'institution' || (role === 'teacher' && video.createdBy === userData?.uid);
                        const isEditing = editingId === video.id;

                        return (
                            <div key={video.id} className="card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                                {/* Native Iframe */}
                                <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
                                    {getYouTubeID(video.url) ? (
                                        <iframe
                                            src={`https://www.youtube.com/embed/${getYouTubeID(video.url)}?rel=0&modestbranding=1`}
                                            title={video.title}
                                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                            Invalid Video URL
                                        </div>
                                    )}
                                </div>

                                {/* Info */}
                                <div style={{ padding: '15px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                        {isEditing ? (
                                            <div style={{ flex: 1, marginRight: '10px' }}>
                                                <input
                                                    value={editTitle}
                                                    onChange={(e) => setEditTitle(e.target.value)}
                                                    className="input-field"
                                                    style={{ marginBottom: '5px', padding: '5px' }}
                                                    autoFocus
                                                />
                                                <div style={{ display: 'flex', gap: '5px' }}>
                                                    <button className="btn" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleUpdate(video.id)}>Save</button>
                                                    <button className="btn-outline" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => setEditingId(null)}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <h4 style={{ margin: 0, color: '#2d3436', fontSize: '16px', lineHeight: '1.4' }}>{video.title}</h4>
                                        )}

                                        {/* Action Buttons */}
                                        {canManage && !isEditing && (
                                            <div style={{ display: 'flex', gap: '5px' }}>
                                                <button
                                                    onClick={() => startEditing(video)}
                                                    style={{ background: 'none', border: 'none', color: '#0984e3', cursor: 'pointer', fontSize: '16px' }}
                                                    title="Modify Title"
                                                >✏️</button>
                                                <button
                                                    onClick={() => handleDelete(video.id)}
                                                    style={{ background: 'none', border: 'none', color: '#ff7675', cursor: 'pointer', fontSize: '16px' }}
                                                    title="Delete Video"
                                                >🗑️</button>
                                            </div>
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
                                            By: {video.authorName} | Target: {video.targetClass}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
