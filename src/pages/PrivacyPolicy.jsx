import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => navigate(-1)} style={styles.backBtn}>
          ← Back
        </button>
        <h1 style={styles.title}>Privacy Policy for TTR AI</h1>
      </div>
      
      <div style={styles.content}>
        <p><strong>Effective Date:</strong> {new Date().toLocaleDateString()}</p>
        
        <h2>1. Introduction</h2>
        <p>Welcome to TTR AI. We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, and share your information when you use our application.</p>
        
        <h2>2. Information We Collect</h2>
        <p>We collect information that you voluntarily provide to us when you register on the App, express an interest in obtaining information about us or our products and services, or otherwise when you contact us.</p>
        <ul>
          <li><strong>Personal Information:</strong> We collect names, email addresses, and profile pictures when you sign in using Google Authentication.</li>
          <li><strong>Camera and Photos:</strong> Our app requests camera and media storage permissions to allow you to upload images or take photos directly within the app to attach to your AI queries. These images are processed to provide context to the AI.</li>
          <li><strong>Location Data:</strong> We may request fine and coarse location access to provide localized and context-aware responses to your queries. Location data is only collected when the app is in use.</li>
          <li><strong>Chat Data:</strong> We store your chat history and interactions with the AI to provide a continuous and seamless experience across sessions.</li>
        </ul>

        <h2>3. How We Use Your Information</h2>
        <p>We use the information we collect or receive:</p>
        <ul>
          <li>To facilitate account creation and logon process.</li>
          <li>To power the core functionality of the TTR AI chatbot, including image analysis and location-aware queries.</li>
          <li>To save your session history so you can retrieve past conversations.</li>
        </ul>

        <h2>4. Sharing Your Information</h2>
        <p>We do not sell, rent, or trade your personal information to third parties. We may share your data with the following categories of third-party vendors:</p>
        <ul>
          <li><strong>AI Processors:</strong> We use Google's Generative AI (Gemini) API to process your text and image queries.</li>
          <li><strong>Database and Hosting:</strong> We use Supabase to securely store your authentication data and chat history.</li>
        </ul>

        <h2>5. Data Security</h2>
        <p>We have implemented appropriate technical and organizational security measures designed to protect the security of any personal information we process. However, please also remember that we cannot guarantee that the internet itself is 100% secure.</p>

        <h2>6. Your Privacy Rights</h2>
        <p>Depending on your location, you may have certain rights regarding your personal information, such as the right to request access to or deletion of your data. To exercise these rights, please contact us.</p>

        <h2>7. Contact Us</h2>
        <p>If you have questions or comments about this notice, you may contact the development team.</p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    padding: '40px 20px',
    fontFamily: 'var(--font-family, Inter, sans-serif)',
  },
  header: {
    maxWidth: '800px',
    margin: '0 auto 30px',
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  backBtn: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    color: 'var(--accent)',
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: 'var(--bg-secondary)',
    padding: '30px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    lineHeight: '1.6',
  }
};

export default PrivacyPolicy;
