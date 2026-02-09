import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';

export default function LibraryManagement() {
    const navigate = useNavigate();
    const { userData } = useUser();

    const isStudent = userData?.role === 'student';
    const [activeTab, setActiveTab] = useState(isStudent ? 'dashboard' : 'books'); // 'books', 'issue', 'return', 'dashboard'

    // Books State
    const [books, setBooks] = useState([]);
    const [bookTitle, setBookTitle] = useState('');
    const [bookAuthor, setBookAuthor] = useState('');
    const [bookISBN, setBookISBN] = useState('');
    const [bookCategory, setBookCategory] = useState('');
    const [bookCopies, setBookCopies] = useState('');

    // Issue/Return State
    const [issuedBooks, setIssuedBooks] = useState([]);
    const [selectedBook, setSelectedBook] = useState('');
    const [studentName, setStudentName] = useState('');
    const [studentRoll, setStudentRoll] = useState('');
    const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
    const [returnDate, setReturnDate] = useState('');

    // Student Stats State
    const [myStats, setMyStats] = useState({ read: 0, current: [] });
    const [reservations, setReservations] = useState([]);

    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const categories = ['Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'History', 'Literature', 'Reference', 'Comics'];

    useEffect(() => {
        fetchBooks();
        if (isStudent) {
            fetchMyStats();
            fetchReservations();
        } else {
            fetchIssuedBooks();
        }
    }, [userData]);

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, "library_books"));
            const snap = await getDocs(q);
            setBooks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
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
                addedBy: userData.uid,
                addedAt: serverTimestamp()
            });

            alert("✅ Book added successfully!");
            setBookTitle('');
            setBookAuthor('');
            setBookISBN('');
            setBookCategory('');
            setBookCopies('');
            fetchBooks();
        } catch (e) {
            console.error(e);
            alert("Error adding book");
        }
    };

    const issueBook = async () => {
        if (!selectedBook || !studentName || !studentRoll || !returnDate) {
            alert("Please fill all fields");
            return;
        }

        const book = books.find(b => b.id === selectedBook);
        if (!book || book.availableCopies <= 0) {
            alert("Book not available");
            return;
        }

        try {
            // Add issue record
            await addDoc(collection(db, "library_issued"), {
                bookId: book.id,
                bookTitle: book.title,
                studentName,
                studentRoll,
                issueDate: new Date(issueDate),
                expectedReturnDate: new Date(returnDate),
                status: 'issued',
                issuedBy: userData.uid,
                issuedAt: serverTimestamp()
            });

            // Update book availability
            await updateDoc(doc(db, "library_books", book.id), {
                availableCopies: book.availableCopies - 1
            });

            alert("✅ Book issued successfully!");
            setSelectedBook('');
            setStudentName('');
            setStudentRoll('');
            setReturnDate('');
            fetchBooks();
            fetchIssuedBooks();
        } catch (e) {
            console.error(e);
            alert("Error issuing book");
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

    const fetchMyStats = async () => {
        if (!userData?.name) return;
        try {
            // Match mostly by name since issue process is manual
            const q = query(collection(db, "library_issued"), where("studentName", "==", userData.name));
            const snap = await getDocs(q);
            const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            const read = docs.filter(d => d.status === 'returned').length;
            const current = docs.filter(d => d.status === 'issued');

            setMyStats({ read, current });
        } catch (e) {
            console.error("Error fetching stats:", e);
        }
    };

    const fetchReservations = async () => {
        try {
            const q = query(collection(db, "library_reservations"), where("studentId", "==", userData.uid));
            const snap = await getDocs(q);
            setReservations(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
        book.isbn?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="page-wrapper">
            <div className="container">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>📚 Library Management</h2>
                    <button onClick={() => navigate(-1)} className="btn-outline">← Back</button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee', overflowX: 'auto' }}>
                    {isStudent && (
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            style={{
                                padding: '10px 20px', background: 'none', border: 'none',
                                borderBottom: activeTab === 'dashboard' ? '3px solid #0984e3' : 'none',
                                fontWeight: activeTab === 'dashboard' ? 'bold' : 'normal',
                                cursor: 'pointer', color: activeTab === 'dashboard' ? '#0984e3' : '#636e72'
                            }}
                        >
                            📊 My Dashboard
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
                        📖 {isStudent ? 'Browse Books' : 'Books Catalog'}
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
                                ➕ Issue Book
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
                                ↩️ Return Book
                            </button>
                        </>
                    )}
                </div>

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
                        {/* Add Book Form (Admin Only) */}
                        {!isStudent && (
                            <div className="card" style={{ marginBottom: '20px' }}>
                                <h3>Add New Book</h3>
                                <div style={{ display: 'grid', gap: '10px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Book Title *"
                                            value={bookTitle}
                                            onChange={(e) => setBookTitle(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="Author *"
                                            value={bookAuthor}
                                            onChange={(e) => setBookAuthor(e.target.value)}
                                        />
                                        <input
                                            type="text"
                                            className="input-field"
                                            placeholder="ISBN (Optional)"
                                            value={bookISBN}
                                            onChange={(e) => setBookISBN(e.target.value)}
                                        />
                                        <select className="input-field" value={bookCategory} onChange={(e) => setBookCategory(e.target.value)}>
                                            <option value="">Select Category</option>
                                            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        </select>
                                        <input
                                            type="number"
                                            className="input-field"
                                            placeholder="Number of Copies *"
                                            value={bookCopies}
                                            onChange={(e) => setBookCopies(e.target.value)}
                                        />
                                    </div>
                                    <button onClick={addBook} className="btn">➕ Add Book</button>
                                </div>
                            </div>
                        )}

                        {/* Books List */}
                        <div className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                <h3 style={{ margin: 0 }}>Books Catalog ({books.length})</h3>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="🔍 Search books..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{ maxWidth: '300px' }}
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
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Title</th>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Author</th>
                                                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #dee2e6' }}>Category</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>Available</th>
                                                <th style={{ padding: '10px', textAlign: 'center', borderBottom: '2px solid #dee2e6' }}>{isStudent ? 'Action' : 'Total'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredBooks.map(book => (
                                                <tr key={book.id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '10px' }}>{book.title}</td>
                                                    <td style={{ padding: '10px', color: '#636e72' }}>{book.author}</td>
                                                    <td style={{ padding: '10px' }}>
                                                        <span style={{
                                                            background: '#e8f5e9',
                                                            color: '#2e7d32',
                                                            padding: '3px 8px',
                                                            borderRadius: '4px',
                                                            fontSize: '12px'
                                                        }}>
                                                            {book.category || 'Uncategorized'}
                                                        </span>
                                                    </td>
                                                    <td style={{
                                                        padding: '10px',
                                                        textAlign: 'center',
                                                        color: book.availableCopies > 0 ? '#27ae60' : '#e74c3c',
                                                        fontWeight: 'bold'
                                                    }}>
                                                        {book.availableCopies}
                                                    </td>
                                                    <td style={{ padding: '10px', textAlign: 'center' }}>
                                                        {isStudent ? (
                                                            book.availableCopies === 0 ? (
                                                                <button
                                                                    onClick={() => handleReserve(book)}
                                                                    className="btn"
                                                                    style={{ padding: '5px 10px', fontSize: '12px', background: '#f39c12' }}
                                                                >
                                                                    🕒 Reserve
                                                                </button>
                                                            ) : (
                                                                <span style={{ color: '#27ae60', fontSize: '12px' }}>Available</span>
                                                            )
                                                        ) : (
                                                            book.totalCopies
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
                    <div className="card">
                        <h3>Issue Book to Student</h3>
                        <div style={{ display: 'grid', gap: '15px' }}>
                            <div>
                                <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                    Select Book *
                                </label>
                                <select className="input-field" value={selectedBook} onChange={(e) => setSelectedBook(e.target.value)}>
                                    <option value="">Choose a book</option>
                                    {books.filter(b => b.availableCopies > 0).map(book => (
                                        <option key={book.id} value={book.id}>
                                            {book.title} by {book.author} ({book.availableCopies} available)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Student Name *
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={studentName}
                                        onChange={(e) => setStudentName(e.target.value)}
                                        placeholder="Enter student name"
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Roll Number *
                                    </label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={studentRoll}
                                        onChange={(e) => setStudentRoll(e.target.value)}
                                        placeholder="Enter roll number"
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Issue Date
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={issueDate}
                                        onChange={(e) => setIssueDate(e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label style={{ fontSize: '13px', color: '#636e72', display: 'block', marginBottom: '5px' }}>
                                        Return Date *
                                    </label>
                                    <input
                                        type="date"
                                        className="input-field"
                                        value={returnDate}
                                        onChange={(e) => setReturnDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button onClick={issueBook} className="btn">✅ Issue Book</button>
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
            </div>
        </div>
    );
}
