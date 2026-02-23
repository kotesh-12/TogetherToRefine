import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useLanguage } from '../context/LanguageContext';
import { db, auth } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';

export default function LibraryManagement() {
    const navigate = useNavigate();
    const { userData } = useUser();
    const { t } = useLanguage();

    const isStudent = userData?.role === 'student';
    const isTeacher = userData?.role === 'teacher';
    const isAdmin = userData?.role === 'admin' || userData?.role === 'institution';

    const [activeTab, setActiveTab] = useState(isStudent || isTeacher ? 'dashboard' : 'books'); // 'books', 'issue', 'return', 'dashboard'

    // Books State
    const [books, setBooks] = useState([]);
    const [bookTitle, setBookTitle] = useState('');
    const [bookAuthor, setBookAuthor] = useState('');
    const [bookISBN, setBookISBN] = useState('');
    const [bookCategory, setBookCategory] = useState('');
    const [bookCopies, setBookCopies] = useState('');
    const [bookPrice, setBookPrice] = useState('');
    const [bookSubject, setBookSubject] = useState('');
    const [rowNumber, setRowNumber] = useState('');
    const [shelfNumber, setShelfNumber] = useState('');

    // AI Scanning state
    const [isScanning, setIsScanning] = useState(false);
    const [auditResults, setAuditResults] = useState(null); // For bulk scan results

    // Issue/Return State
    const [issuedBooks, setIssuedBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState('');
    const [studentName, setStudentName] = useState('');
    const [studentRoll, setStudentRoll] = useState('');
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [returnDate, setReturnDate] = useState('');

    // Stats State
    const [myStats, setMyStats] = useState({ read: 0, current: [] });
    const [libStats, setLibStats] = useState({ totalBooks: 0, totalIssued: 0, outOfStock: 0 }); // For Librarians
    const [classStats, setClassStats] = useState({ overdue: [], totalActive: 0, leaderboard: [] }); // For Teachers
    const [reservations, setReservations] = useState([]);

    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const categories = ['Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'History', 'Literature', 'Reference', 'Comics'];

    useEffect(() => {
        fetchBooks();
        if (isStudent || isTeacher) {
            fetchMyStats();
            fetchReservations();
            if (isTeacher) fetchClassLibraryStats();
        } else {
            fetchIssuedBooks();
            fetchReservations();
            fetchLibrarianStats();
        }
    }, [userData]);

    const fetchLibrarianStats = async () => {
        try {
            const bSnap = await getDocs(collection(db, "library_books"));
            const iSnap = await getDocs(query(collection(db, "library_issued"), where("status", "==", "issued")));

            const booksArr = bSnap.docs.map(d => d.data());
            const totalBooks = booksArr.reduce((acc, b) => acc + (Number(b.totalCopies) || 0), 0);
            const outOfStock = booksArr.filter(b => (Number(b.availableCopies) || 0) <= 0).length;

            setLibStats({
                totalBooks,
                totalIssued: iSnap.size,
                outOfStock
            });
        } catch (e) {
            console.error(e);
        }
    };

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "library_books"), orderBy("addedAt", "desc"));
            const snap = await getDocs(q);
            setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAIScan = async (e, mode = 'single') => {
        const file = e.target.files[0];
        if (!file) return;

        setIsScanning(true);
        setAuditResults(null);
        try {
            const reader = new FileReader();
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(file);
            });
            const base64Img = await base64Promise;

            const token = await auth.currentUser?.getIdToken();

            let prompt = "";
            if (mode === 'bulk') {
                prompt = "Look at this library shelf. Identify ALL books visible. For each book, extract Title and Author. Return a JSON array: { books: [{title, author}] }. Only return the JSON.";
            } else if (mode === 'issue') {
                prompt = "This photo contains a Book cover and a Student ID Card. Identify the Book Title AND the Student Name and Roll/ID Number from the card. Return JSON: { bookTitle, studentName, studentRoll }. Only return the JSON.";
            } else {
                prompt = "Explain what is this book. Extract Title, Author, Price (just number), and Subject. Format as JSON: {title, author, price, subject}.";
            }

            const response = await fetch(`${window.location.hostname === 'localhost' ? 'http://localhost:5000' : 'https://together-to-refine.vercel.app'}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: prompt,
                    image: base64Img,
                    mimeType: file.type,
                    userContext: userData
                })
            });

            const data = await response.json();
            const aiText = data.text;
            const jsonMatch = aiText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);

            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (mode === 'bulk') {
                    setAuditResults(parsed.books || []);
                    alert(`🔍 Audit Complete: Detected ${parsed.books?.length} books.`);
                } else if (mode === 'issue') {
                    setStudentName(parsed.studentName || '');
                    setStudentRoll(parsed.studentRoll || '');
                    // Auto-find book in our local list
                    const found = books.find(b => b.title.toLowerCase().includes(parsed.bookTitle?.toLowerCase()) || parsed.bookTitle?.toLowerCase().includes(b.title.toLowerCase()));
                    if (found) setSelectedBook(found.id);
                    alert("📇 Smart Detect: Linked Student '" + parsed.studentName + "' to Book '" + parsed.bookTitle + "'");
                } else {
                    setBookTitle(parsed.title || '');
                    setBookAuthor(parsed.author || '');
                    setBookPrice(parsed.price || '');
                    setBookSubject(parsed.subject || '');
                    alert("✨ AI successfully detected book details.");
                }
            } else {
                alert("AI couldn't extract data clearly.");
            }
        } catch (err) {
            console.error("AI Scan Error:", err);
            alert("Error scanning. Try again.");
        } finally {
            setIsScanning(false);
        }
    };

    const fetchIssuedBooks = async () => {
        try {
            const q = query(
                collection(db, "library_issued"),
                where("status", "==", "issued"),
                orderBy("issueDate", "desc")
            );
            const snap = await getDocs(q);
            setIssuedBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        }
    };

    const addBook = async () => {
        if (!bookTitle || !bookAuthor || !bookCopies) {
            alert("Please fill required fields");
            return;
        }

        try {
            await addDoc(collection(db, "library_books"), {
                title: bookTitle,
                author: bookAuthor,
                isbn: bookISBN,
                category: bookCategory,
                totalCopies: parseInt(bookCopies),
                availableCopies: parseInt(bookCopies),
                price: bookPrice,
                subject: bookSubject,
                rowNumber: rowNumber,
                shelfNumber: shelfNumber,
                addedBy: userData.uid,
                addedAt: serverTimestamp()
            });

            alert("✅ Book added successfully!");
            setBookTitle('');
            setBookAuthor('');
            setBookISBN('');
            setBookCategory('');
            setBookCopies('');
            setBookPrice('');
            setBookSubject('');
            setRowNumber('');
            setShelfNumber('');
            fetchBooks();
        } catch (e) {
            console.error(e);
            alert("Error adding book");
        }
    };

    const issueBook = async () => {
        try {
            // 1. Basic Validation
            if (!selectedBook || !studentName || !studentRoll || !returnDate) {
                alert("⚠️ Please fill all required fields: Book, Student Name, Roll Number, and Return Date.");
                return;
            }

            // 2. Auth Check
            const currentUid = auth.currentUser?.uid || userData?.uid;
            if (!currentUid) {
                alert("❌ Authentication error. Please log out and log in again.");
                return;
            }

            // 3. Book Availability Check
            const book = books.find(b => b.id === selectedBook);
            if (!book) {
                alert("❌ Selected book not found in the catalog.");
                return;
            }

            if (Number(book.availableCopies) <= 0) {
                alert("❌ This book is currently out of stock (0 copies available).");
                return;
            }

            // 4. Date Formatting (Bulletproof)
            const dIssue = new Date(); // Use actual current time for issue
            const dReturn = new Date(returnDate);

            if (isNaN(dReturn.getTime())) {
                alert("⚠️ The Return Date you selected is invalid. Please pick a proper date.");
                return;
            }

            // 5. Data Object for Firestore
            const issueData = {
                bookId: String(book.id),
                bookTitle: String(book.title),
                studentName: String(studentName).trim(),
                studentRoll: String(studentRoll).trim(),
                studentClass: userData?.class || '', // Important for teacher tracking
                studentSection: userData?.section || '',
                issueDate: dIssue,
                expectedReturnDate: dReturn,
                status: 'issued',
                issuedBy: currentUid,
                issuedAt: serverTimestamp()
            };

            // 6. DB Operations
            // Add issue record
            await addDoc(collection(db, "library_issued"), issueData);

            // Update book availability
            await updateDoc(doc(db, "library_books", book.id), {
                availableCopies: Number(book.availableCopies) - 1
            });

            // 7. Success & UI Reset
            alert("🎉 Book issued successfully!");
            setSelectedBook('');
            setStudentName('');
            setStudentRoll('');
            setReturnDate('');

            // Refresh counts
            fetchBooks();
            fetchIssuedBooks();
            if (isTeacher) fetchClassLibraryStats();
        } catch (e) {
            console.error("Critical Issue Error:", e);
            alert("Error: " + (e.message || "Failed to issue book. Check your internet connection."));
        }
    };

    const returnBook = async (issueRecord) => {
        try {
            // Update issue record
            await updateDoc(doc(db, "library_issued", issueRecord.id), {
                status: 'returned',
                actualReturnDate: new Date(),
                returnedAt: serverTimestamp()
            });

            // Update book availability
            const book = books.find(b => b.id === issueRecord.bookId);
            if (book) {
                await updateDoc(doc(db, "library_books", book.id), {
                    availableCopies: book.availableCopies + 1
                });
            }

            alert("✅ Book returned successfully!");
            fetchBooks();
            fetchIssuedBooks();
        } catch (e) {
            console.error(e);
            alert("Error returning book");
        }
    };

    const fetchClassLibraryStats = async () => {
        if (!userData?.class) return;
        try {
            // Find all books issued to students in this teacher's class/section
            // Note: We might need to match by student rolls if cross-referenced, 
            // but for simplicity we'll assume the 'issue' record might have glass/section or we fetch all and check.
            const q = query(collection(db, "library_issued"), where("status", "==", "issued"));
            const snap = await getDocs(q);
            const allIssued = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // If we have student records, we'd filter here. 
            // For now, let's assume 'library_issued' records include studentClass if we update the issue logic later.
            // Simplified: Filter by comparing against current year/class patterns or teacher's overseen students.
            const myClassIssued = allIssued.filter(rec => rec.studentClass === userData.class && rec.studentSection === userData.section);

            const overdue = myClassIssued.filter(rec => {
                const due = new Date(rec.expectedReturnDate.toDate ? rec.expectedReturnDate.toDate() : rec.expectedReturnDate);
                return due < new Date();
            });

            setClassStats({
                overdue,
                totalActive: myClassIssued.length
            });
        } catch (e) {
            console.error("Teacher stats error:", e);
        }
    };

    const fetchReservations = async () => {
        try {
            let q;
            if (isStudent) {
                q = query(collection(db, "library_reservations"), where("studentId", "==", userData.uid));
            } else {
                q = query(collection(db, "library_reservations"), orderBy("reservedAt", "desc"));
            }
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { console.error(e); }
    };

    const deleteReservation = async (id) => {
        try {
            await deleteDoc(doc(db, "library_reservations", id));
            fetchReservations();
        } catch (e) { console.error(e); }
    };

    const handleReserve = async (book) => {
        if (reservations.some(r => r.bookId === book.id && r.status === 'pending')) {
            alert("You have already reserved this book.");
            return;
        }

        try {
            await addDoc(collection(db, "library_reservations"), {
                bookId: book.id,
                bookTitle: book.title,
                studentId: userData.uid,
                studentName: userData.name,
                reservedAt: serverTimestamp(),
                status: 'pending'
            });
            alert("✅ Book reserved successfully! We will notify you when it's available.");
            fetchReservations();
        } catch (e) {
            console.error(e);
            alert("Error reserving book");
        }
    };

    const calculateFine = (expectedReturnDate) => {
        const expected = new Date(expectedReturnDate.toDate ? expectedReturnDate.toDate() : expectedReturnDate);
        const today = new Date();
        const diffDays = Math.ceil((today - expected) / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return 0;
        return diffDays * 5; // ₹5 per day
    };

    const filteredBooks = books.filter(book =>
        book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        book.isbn?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📚 {t('library')}</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', overflowX: 'auto' }}>
                    {(isStudent || isTeacher) && (
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            style={{
                                padding: '10px 20px', background: 'none', border: 'none',
                                borderBottom: activeTab === 'dashboard' ? '3px solid #0984e3' : 'none',
                                fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
                                cursor: 'pointer', color: activeTab === 'dashboard' ? '#0984e3' : '#636e72'
                            }}
                        >
                            📊 {isTeacher ? "Class Dashboard" : t('lib_dashboard')}
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            onClick={() => setActiveTab('lib_dashboard')}
                            style={{
                                padding: '10px 20px', background: 'none', border: 'none',
                                borderBottom: activeTab === 'lib_dashboard' ? '3px solid #0984e3' : 'none',
                                fontWeight: activeTab === 'lib_dashboard' ? 'bold' : 'normal',
                                cursor: 'pointer', color: activeTab === 'lib_dashboard' ? '#0984e3' : '#636e72'
                            }}
                        >
                            🏢 Management Dashboard
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('books')}
                        style={{
                            padding: '10px 20px', background: 'none', border: 'none',
                            borderBottom: activeTab === 'books' ? '3px solid #0984e3' : 'none',
                            fontWeight: activeTab === 'books' ? 'bold' : 'normal',
                            cursor: 'pointer', color: activeTab === 'books' ? '#0984e3' : '#636e72'
                        }}
                    >
                        📖 {isStudent ? t('lib_browse') : t('lib_catalog')}
                    </button>
                    {!isStudent && (
                        <>
                            <button
                                onClick={() => setActiveTab('issue')}
                                style={{
                                    padding: '10px 20px', background: 'none', border: 'none',
                                    borderBottom: activeTab === 'issue' ? '3px solid #0984e3' : 'none',
                                    fontWeight: activeTab === 'issue' ? 'bold' : 'normal',
                                    cursor: 'pointer', color: activeTab === 'issue' ? '#0984e3' : '#636e72'
                                }}
                            >
                                ➕ {t('lib_issue')}
                            </button>
                            <button
                                onClick={() => setActiveTab('return')}
                                style={{
                                    padding: '10px 20px', background: 'none', border: 'none',
                                    borderBottom: activeTab === 'return' ? '3px solid #0984e3' : 'none',
                                    fontWeight: activeTab === 'return' ? 'bold' : 'normal',
                                    cursor: 'pointer', color: activeTab === 'return' ? '#0984e3' : '#636e72'
                                }}
                            >
                                ↩️ {t('lib_return')}
                            </button>
                        </>
                    )}
                </div>

                {/* LIBRARIAN (MANAGEMENT) DASHBOARD TAB */}
                {activeTab === 'lib_dashboard' && isAdmin && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                            <div className="card" style={{ background: '#0984e3', color: 'white' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>Total Books</h3>
                                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{libStats.totalBooks}</div>
                                <div style={{ opacity: 0.8 }}>Across all subjects</div>
                            </div>
                            <div className="card" style={{ background: '#6c5ce7', color: 'white' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>Active Issues</h3>
                                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{libStats.totalIssued}</div>
                                <div style={{ opacity: 0.8 }}>Currently with students/staff</div>
                            </div>
                            <div className="card" style={{ background: libStats.outOfStock > 0 ? '#e17055' : '#00b894', color: 'white' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>Out of Stock</h3>
                                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>{libStats.outOfStock}</div>
                                <div style={{ opacity: 0.8 }}>Books needing restock</div>
                            </div>
                        </div>

                        <div className="card" style={{ borderTop: '4px solid #f39c12' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>📦 AI Shelf Auditor (Librarian Tool)</h3>
                                <div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        id="bulk-scanner"
                                        hidden
                                        onChange={(e) => handleAIScan(e, 'bulk')}
                                        disabled={isScanning}
                                    />
                                    <label
                                        htmlFor="bulk-scanner"
                                        style={{
                                            padding: '10px 20px',
                                            background: isScanning ? '#7f8c8d' : '#f39c12',
                                            color: 'white',
                                            borderRadius: '8px',
                                            cursor: isScanning ? 'not-allowed' : 'pointer',
                                            fontWeight: 'bold',
                                            boxShadow: '0 4px 15px rgba(243, 156, 18, 0.3)'
                                        }}
                                    >
                                        {isScanning ? '⏳ Analyzing...' : '📸 Scan Shelf Now'}
                                    </label>
                                </div>
                            </div>
                            <p style={{ color: '#636e72', fontSize: '13px' }}>
                                Use this to verify that all books listed in the system are physically present on the shelves.
                            </p>

                            {auditResults && (
                                <div style={{ marginTop: '15px', padding: '15px', background: '#f8f9fa', borderRadius: '10px' }}>
                                    <h4 style={{ margin: '0 0 10px 0' }}>✅ Audit Result: Found {auditResults.length} Books</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                        {auditResults.map((b, i) => (
                                            <div key={i} style={{ fontSize: '12px', background: 'white', padding: '8px', borderRadius: '5px', border: '1px solid #ddd' }}>
                                                📖 <strong>{b.title}</strong>
                                                <div style={{ color: '#999' }}>{b.author}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* TEACHER DASHBOARD TAB */}
                {activeTab === 'dashboard' && isTeacher && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            <div className="card" style={{ background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)', color: 'white' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>👤 My Reading Progress</h3>
                                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{myStats.read} Books Finished</div>
                                <div style={{ opacity: 0.9 }}>Currently Reading: {myStats.current.length}</div>
                            </div>
                            <div className="card" style={{ background: 'linear-gradient(135deg, #00b894 0%, #55efc4 100%)', color: 'white' }}>
                                <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>🏢 Class {userData.class}-{userData.section} Overview</h3>
                                <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{classStats.totalActive} Active Issues</div>
                                <div style={{ color: classStats.overdue.length > 0 ? '#ff7675' : 'white', fontWeight: 'bold' }}>
                                    {classStats.overdue.length} Overdue Now
                                </div>
                            </div>
                        </div>

                        <div className="card" style={{ borderTop: '4px solid #d63031' }}>
                            <h3 style={{ color: '#d63031' }}>🕒 Overdue Books Tracker (My Class)</h3>
                            {classStats.overdue.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '20px', color: '#27ae60' }}>
                                    ✅ Great! No student in your class has overdue books.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #eee' }}>
                                                <th style={{ padding: '10px' }}>Student</th>
                                                <th style={{ padding: '10px' }}>Book Title</th>
                                                <th style={{ padding: '10px' }}>Due Date</th>
                                                <th style={{ padding: '10px' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {classStats.overdue.map(rec => (
                                                <tr key={rec.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '10px' }}>
                                                        <div style={{ fontWeight: 'bold' }}>{rec.studentName}</div>
                                                        <div style={{ fontSize: '11px', color: '#636e72' }}>Roll: {rec.studentRoll}</div>
                                                    </td>
                                                    <td style={{ padding: '10px' }}>{rec.bookTitle}</td>
                                                    <td style={{ padding: '10px', color: '#d63031', fontWeight: 'bold' }}>
                                                        {new Date(rec.expectedReturnDate.toDate?.() || rec.expectedReturnDate).toLocaleDateString()}
                                                    </td>
                                                    <td style={{ padding: '10px' }}>
                                                        <button
                                                            onClick={() => setActiveTab('return')}
                                                            className="btn-outline"
                                                            style={{ fontSize: '11px', padding: '4px 8px' }}
                                                        >
                                                            Go to Return
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* STUDENT DASHBOARD TAB */}
                {activeTab === 'dashboard' && isStudent && (
                    <div style={{ display: 'grid', gap: '20px' }}>
                        {/* Reading Stats Card */}
                        <div className="card" style={{
                            background: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}>
                            <div>
                                <h3 style={{ margin: '0 0 10px 0', color: 'white' }}>Reading Milestones</h3>
                                <div style={{ fontSize: '32px', fontWeight: 'bold' }}>You've read {myStats.read} books!</div>
                                <div style={{ opacity: 0.9, marginTop: '5px' }}>
                                    {myStats.read >= 20 ? "🏆 Book Worm Status Achieved!" :
                                        myStats.read >= 10 ? "🥈 Amazing Reader!" :
                                            "🥉 Keep reading to unlock badges!"}
                                </div>
                            </div>
                            <div style={{ fontSize: '64px' }}>📚</div>
                        </div>

                        {/* Currently Borrowed */}
                        <div className="card">
                            <h3>Currently Borrowed</h3>
                            {myStats.current.length === 0 ? (
                                <p style={{ color: '#999' }}>You have no books currently issued.</p>
                            ) : (
                                <ul style={{ paddingLeft: '20px' }}>
                                    {myStats.current.map(b => (
                                        <li key={b.id} style={{ marginBottom: '10px' }}>
                                            <strong>{b.bookTitle}</strong> - Due: {b.expectedReturnDate?.toDate?.()?.toLocaleDateString()}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* My Reservations */}
                        <div className="card">
                            <h3>My Reservations</h3>
                            {reservations.length === 0 ? (
                                <p style={{ color: '#999' }}>No active reservations.</p>
                            ) : (
                                <ul style={{ paddingLeft: '20px' }}>
                                    {reservations.map(r => (
                                        <li key={r.id} style={{ marginBottom: '10px' }}>
                                            <strong>{r.bookTitle}</strong> - Status: <span style={{ color: '#f39c12' }}>{r.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* BOOKS CATALOG TAB */}
                {activeTab === 'books' && (
                    <>
                        {/* Librarian Tools (Admin Only) */}
                        {!isStudent && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
                                {/* Add Book Form */}
                                <div className="card" style={{ borderTop: '4px solid #0984e3' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h3 style={{ margin: 0 }}>Add New Book</h3>
                                        <div>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                capture="environment"
                                                id="ai-scanner"
                                                hidden
                                                onChange={(e) => handleAIScan(e, 'single')}
                                                disabled={isScanning}
                                            />
                                            <label
                                                htmlFor="ai-scanner"
                                                style={{
                                                    padding: '8px 15px',
                                                    background: isScanning ? '#7f8c8d' : 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                                                    color: 'white',
                                                    borderRadius: '8px',
                                                    cursor: isScanning ? 'not-allowed' : 'pointer',
                                                    fontSize: '14px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 4px 10px rgba(108, 92, 231, 0.3)'
                                                }}
                                            >
                                                {isScanning ? '⏳ Detection...' : '📸 Scan Cover'}
                                            </label>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gap: '20px' }}>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <input type="text" className="input-field" placeholder="Title" value={bookTitle} onChange={(e) => setBookTitle(e.target.value)} />
                                            <input type="text" className="input-field" placeholder="Author" value={bookAuthor} onChange={(e) => setBookAuthor(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <input type="text" className="input-field" placeholder="Subject" value={bookSubject} onChange={(e) => setBookSubject(e.target.value)} />
                                            <input type="number" className="input-field" placeholder="Price" value={bookPrice} onChange={(e) => setBookPrice(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <input type="text" className="input-field" placeholder="Row" value={rowNumber} onChange={(e) => setRowNumber(e.target.value)} />
                                            <input type="text" className="input-field" placeholder="Shelf" value={shelfNumber} onChange={(e) => setShelfNumber(e.target.value)} />
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                            <select className="input-field" value={bookCategory} onChange={(e) => setBookCategory(e.target.value)}>
                                                <option value="">Category</option>
                                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                            </select>
                                            <input type="number" className="input-field" placeholder="Copies" value={bookCopies} onChange={(e) => setBookCopies(e.target.value)} />
                                        </div>
                                        <button onClick={addBook} className="btn" style={{ height: '40px' }}>➕ Save Book</button>
                                    </div>
                                </div>

                                {/* Bulk Shelf Audit Tool */}
                                <div className="card" style={{ borderTop: '4px solid #f39c12' }}>
                                    <h3 style={{ margin: '0 0 10px 0' }}>📦 Bulk Shelf Audit</h3>
                                    <p style={{ fontSize: '12px', color: '#636e72', marginBottom: '15px' }}>
                                        Take one photo of multiple books. AI will identify them and check against your database.
                                    </p>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        id="bulk-scanner"
                                        hidden
                                        onChange={(e) => handleAIScan(e, 'bulk')}
                                        disabled={isScanning}
                                    />
                                    <label
                                        htmlFor="bulk-scanner"
                                        style={{
                                            padding: '12px',
                                            background: isScanning ? '#7f8c8d' : '#f39c12',
                                            color: 'white',
                                            borderRadius: '8px',
                                            cursor: isScanning ? 'not-allowed' : 'pointer',
                                            display: 'block',
                                            textAlign: 'center',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {isScanning ? '⏳ Analyzing Shelf...' : '📸 Audit Whole Shelf'}
                                    </label>

                                    {auditResults && (
                                        <div style={{ marginTop: '15px', maxHeight: '200px', overflowY: 'auto', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px', color: '#2ecc71' }}>
                                                ✅ Found {auditResults.length} Books:
                                            </div>
                                            {auditResults.map((b, i) => (
                                                <div key={i} style={{ fontSize: '12px', padding: '5px 0', borderBottom: '1px solid #ddd' }}>
                                                    • <strong>{b.title}</strong> by {b.author}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Quick Approval View (Librarian Burden Reducer) */}
                        {!isStudent && activeTab === 'books' && (
                            <PendingRequests fetchIssuedBooks={fetchIssuedBooks} />
                        )}

                        {/* Books List */}
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                                <h3 style={{ margin: 0 }}>Books Catalog ({books.length})</h3>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="🔍 Search by Title, Author, or Subject..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ maxWidth: '400px' }}
                                />
                            </div>

                            {loading ? (
                                <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>
                            ) : filteredBooks.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                    No books found
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead style={{ background: '#f8f9fa' }}>
                                            <tr>
                                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Title & Author</th>
                                                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Location</th>
                                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Status</th>
                                                <th style={{ padding: '12px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredBooks.map(book => (
                                                <tr key={book.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ fontWeight: 'bold' }}>{book.title}</div>
                                                        <div style={{ fontSize: '12px', color: '#636e72' }}>by {book.author} | {book.subject}</div>
                                                    </td>
                                                    <td style={{ padding: '12px' }}>
                                                        <div style={{ background: '#f1f2f6', padding: '4px 8px', borderRadius: '4px', display: 'inline-block', fontSize: '12px' }}>
                                                            Row {book.rowNumber || '?'}, Shelf {book.shelfNumber || '?'}
                                                        </div>
                                                    </td>
                                                    <td style={{
                                                        padding: '12px',
                                                        textAlign: 'center',
                                                        color: book.availableCopies > 0 ? '#27ae60' : '#e74c3c',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {book.availableCopies > 0 ? 'AVAILABLE' : 'OUT'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'center' }}>
                                                        {isStudent && book.availableCopies > 0 && (
                                                            <button
                                                                onClick={() => handleStudentSelfIssue(book)}
                                                                className="btn"
                                                                style={{ padding: '6px 12px', fontSize: '12px', background: '#0984e3' }}
                                                            >
                                                                📥 Scan to Issue
                                                            </button>
                                                        )}
                                                        {!isStudent && (
                                                            <span style={{ fontSize: '12px', color: '#999' }}>
                                                                {book.availableCopies}/{book.totalCopies}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                )}

                {/* ISSUE BOOK TAB */}
                {activeTab === 'issue' && (
                    <div className="card" style={{ borderTop: '4px solid #6c5ce7' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0 }}>Issue Book to Student</h3>
                            <div>
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    id="issue-scanner"
                                    hidden
                                    onChange={(e) => handleAIScan(e, 'issue')}
                                    disabled={isScanning}
                                />
                                <label
                                    htmlFor="issue-scanner"
                                    style={{
                                        padding: '10px 18px',
                                        background: isScanning ? '#7f8c8d' : 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
                                        color: 'white',
                                        borderRadius: '8px',
                                        cursor: isScanning ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 15px rgba(108, 92, 231, 0.4)'
                                    }}
                                >
                                    {isScanning ? '⏳ Reading ID & Book...' : '📸 Smart Scan (Book + ID Card)'}
                                </label>
                            </div>
                        </div>

                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '10px', marginBottom: '20px', border: '1px dashed #dcdde1' }}>
                            <p style={{ margin: 0, fontSize: '13px', color: '#636e72' }}>
                                💡 <strong>Pro Tip:</strong> Use "Smart Scan" to take one photo of the book cover and student's ID card together. AI will fill the details for you!
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Select Book *
                                </label>
                                <select className="input-field" value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
                                    <option value="">{isScanning ? 'Detecting book...' : 'Choose a book'}</option>
                                    {books.filter(b => b.availableCopies > 0).map(book => (
                                        <option key={book.id} value={book.id}>
                                            {book.title} ({book.availableCopies} left)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Student Name *
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        placeholder="Auto-detected from ID Card"
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Roll Number / ID *
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={studentRoll}
                                        onChange={(e) => setStudentRoll(e.target.value)}
                                        placeholder="Auto-detected from ID Card"
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Due Date (Select) *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={returnDate}
                                        onChange={(e) => setReturnDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button onClick={issueBook} className="btn" style={{ height: '45px', fontSize: '16px' }}>✅ Confirm & Issue Book</button>
                        </div>
                    </div>
                )}

                {/* RETURN BOOK TAB */}
                {activeTab === 'return' && (
                    <div className="card">
                        <h3>Issued Books ({issuedBooks.length})</h3>

                        {issuedBooks.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                                No books currently issued
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                    <thead style={{ background: '#f8f9fa' }}>
                                        <tr>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Book</th>
                                            <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Student</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Issue Date</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Due Date</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Fine</th>
                                            <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issuedBooks.map(record => {
                                            const fine = calculateFine(record.expectedReturnDate);
                                            const isOverdue = fine > 0;

                                            return (
                                                <tr key={record.id} style={{
                                                    borderBottom: '1px solid #eee',
                                                    background: isOverdue ? '#fff5f5' : 'white'
                                                }}>
                                                    <td style={{ padding: '10px' }}>{record.bookTitle}</td>
                                                    <td style={{ padding: '10px' }}>
                                                        {record.studentName}
                                                        <div style={{ fontSize: '12px', color: '#999' }}>Roll: {record.studentRoll}</div>
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                                                        {record.issueDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '13px' }}>
                                                        {record.expectedReturnDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                                        {isOverdue ? (
                                                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>
                                                                ₹{fine}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#27ae60' }}>₹0</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                                        <button
                                                            onClick={() => returnBook(record)}
                                                            style={{
                                                                background: '#27ae60', color: 'white',
                                                                border: 'none', padding: '5px 12px',
                                                                borderRadius: '4px', cursor: 'pointer',
                                                                fontSize: '13px'
                                                            }}
                                                        >
                                                            ✅ Return
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* RESERVATIONS TAB (Admin) */}
                {activeTab === 'reservations' && !isStudent && (
                    <div className="card">
                        <h3>Reservations Queue ({reservations.length})</h3>
                        {reservations.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>No active reservations</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead style={{ background: '#f8f9fa' }}>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Book</th>
                                        <th style={{ padding: '10px', textAlign: 'left' }}>Student</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Reserved At</th>
                                        <th style={{ padding: '10px', textAlign: 'center' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reservations.map(res => (
                                        <tr key={res.id} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px' }}>{res.bookTitle}</td>
                                            <td style={{ padding: '10px' }}>{res.studentName}</td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                {res.reservedAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                                            </td>
                                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => deleteReservation(res.id)}
                                                    style={{
                                                        background: '#e74c3c', color: 'white',
                                                        border: 'none', padding: '5px 12px',
                                                        borderRadius: '4px', cursor: 'pointer',
                                                        fontSize: '12px'
                                                    }}
                                                >
                                                    ❌ Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Burden Reducer Component: Handles Quick Approvals
function PendingRequests({ fetchIssuedBooks }) {
    const [requests, setRequests] = useState([]);

    useEffect(() => {
        const fetchRequests = async () => {
            const q = query(
                collection(db, "library_issue_requests"),
                where("status", "==", "pending"),
                orderBy("requestedAt", "desc")
            );
            const snap = await getDocs(q);
            setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        };
        fetchRequests();
    }, []);

    const handleAction = async (request, action) => {
        try {
            if (action === 'approve') {
                const bookRef = doc(db, "library_books", request.bookId);
                const bookSnap = await getDocs(query(collection(db, "library_books"), where("__name__", "==", request.bookId)));
                const bookData = bookSnap.docs[0]?.data();

                if (!bookData || bookData.availableCopies <= 0) {
                    alert("Book no longer available!");
                    return;
                }

                // 1. Create Issue Record
                const returnDate = new Date();
                returnDate.setDate(returnDate.getDate() + 14); // Default 14 days

                await addDoc(collection(db, "library_issued"), {
                    bookId: request.bookId,
                    bookTitle: request.bookTitle,
                    studentName: request.studentName,
                    studentRoll: request.studentRoll,
                    issueDate: new Date(),
                    expectedReturnDate: returnDate,
                    status: 'issued',
                    issuedBy: 'auto-self-service',
                    issuedAt: serverTimestamp()
                });

                // 2. Update Book
                await updateDoc(doc(db, "library_books", request.bookId), {
                    availableCopies: bookData.availableCopies - 1
                });
            }

            // 3. Update Request Status
            await updateDoc(doc(db, "library_issue_requests", request.id), {
                status: action === 'approve' ? 'approved' : 'declined',
                processedAt: serverTimestamp()
            });

            alert(`✅ Request ${action === 'approve' ? 'Approved' : 'Declined'}`);
            setRequests(prev => prev.filter(r => r.id !== request.id));
            fetchIssuedBooks();
        } catch (e) {
            console.error(e);
            alert("Error processing request.");
        }
    };

    if (requests.length === 0) return null;

    return (
        <div className="card" style={{ background: '#e3f2fd', borderLeft: '5px solid #0984e3', marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#0984e3' }}>🔔 Quick Approval Queue ({requests.length})</h3>
            <p style={{ fontSize: '12px', color: '#636e72', marginBottom: '15px' }}>
                Students have scanned these books. Verify the student is standing in front of you and click Approve.
            </p>
            <div style={{ display: 'grid', gap: '10px' }}>
                {requests.map(r => (
                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                        <div>
                            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{r.bookTitle}</div>
                            <div style={{ fontSize: '12px', color: '#636e72' }}>Requested by: <strong>{r.studentName}</strong> ({r.studentRoll})</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={() => handleAction(r, 'approve')}
                                style={{ background: '#2ecc71', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => handleAction(r, 'decline')}
                                style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                            >
                                Decline
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
