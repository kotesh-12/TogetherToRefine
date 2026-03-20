import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import anime from 'animejs';
import logo from '../assets/logo.png';

const Leaderboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [leaders, setLeaders] = useState([
        { id: 1, name: 'Arjun_Seeker', xp: 2450, title: 'Grandmaster' },
        { id: 2, name: 'Dharma_Warrior', xp: 2100, title: 'Sage' },
        { id: 3, name: 'Chanakya_Mind', xp: 1850, title: 'Strategist' },
        { id: 4, name: 'Vedic_Coder', xp: 1600, title: 'Scholar' },
        { id: 5, name: 'Kotesh_Fan', xp: 1400, title: 'Aspirant' },
    ]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchLeaders = async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('name, dharma_xp, hero_title')
                    .order('dharma_xp', { ascending: false })
                    .limit(10);
                
                if (data && data.length > 0) {
                    setLeaders(data.map((l, i) => ({
                        id: i + 1,
                        name: l.name || 'Anonymous Seeker',
                        xp: l.dharma_xp || 0,
                        title: l.hero_title || 'Seeker'
                    })));
                }
            } catch (err) {
                console.log("Leaderboard: Using mockup data (Profile table not found)");
            } finally {
                setLoading(false);
            }
        };

        fetchLeaders();

        anime({
            targets: '.leader-row',
            translateX: [-50, 0],
            opacity: [0, 1],
            delay: anime.stagger(100),
            easing: 'easeOutQuad',
            duration: 600
        });
    }, []);

    const userXP = Number(localStorage.getItem('ttr_dharma_xp') || '0');

    return (
        <div className="leaderboard-container" style={{
            minHeight: '100vh',
            background: '#0f0f14',
            color: '#e8e8f0',
            padding: '40px 20px',
            fontFamily: 'Inter, sans-serif'
        }}>
            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <img src={logo} alt="TTRAI" style={{ height: '45px', width: 'auto' }} />
                        <div>
                            <h1 className="header-title" style={{ fontSize: '28px', margin: 0 }}>Dharma Hall</h1>
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Registry of Disciplined Seekers</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => navigate('/')}
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: '#e8e8f0',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            cursor: 'pointer'
                        }}
                    >
                        Back to Work
                    </button>
                </header>

                <div style={{ 
                    padding: '30px', 
                    borderRadius: '20px', 
                    background: 'rgba(30, 30, 40, 0.4)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    marginBottom: '40px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '2px' }}>Current Discipline Level</div>
                    <div style={{ fontSize: '48px', fontWeight: 'bold', color: '#fff' }}>{userXP} XP</div>
                    <div style={{ fontSize: '16px', color: '#64748b' }}>Designation: {userXP > 2000 ? 'Grandmaster' : (userXP > 1000 ? 'Sage' : 'Seeker')}</div>
                    <p style={{ fontSize: '13px', color: '#475569', marginTop: '10px' }}>"Knowledge without discipline is a weight. Carry it with focus."</p>
                </div>

                <div className="leaderboard-card" style={{
                    background: '#16161e',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    <div style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', display: 'grid', gridTemplateColumns: '50px 1fr 100px 120px', fontWeight: 'bold', color: '#94a3b8', fontSize: '14px' }}>
                        <span>Step</span>
                        <span>Seeker</span>
                        <span style={{ textAlign: 'right' }}>Dharma XP</span>
                        <span style={{ textAlign: 'right' }}>Designation</span>
                    </div>

                    {leaders.map((leader, index) => (
                        <div 
                            key={leader.id} 
                            className="leader-row"
                            style={{
                                padding: '20px',
                                display: 'grid',
                                gridTemplateColumns: '50px 1fr 100px 120px',
                                alignItems: 'center',
                                borderTop: '1px solid rgba(255,255,255,0.03)',
                                background: leader.name.includes('Kotesh') ? 'rgba(139, 92, 246, 0.05)' : 'transparent'
                            }}
                        >
                            <span style={{ 
                                fontSize: '18px', 
                                fontWeight: 'bold', 
                                color: index === 0 ? '#fbbf24' : (index === 1 ? '#94a3b8' : (index === 2 ? '#b45309' : '#475569'))
                            }}>{index + 1}</span>
                            <span style={{ fontWeight: '600', color: '#e8e8f0' }}>{leader.name}</span>
                            <span style={{ textAlign: 'right', color: '#60a5fa', fontWeight: 'bold' }}>{leader.xp.toLocaleString()}</span>
                            <span style={{ textAlign: 'right', fontSize: '12px' }}>
                                <span style={{ 
                                    background: 'rgba(255, 255, 255, 0.05)', 
                                    padding: '4px 8px', 
                                    borderRadius: '4px', 
                                    color: '#94a3b8' 
                                }}>
                                    {leader.title}
                                </span>
                            </span>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px', lineHeight: '1.6' }}>
                    <p>Steady progress is the only indicator of true intent. <br/>
                    The hall documents those who maintain consistency in their pursuit.</p>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
