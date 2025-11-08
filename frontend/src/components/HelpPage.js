import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HelpPage.css';

const HelpPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', icon: '🚀', title: 'Getting Started' },
    { id: 'search', icon: '🔍', title: 'Search & Filters' },
    { id: 'l3v3l', icon: '🦋', title: 'L3V3L Matching' },
    { id: 'profile', icon: '👤', title: 'Your Profile' },
    { id: 'connections', icon: '💬', title: 'Connections & Chat' },
    { id: 'privacy', icon: '🔒', title: 'Privacy & Safety' },
    { id: 'account', icon: '⚙️', title: 'Account Settings' },
    { id: 'faq', icon: '❓', title: 'FAQ' }
  ];

  const renderContent = () => {
    switch (activeSection) {
      case 'getting-started':
        return (
          <div className="help-content">
            <h2>🚀 Getting Started with L3V3L Matches</h2>
            
            <div className="help-section">
              <h3>Welcome to Your Matrimonial Journey!</h3>
              <p>L3V3L Matches is a modern matrimonial platform that uses AI-powered compatibility matching to help you find your perfect life partner.</p>
            </div>

            <div className="help-section">
              <h3>Quick Start Guide</h3>
              <ol>
                <li>
                  <strong>Complete Your Profile:</strong>
                  <p>Go to Profile → Edit Profile and fill in all sections. A complete profile gets better matches!</p>
                </li>
                <li>
                  <strong>Upload Photos:</strong>
                  <p>Add clear, recent photos. Profiles with photos get 5x more views!</p>
                </li>
                <li>
                  <strong>Set Your Preferences:</strong>
                  <p>Specify what you're looking for in Partner Preferences section.</p>
                </li>
                <li>
                  <strong>Start Searching:</strong>
                  <p>Use our advanced search with L3V3L compatibility scoring to find matches.</p>
                </li>
                <li>
                  <strong>Connect & Chat:</strong>
                  <p>Send interest, favorite profiles, and start conversations with your matches.</p>
                </li>
              </ol>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Complete profiles with photos and detailed information rank higher in search results and get more visibility!
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="help-content">
            <h2>🔍 Search & Filters</h2>
            
            <div className="help-section">
              <h3>Basic Search</h3>
              <p>Use the search bar to find profiles by:</p>
              <ul>
                <li><strong>Keyword:</strong> Search by name, location, occupation, or interests</li>
                <li><strong>Location:</strong> Filter by city or state</li>
                <li><strong>Age Range:</strong> Set minimum and maximum age (19-100 years)</li>
                <li><strong>Height Range:</strong> Specify height preferences in feet and inches</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Advanced Filters</h3>
              <p>Click "View More" to access additional filters:</p>
              <ul>
                <li>Body Type</li>
                <li>Occupation & Education</li>
                <li>Religion & Caste</li>
                <li>Eating Preferences (Vegetarian, Non-Vegetarian, Vegan)</li>
                <li>Lifestyle (Drinking, Smoking habits)</li>
                <li>Recently Added (last 7, 30, or 90 days)</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>L3V3L Compatibility Score</h3>
              <p>Use the slider to set minimum compatibility score (0-100%). Higher scores mean better matches based on:</p>
              <ul>
                <li>Values & personality alignment</li>
                <li>Lifestyle compatibility</li>
                <li>Demographic factors</li>
                <li>Partner preferences match</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Saved Searches</h3>
              <p>Save your frequently used search criteria for quick access:</p>
              <ol>
                <li>Set your desired filters</li>
                <li>Click "💾 Save Search"</li>
                <li>Access saved searches from "Saved (2)" tab</li>
              </ol>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Start with broader criteria, then narrow down using L3V3L compatibility scores for best results!
            </div>
          </div>
        );

      case 'l3v3l':
        return (
          <div className="help-content">
            <h2>🦋 L3V3L Matching System</h2>
            
            <div className="help-section">
              <h3>What is L3V3L?</h3>
              <p>L3V3L is our proprietary AI-powered compatibility algorithm that analyzes multiple dimensions of compatibility to help you find your perfect match.</p>
            </div>

            <div className="help-section">
              <h3>How L3V3L Scoring Works</h3>
              <div className="score-breakdown">
                <div className="score-item">
                  <strong>85-100%</strong> - Excellent Match 💕
                  <p>Exceptionally compatible. Highly recommended!</p>
                </div>
                <div className="score-item">
                  <strong>70-84%</strong> - Great Match 💚
                  <p>Strong compatibility across multiple areas.</p>
                </div>
                <div className="score-item">
                  <strong>50-69%</strong> - Good Match 👍
                  <p>Decent compatibility with some shared values.</p>
                </div>
                <div className="score-item">
                  <strong>Below 50%</strong> - Low Compatibility
                  <p>Limited alignment. Consider other matches.</p>
                </div>
              </div>
            </div>

            <div className="help-section">
              <h3>L3V3L Components</h3>
              <ul>
                <li><strong>Gender Compatibility:</strong> Opposite gender matching (heterosexual platform)</li>
                <li><strong>Demographics:</strong> Age, location, education, occupation alignment</li>
                <li><strong>Values & Personality:</strong> Core beliefs, lifestyle choices, interests</li>
                <li><strong>Partner Preferences:</strong> How well you match each other's stated preferences</li>
                <li><strong>Lifestyle Compatibility:</strong> Habits, routines, and daily life alignment</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>View Match Reasons</h3>
              <p>Click on any profile to see detailed breakdown:</p>
              <ul>
                <li>Component scores (demographics, preferences, personality)</li>
                <li>Specific reasons for compatibility</li>
                <li>Areas of strong alignment</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Focus on matches with 70%+ compatibility for best results. Don't ignore lower scores completely - sometimes chemistry surprises us!
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="help-content">
            <h2>👤 Your Profile</h2>
            
            <div className="help-section">
              <h3>Profile Sections</h3>
              <ol>
                <li>
                  <strong>Basic Information:</strong>
                  <p>Name, age, gender, height, location, contact details</p>
                </li>
                <li>
                  <strong>About You:</strong>
                  <p>Write a compelling bio that showcases your personality (200-500 words recommended)</p>
                </li>
                <li>
                  <strong>Education & Career:</strong>
                  <p>Your educational background and occupation</p>
                </li>
                <li>
                  <strong>Family Background:</strong>
                  <p>Family values, members, and background</p>
                </li>
                <li>
                  <strong>Lifestyle & Interests:</strong>
                  <p>Hobbies, eating preferences, habits</p>
                </li>
                <li>
                  <strong>Partner Preferences:</strong>
                  <p>Specify what you're looking for in a life partner</p>
                </li>
              </ol>
            </div>

            <div className="help-section">
              <h3>Photos Guidelines</h3>
              <ul>
                <li>Upload at least 3-5 clear, recent photos</li>
                <li>Include face photos, full-body shots, and candid pictures</li>
                <li>Avoid group photos or heavy filters</li>
                <li>Professional photos get more attention</li>
                <li>Supported formats: JPG, PNG (max 5MB each)</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Profile Visibility</h3>
              <p>Control who can see your profile:</p>
              <ul>
                <li><strong>Active:</strong> Visible to all users in search</li>
                <li><strong>Hidden:</strong> Only you can see your profile</li>
                <li><strong>Paused:</strong> Temporarily hidden (vacation mode)</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Complete profiles with photos get 10x more views! Be authentic, positive, and specific about what you're looking for.
            </div>
          </div>
        );

      case 'connections':
        return (
          <div className="help-content">
            <h2>💬 Connections & Chat</h2>
            
            <div className="help-section">
              <h3>Ways to Connect</h3>
              <ul>
                <li><strong>Send Interest:</strong> Let someone know you're interested</li>
                <li><strong>Favorite Profile:</strong> Bookmark profiles to view later</li>
                <li><strong>Start Chat:</strong> Begin a conversation with mutual matches</li>
                <li><strong>Request Contact Info:</strong> Exchange phone/email details</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Chat Features</h3>
              <ul>
                <li>Real-time messaging with instant delivery</li>
                <li>Online/offline status indicators</li>
                <li>Typing indicators to show activity</li>
                <li>Message history saved for convenience</li>
                <li>Emoji and text formatting support</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Managing Connections</h3>
              <ul>
                <li><strong>My Favorites:</strong> View all profiles you've favorited</li>
                <li><strong>Who Favorited Me:</strong> See who's interested in you</li>
                <li><strong>My Activities:</strong> Track your interactions and interests</li>
                <li><strong>Block/Report:</strong> Control your experience and stay safe</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Exclusions</h3>
              <p>If you don't want to see certain profiles:</p>
              <ol>
                <li>Go to their profile</li>
                <li>Click "⛔ Exclude" button</li>
                <li>They won't appear in your search anymore</li>
                <li>Manage exclusions in Account Settings</li>
              </ol>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Be respectful and genuine in your conversations. First impressions matter - take time to read profiles before messaging!
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="help-content">
            <h2>🔒 Privacy & Safety</h2>
            
            <div className="help-section">
              <h3>Your Privacy Matters</h3>
              <p>We take your privacy seriously and provide multiple controls:</p>
              <ul>
                <li>Hide/pause your profile anytime</li>
                <li>Control who can contact you</li>
                <li>Block unwanted users</li>
                <li>Report suspicious profiles</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Safety Guidelines</h3>
              <ul>
                <li><strong>Protect Personal Info:</strong> Don't share phone/email too early</li>
                <li><strong>Meet in Public:</strong> First meetings should be in public places</li>
                <li><strong>Trust Your Instincts:</strong> If something feels off, it probably is</li>
                <li><strong>Verify Profiles:</strong> Look for photo-verified badges</li>
                <li><strong>Report Concerns:</strong> Use the report feature for suspicious activity</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Red Flags to Watch For</h3>
              <ul>
                <li>Requests for money or financial help</li>
                <li>Pushing to move conversation off-platform immediately</li>
                <li>Incomplete or vague profiles</li>
                <li>Aggressive or inappropriate messages</li>
                <li>Refusal to video chat or meet in person</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Blocking & Reporting</h3>
              <p>To block someone:</p>
              <ol>
                <li>Go to their profile</li>
                <li>Click "⛔ Block User"</li>
                <li>They can't view your profile or contact you</li>
              </ol>
              <p>To report:</p>
              <ol>
                <li>Click "🚨 Report Profile"</li>
                <li>Select reason (spam, harassment, fake profile, etc.)</li>
                <li>Our team reviews within 24 hours</li>
              </ol>
            </div>

            <div className="help-tip">
              <strong>⚠️ Important:</strong> Never send money to someone you haven't met in person. Genuine users will never ask for financial help!
            </div>
          </div>
        );

      case 'account':
        return (
          <div className="help-content">
            <h2>⚙️ Account Settings</h2>
            
            <div className="help-section">
              <h3>Account Management</h3>
              <ul>
                <li><strong>Change Password:</strong> Update your password regularly for security</li>
                <li><strong>Email Preferences:</strong> Control notification frequency</li>
                <li><strong>Privacy Settings:</strong> Manage profile visibility</li>
                <li><strong>Deactivate Account:</strong> Temporarily disable your profile</li>
                <li><strong>Delete Account:</strong> Permanently remove your data</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Notification Settings</h3>
              <p>Control what notifications you receive:</p>
              <ul>
                <li>New messages and chat activity</li>
                <li>Profile views and favorites</li>
                <li>New matches and compatibility updates</li>
                <li>Weekly match recommendations</li>
                <li>System updates and announcements</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Premium Features</h3>
              <p>Upgrade for enhanced features:</p>
              <ul>
                <li>Unlimited daily searches</li>
                <li>See who viewed your profile</li>
                <li>Advanced filters and sorting</li>
                <li>Priority customer support</li>
                <li>Highlighted profile in search results</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Keep your email updated to receive important notifications and password reset links!
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="help-content">
            <h2>❓ Frequently Asked Questions</h2>
            
            <div className="faq-item">
              <h3>Q: Is L3V3L Matches free to use?</h3>
              <p><strong>A:</strong> Yes! Basic features are completely free. Premium features are available for enhanced experience.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How does L3V3L matching work?</h3>
              <p><strong>A:</strong> L3V3L uses AI to analyze compatibility across multiple dimensions: values, lifestyle, demographics, and preferences. Scores range from 0-100%.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Why can't I see certain profiles?</h3>
              <p><strong>A:</strong> This is a heterosexual platform - you'll only see opposite-gender profiles. Also, paused/hidden profiles won't appear in search.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How do I get more profile views?</h3>
              <p><strong>A:</strong> Complete your profile, add quality photos, update regularly, and respond to messages promptly. Active users rank higher!</p>
            </div>

            <div className="faq-item">
              <h3>Q: Can I hide my profile temporarily?</h3>
              <p><strong>A:</strong> Yes! Go to Profile Settings → Pause Profile. Your profile will be hidden but data is saved.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How do I delete my account?</h3>
              <p><strong>A:</strong> Go to Account Settings → Delete Account. This is permanent and cannot be undone.</p>
            </div>

            <div className="faq-item">
              <h3>Q: What if I forgot my password?</h3>
              <p><strong>A:</strong> Click "Forgot Password" on login page. We'll send a reset link to your registered email.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How do I report a fake profile?</h3>
              <p><strong>A:</strong> Go to the profile → Click "Report" → Select reason. Our team reviews all reports within 24 hours.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Can I save my search criteria?</h3>
              <p><strong>A:</strong> Yes! After setting filters, click "Save Search". Access saved searches anytime from the Saved tab.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Still need help?</h3>
              <p><strong>A:</strong> Contact us at support@l3v3lmatches.com or use the chat support in your dashboard.</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="help-page">
      <div className="help-header">
        <button className="back-button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>📚 Help Center</h1>
        <p>Learn how to make the most of L3V3L Matches</p>
      </div>

      <div className="help-container">
        <div className="help-sidebar">
          <nav className="help-nav">
            {sections.map(section => (
              <button
                key={section.id}
                className={`help-nav-item ${activeSection === section.id ? 'active' : ''}`}
                onClick={() => setActiveSection(section.id)}
              >
                <span className="nav-icon">{section.icon}</span>
                <span className="nav-title">{section.title}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="help-main">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default HelpPage;
