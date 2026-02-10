import React from 'react';

export default function TimetableAIModal({
    show,
    onClose,
    aiConfig,
    setAiConfig,
    availableTeachers,
    onGenerate
}) {
    if (!show) return null;

    const allSubjects = [
        'Telugu', 'Hindi', 'English', 'Maths', 'Physics', 'Chemistry',
        'Biology', 'Social Studies', 'EVS', 'Sanskrit', 'Computer Class',
        'PT', 'Yoga', 'Science Lab', 'Biology Lab', 'English Lab'
    ];

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 9999, padding: '20px'
        }}>
            <div style={{
                background: 'white', borderRadius: '16px', maxWidth: '700px',
                width: '100%', maxHeight: '90vh', overflow: 'auto', padding: '30px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2 style={{ margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        🤖 AI Timetable Configuration
                    </h2>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', fontSize: '24px',
                        cursor: 'pointer', color: '#999'
                    }}>×</button>
                </div>

                <p style={{ color: '#666', marginBottom: '25px' }}>
                    Configure your timetable preferences. The AI will generate an optimized schedule avoiding teacher conflicts.
                </p>

                {/* Subjects Selection */}
                <div style={{ marginBottom: '25px' }}>
                    <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#2d3436' }}>
                        📚 Select Subjects for this Class:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '10px' }}>
                        {allSubjects.map(subject => (
                            <label key={subject} style={{
                                display: 'flex', alignItems: 'center', padding: '8px 12px',
                                background: aiConfig.subjects.includes(subject) ? '#e8f5e9' : '#f5f5f5',
                                borderRadius: '8px', cursor: 'pointer',
                                border: aiConfig.subjects.includes(subject) ? '2px solid #4caf50' : '2px solid transparent'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={aiConfig.subjects.includes(subject)}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setAiConfig(prev => ({ ...prev, subjects: [...prev.subjects, subject] }));
                                        } else {
                                            setAiConfig(prev => ({
                                                ...prev,
                                                subjects: prev.subjects.filter(s => s !== subject),
                                                teacherAssignments: { ...prev.teacherAssignments, [subject]: undefined }
                                            }));
                                        }
                                    }}
                                    style={{ marginRight: '8px' }}
                                />
                                <span style={{ fontSize: '13px' }}>{subject}</span>
                            </label>
                        ))}
                    </div>
                </div>

                {/* Teacher Assignments */}
                {aiConfig.subjects.length > 0 && (
                    <div style={{ marginBottom: '25px' }}>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#2d3436' }}>
                            👨‍🏫 Assign Teachers to Subjects:
                        </label>
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {aiConfig.subjects.map(subject => (
                                <div key={subject} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ minWidth: '140px', fontSize: '14px', fontWeight: '500' }}>{subject}:</span>
                                    <select
                                        value={aiConfig.teacherAssignments[subject] || ''}
                                        onChange={(e) => setAiConfig(prev => ({
                                            ...prev,
                                            teacherAssignments: { ...prev.teacherAssignments, [subject]: e.target.value }
                                        }))}
                                        style={{
                                            flex: 1, padding: '8px 12px', borderRadius: '6px',
                                            border: '1px solid #ddd', fontSize: '14px'
                                        }}
                                    >
                                        <option value="">-- Select Teacher --</option>
                                        {availableTeachers.map(teacher => (
                                            <option key={teacher.id} value={teacher.id}>
                                                {teacher.name} ({teacher.subject})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Periods and Lunch Break */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '25px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2d3436' }}>
                            ⏰ Periods per Day:
                        </label>
                        <input
                            type="number"
                            min="4"
                            max="10"
                            value={aiConfig.periodsPerDay}
                            onChange={(e) => setAiConfig(prev => ({ ...prev, periodsPerDay: parseInt(e.target.value) || 7 }))}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '6px',
                                border: '1px solid #ddd', fontSize: '14px'
                            }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', color: '#2d3436' }}>
                            🍽️ Lunch Break After Period:
                        </label>
                        <select
                            value={aiConfig.lunchBreakAfterPeriod}
                            onChange={(e) => setAiConfig(prev => ({ ...prev, lunchBreakAfterPeriod: parseInt(e.target.value) }))}
                            style={{
                                width: '100%', padding: '10px', borderRadius: '6px',
                                border: '1px solid #ddd', fontSize: '14px'
                            }}
                        >
                            {Array.from({ length: aiConfig.periodsPerDay - 1 }, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>After Period {num}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px', borderRadius: '8px', border: '1px solid #ddd',
                            background: 'white', cursor: 'pointer', fontWeight: 'bold'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onGenerate}
                        disabled={aiConfig.subjects.length === 0}
                        style={{
                            padding: '10px 30px', borderRadius: '8px', border: 'none',
                            background: aiConfig.subjects.length === 0 ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white', cursor: aiConfig.subjects.length === 0 ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
                        }}
                    >
                        🤖 Generate Timetable
                    </button>
                </div>
            </div>
        </div>
    );
}
