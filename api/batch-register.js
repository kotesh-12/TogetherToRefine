import admin from 'firebase-admin';

// Helper logic logic moved inside handler

export default async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // Serverless platforms aggressively garbage collect models. Initialize *inside* execution.
    if (!admin.apps.length) {
        let serviceAccount = null;

        // Try ENV first (Safest for Vercel)
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                console.log("Successfully loaded Service Account from ENV");
            } catch (jsonErr) {
                console.error("Parse Error for FIREBASE_SERVICE_ACCOUNT ENV:", jsonErr);
            }
        }

        // Fallback to local file for dev, using dynamic import so Vercel doesn't crash if missing
        if (!serviceAccount) {
            try {
                // Read via filesystem instead of require to prevent Next.js/Webpack build crashes
                const fs = await import('fs');
                const path = await import('path');
                const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
                if (fs.existsSync(keyPath)) {
                    serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
                    console.log("Successfully loaded Service Account from local JSON file");
                }
            } catch (e) {
                console.error("Failed to load local serviceAccountKey.json", e.message);
            }
        }

        if (serviceAccount) {
            try {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            } catch (initErr) {
                console.error("Firebase Initialization Failed:", initErr);
                return res.status(500).json({ error: "Auth Subsystem Error: " + initErr.message });
            }
        } else {
            console.error("CRITICAL: No Service Account Configured");
            return res.status(500).json({ error: "Missing Firebase Service Account Config in Vercel Deployment." });
        }
    }

    try {
        // --- 1. Verify Auth Token ---
        const token = req.headers.authorization?.split('Bearer ')[1];
        if (!token) {
            return res.status(401).json({ error: 'No auth token provided' });
        }

        let user;
        try {
            user = await admin.auth().verifyIdToken(token);
        } catch (e) {
            console.error("Token Auth Error:", e.message);
            return res.status(401).json({ error: 'Auth Error: ' + e.message });
        }

        // Check if the requester is an institution or admin
        // Firebase ID tokens don't carry custom role claims by default,
        // so we look up the institutions collection to verify identity.
        let requesterRole = user.role; // May be set if custom claims are used
        if (!requesterRole) {
            const institutionDoc = await admin.firestore().collection('institutions').doc(user.uid).get();
            if (institutionDoc.exists) {
                // If the document exists, they ARE an institution regardless of role field presence
                requesterRole = institutionDoc.data()?.role || 'institution';
            }
        }

        if (requesterRole !== 'institution' && requesterRole !== 'admin') {
            return res.status(403).json({ error: "Only Institutions can batch register students." });
        }

        const students = req.body.students;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({ error: "No students provided." });
        }

        if (students.length > 50) {
            return res.status(400).json({ error: "Batch size limit exceeded. Max 50 per request." });
        }

        const results = { success: [], failed: [] };

        // --- 2. Process Batch ---
        for (const student of students) {
            try {
                // A. Create Auth User
                const userRecord = await admin.auth().createUser({
                    email: student.email,
                    password: student.password || 'Student@123',
                    displayName: student.name
                });

                // B. Create Standard Profile in Firestore
                const pid = `ST-${Math.floor(100000 + Math.random() * 900000)}`;

                // Parse class/section: vision-admission sends both separate and combined
                // Fall back to splitting the combined "10-A" string if separate fields missing
                const combinedClass = student.class || 'N/A';
                const classOnly = student.classOnly || (combinedClass.includes('-') ? combinedClass.split('-')[0] : combinedClass);
                const sectionOnly = student.section || (combinedClass.includes('-') ? combinedClass.split('-')[1] : 'A');
                const studentRole = student.role || 'student';
                const collectionName = studentRole === 'teacher' ? 'teachers' : 'users';

                await admin.firestore().collection(collectionName).doc(userRecord.uid).set({
                    profileCompleted: false,
                    onboardingCompleted: false,
                    name: student.name,
                    email: student.email,
                    firstName: student.firstName || student.name.split(' ')[0],
                    secondName: student.lastName || student.name.split(' ').slice(1).join(' '),
                    rollNumber: student.rollNumber || null,
                    pid: pid,
                    institutionId: user.uid,
                    class: classOnly,
                    section: sectionOnly,
                    approved: false, // Details page sets approved:true for isInstitutionCreated
                    isInstitutionCreated: true,
                    role: studentRole,
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });

                // C. Create Admission Record & Allotment for all institution-created accounts
                await admin.firestore().collection('admissions').add({
                    name: student.name,
                    role: studentRole,
                    userId: userRecord.uid,
                    institutionId: user.uid,
                    status: 'waiting', // Details.jsx will update to 'allotted' on submit
                    assignedClass: classOnly,
                    assignedSection: sectionOnly,
                    rollNumber: student.rollNumber || null,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp()
                });

                await admin.firestore().collection('student_allotments').add({
                    name: student.name,
                    classAssigned: classOnly,
                    section: sectionOnly,
                    age: 'N/A',
                    rollNumber: student.rollNumber || null,
                    createdBy: user.uid,
                    institutionId: user.uid,
                    userId: userRecord.uid
                });

                results.success.push({
                    name: student.name,
                    email: student.email,
                    password: student.password || 'Student@123',
                    class: student.class || 'N/A',
                    rollNumber: student.rollNumber || 'N/A',
                    pid
                });
            } catch (error) {
                console.error(`Failed to register ${student.email}:`, error);
                results.failed.push({ email: student.email, error: error.message });
            }
        }

        if (results.success.length > 0) {
            try {
                await admin.firestore().collection('admission_history').add({
                    institutionId: user.uid,
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    studentsAdded: results.success.length,
                    batchClass: students[0]?.class?.split('-')[0] || 'Mixed',
                    batchSection: students[0]?.class?.split('-')[1] || 'Mixed',
                    type: 'ai_scan'
                });
            } catch (histErr) {
                console.error("Failed to log admission history:", histErr);
            }
        }

        res.json({
            message: `Processed ${students.length} students.`,
            results
        });

    } catch (err) {
        console.error("Vercel Batch Register Error:", err);
        res.status(500).json({ error: "Failed to process " + err.message });
    }
}
