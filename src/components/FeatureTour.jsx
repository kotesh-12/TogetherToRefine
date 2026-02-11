import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function FeatureTour({ tourId, steps, userData }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [isVisible, setIsVisible] = useState(false);
    const [rect, setRect] = useState(null);

    // Check if tour is already completed from Firestore
    useEffect(() => {
        if (!userData) return;

        const toursDone = userData.toursCompleted || {};
        const completed = toursDone[tourId];

        if (!completed) {
            // Delay slightly to ensure page load
            const timer = setTimeout(() => setIsVisible(true), 1500);
            return () => clearTimeout(timer);
        }
    }, [tourId, userData]);

    // Track Target Element Position
    useEffect(() => {
        if (!isVisible) return;

        const updatePosition = () => {
            const targetId = steps[stepIndex]?.target;
            const el = document.getElementById(targetId);
            if (el) {
                // Scroll into view if needed
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Get fresh rect
                const r = el.getBoundingClientRect();
                setRect({
                    top: r.top + window.scrollY, // Absolute position relative to doc
                    left: r.left + window.scrollX,
                    width: r.width,
                    height: r.height,
                    // Viewport relative for fixed overlay calculation
                    viewportTop: r.top,
                    viewportLeft: r.left
                });
            } else {
                // Element not found? Skip or log?
                // console.warn(`Tour target #${targetId} not found.`);
            }
        };

        // Initial update
        // Use a small timeout to allow scroll to finish
        const t = setTimeout(updatePosition, 500);

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition);

        return () => {
            clearTimeout(t);
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition);
        };
    }, [stepIndex, isVisible, steps]);

    const handleNext = () => {
        if (stepIndex < steps.length - 1) {
            setStepIndex(stepIndex + 1);
        } else {
            handleClose();
        }
    };

    const handleSkip = () => {
        handleClose();
    };

    const handleClose = async () => {
        setIsVisible(false);
        if (userData?.uid) {
            try {
                // Determine collection
                let collectionName = 'users';
                if (userData.role === 'teacher') collectionName = 'teachers';
                else if (userData.role === 'institution') collectionName = 'institutions';

                const userRef = doc(db, collectionName, userData.uid);
                await updateDoc(userRef, {
                    [`toursCompleted.${tourId}`]: true
                });
            } catch (e) {
                console.error("Tour Save Error:", e);
                // Fallback to local if DB fails so user doesn't get stuck
                localStorage.setItem(`tour_completed_${tourId}_${userData.uid}`, 'true');
            }
        }
    };

    if (!isVisible || !rect) return null;

    const currentStep = steps[stepIndex];

    // Using Portal to break out of any overflow:hidden containers
    return createPortal(
        <div style={overlayStyle}>
            {/* The Backdrop */}
            <div style={backdropStyle} onClick={handleSkip}></div>

            {/* The Highlighter (Visual Border around target) */}
            <div style={{
                position: 'fixed',
                top: rect.viewportTop,
                left: rect.viewportLeft,
                width: rect.width,
                height: rect.height,
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.75), 0 0 15px rgba(255, 255, 255, 0.5)',
                zIndex: 9999,
                borderRadius: '8px',
                pointerEvents: 'none',
                transition: 'all 0.3s ease'
            }}></div>

            {/* The Tooltip Card */}
            <div style={{
                position: 'fixed',
                top: rect.viewportTop + rect.height + 15, // Below by default
                left: Math.max(10, Math.min(rect.viewportLeft, window.innerWidth - 310)), // Keep within bounds
                width: '300px',
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 5px 20px rgba(0,0,0,0.3)',
                zIndex: 10000,
                color: '#2d3436',
                fontFamily: 'system-ui, sans-serif',
                animation: 'fadeInTour 0.3s ease'
            }}>
                {/* Arrow pointing up */}
                <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '20px',
                    width: '12px',
                    height: '12px',
                    background: 'white',
                    transform: 'rotate(45deg)',
                }}></div>

                <h3 style={{ margin: '0 0 10px 0', fontSize: '18px', display: 'flex', justifyContent: 'space-between' }}>
                    {currentStep.title}
                    <span style={{ fontSize: '12px', background: '#eee', padding: '2px 8px', borderRadius: '10px' }}>
                        {stepIndex + 1} / {steps.length}
                    </span>
                </h3>
                <p style={{ margin: '0 0 20px 0', lineHeight: '1.5', color: '#636e72' }}>
                    {currentStep.content}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button onClick={handleSkip} style={skipBtnStyle}>
                        Skip Tour
                    </button>
                    <button onClick={handleNext} style={nextBtnStyle}>
                        {stepIndex === steps.length - 1 ? 'Finish 🎉' : 'Next →'}
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes fadeInTour {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>,
        document.body
    );
}

const overlayStyle = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    zIndex: 9998,
    pointerEvents: 'auto'
};

const backdropStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
};

const nextBtnStyle = {
    background: '#1a73e8',
    color: 'white',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '20px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    outline: 'none'
};

const skipBtnStyle = {
    background: 'transparent',
    color: '#b2bec3',
    border: 'none',
    padding: '8px',
    cursor: 'pointer',
    fontSize: '14px'
};
