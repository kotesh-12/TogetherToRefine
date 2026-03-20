import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

/**
 * KnowledgeGraph: Visualizes user session history as a connected 
 * Mind-Map (Knowledge Tree) using Mermaid.js
 */
export const KnowledgeGraph = ({ sessions }) => {
    const chartRef = useRef(null);
    const [svg, setSvg] = useState('');

    useEffect(() => {
        if (!sessions || sessions.length === 0) return;

        // Construction of Organic Knowledge Tree
        const recent = sessions.slice(0, 8);
        let chartBody = 'mindmap\n  root((Knowledge Nexus))\n';
        
        recent.forEach((s, idx) => {
            const cleanTitle = s.title.replace(/[()]/g, '').substring(0, 25);
            const isFourWay = s.title.startsWith('[');
            
            // Add Main Branch
            chartBody += `    node${idx}["${cleanTitle}"]\n`;
            
            // Add Semantic Sub-Nodes based on title patterns
            if (isFourWay) {
                chartBody += `      topic${idx}_1(Core Theory)\n`;
                chartBody += `      topic${idx}_2(Practical Shift)\n`;
            } else if (cleanTitle.toLowerCase().includes('code') || cleanTitle.toLowerCase().includes('debug')) {
                chartBody += `      topic${idx}_1(Logic Flow)\n`;
                chartBody += `      topic${idx}_2(Architecture)\n`;
            } else {
                chartBody += `      topic${idx}_1(Concept)\n`;
                chartBody += `      topic${idx}_2(Application)\n`;
            }
        });

        const fullChart = chartBody;

        try {
            mermaid.render('nexus-graph', fullChart)
                .then(({ svg }) => setSvg(svg))
                .catch(err => console.error("Nexus Graph Render Error:", err));
        } catch (err) {
            console.error("Nexus Graph Parse Error:", err);
        }
    }, [sessions]);

    return (
        <div style={{
            marginTop: '20px',
            padding: '15px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255,255,255,0.05)',
            maxHeight: '300px',
            overflow: 'auto'
        }}>
            <h4 style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                🧠 Knowledge Evolution
            </h4>
            {svg ? (
                <div dangerouslySetInnerHTML={{ __html: svg }} style={{ width: '100%', minHeight: '150px' }} />
            ) : (
                <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center' }}>Building your Mind Nexus...</p>
            )}
        </div>
    );
};
