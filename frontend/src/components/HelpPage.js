import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HelpPage.css';

const HelpPage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('getting-started');

  const sections = [
    { id: 'getting-started', icon: '🚀', title: 'Getting Started' },
    { id: 'dashboard', icon: '🎯', title: 'Your Dashboard' },
    { id: 'search', icon: '🔍', title: 'Search & Filters' },
    { id: 'l3v3l', icon: '🦋', title: 'L3V3L Matching' },
    { id: 'profile', icon: '👤', title: 'Your Profile' },
    { id: 'connections', icon: '💬', title: 'Connections & Chat' },
    { id: 'contact-access', icon: '🔐', title: 'Contact & Photo Access' },
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
              <h3>Welcome!</h3>
              <p>L3V3L Matches helps you discover compatible profiles, organize your shortlists, and chat — all in one place.</p>
              <p>If you’re new, don’t worry. This guide is written for everyday users (no technical knowledge needed).</p>
            </div>

            <div className="help-section">
              <h3>Quick Start (5 Steps)</h3>
              <ol>
                <li>
                  <strong>Create your account & verify your email:</strong>
                  <p>After you register, check your inbox for a verification email. Verification helps keep the community real and safe.</p>
                </li>
                <li>
                  <strong>Complete your profile:</strong>
                  <p>Go to <strong>Edit Profile</strong> and fill out the key sections (basic info, background, and preferences). More detail = better matching.</p>
                </li>
                <li>
                  <strong>Add photos (optional but recommended):</strong>
                  <p>Photos increase trust and responses. You can also keep photos private and share them later (see “Contact & Photo Access”).</p>
                </li>
                <li>
                  <strong>Search for matches:</strong>
                  <p>Go to <strong>Search</strong> and start broad (age + location + a keyword). Then refine with filters and L3V3L score.</p>
                </li>
                <li>
                  <strong>Organize and connect:</strong>
                  <p>Use <strong>Favorite</strong> and <strong>Shortlist</strong> to organize profiles. When you’re ready, use <strong>Message</strong> to start a conversation.</p>
                </li>
              </ol>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> If search results feel “empty”, loosen your filters first (age range, location, keyword). Then narrow down.
            </div>
          </div>
        );

      case 'dashboard':
        return (
          <div className="help-content">
            <h2>🎯 Your Dashboard</h2>
            
            <div className="help-section">
              <h3>Dashboard Overview</h3>
              <p>Your Dashboard is your home base — a quick snapshot of your activity, interactions, and things that need your attention. Everything you need is organized into easy-to-scan sections.</p>
            </div>

            <div className="help-section">
              <h3>🔐 MFA Security Banner</h3>
              <p>At the top of your dashboard, you may see a security banner prompting you to enable Multi-Factor Authentication (MFA):</p>
              <ul>
                <li><strong>Why enable MFA?</strong> Adds an extra layer of security to your account beyond just your password</li>
                <li><strong>How it works:</strong> After enabling, you'll need to enter a code from your authenticator app when logging in</li>
                <li><strong>Enable MFA button:</strong> Click to set up MFA using an authenticator app (Google Authenticator, Authy, etc.)</li>
                <li><strong>Dismiss (✕):</strong> Close the banner temporarily — it will appear again on your next login session</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>� Photo Upload Reminder Banner</h3>
              <p>If you haven't uploaded any photos yet, you'll see a reminder banner:</p>
              <ul>
                <li><strong>Why upload photos?</strong> Profiles with photos receive up to 10x more views and engagement</li>
                <li><strong>Upload Photos button:</strong> Takes you directly to Edit Profile to add your photos</li>
                <li><strong>Dismiss (✕):</strong> Close the banner for this session — it will appear again next time if you still have no photos</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>⏸️ Pause Status Banner</h3>
              <p>If your profile is paused (taking a break), you'll see a prominent banner:</p>
              <ul>
                <li><strong>What it shows:</strong> Confirms your profile is paused and hidden from searches</li>
                <li><strong>Auto-unpause date:</strong> If you set an end date, it shows when your profile will automatically reactivate</li>
                <li><strong>Un-Pause Now button:</strong> Click to immediately reactivate your profile and return to active status</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🕐 Last Login Info</h3>
              <p>Shows when you last logged in (e.g., "Last login: 2 days ago"). Helps you track your activity patterns.</p>
            </div>

            <div className="help-section">
              <h3>� Stats Overview Cards (Clickable)</h3>
              <p>Five large stat cards showing your key metrics — click any card to see detailed information:</p>
              <ul>
                <li><strong>👁️ Profile Views:</strong> Total views + unique viewers count. Click to see WHO viewed your profile with timestamps</li>
                <li><strong>💖 Favorited By:</strong> Number of people who added you to their favorites. Click to see the list of admirers</li>
                <li><strong>💬 Conversations:</strong> Active message threads. Click to see all your conversations in a modal</li>
                <li><strong>📷 Photo Requests:</strong> Your outgoing photo/contact access requests. Click to manage pending requests</li>
                <li><strong>📥 Contact Requests:</strong> Incoming requests from others waiting for YOUR approval. Click to approve/deny requests</li>
              </ul>
              <p><strong>Note:</strong> The Contact Requests card glows/highlights when you have pending requests to review!</p>
            </div>

            <div className="help-section">
              <h3>📋 My Activities Column</h3>
              <p>The left column shows YOUR activities and lists. Click the header to expand/collapse:</p>
              <ul>
                <li><strong>💬 Messages:</strong> Your conversations — click any card to open the chat</li>
                <li><strong>❤️ Favorites:</strong> Profiles you've favorited (auto-removed after 45 days of inactivity)</li>
                <li><strong>📋 Shortlists:</strong> Profiles you're seriously considering (auto-removed after 45 days)</li>
                <li><strong>� Photo Requests:</strong> Your outgoing PII/photo access requests with status</li>
                <li><strong>🚫 Search Exclude:</strong> Profiles you've marked as "Not Interested" — they won't appear in your searches</li>
              </ul>
              <p><strong>Drag & Drop:</strong> You can drag profiles between Favorites, Shortlists, and Exclusions to reorganize!</p>
            </div>

            <div className="help-section">
              <h3>� Others' Activities Column</h3>
              <p>The right column shows how OTHERS interact with you. Click the header to expand/collapse:</p>
              <ul>
                <li><strong>👁️ Profile Views:</strong> Who viewed your profile and when</li>
                <li><strong>📷 Photo Requests:</strong> Incoming access requests from others — approve or deny here</li>
                <li><strong>❤️ Favorites:</strong> People who have favorited YOUR profile (last 45 days)</li>
                <li><strong>📋 Shortlists:</strong> People who have shortlisted YOUR profile (last 45 days)</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>📝 Notes Feature</h3>
              <p>The Notes feature lets you keep private notes about profiles you're interested in. Only you can see your notes — they are never shared with other users.</p>
              <ul>
                <li><strong>What are Notes?</strong> Personal reminders and observations about profiles you've viewed</li>
                <li><strong>How to add a Note:</strong> Visit any profile and click the "Add Note" or 📝 icon to write your private note</li>
                <li><strong>Where to find Notes:</strong> Click the "Notes" tab in My Activities section on your Dashboard</li>
                <li><strong>Note count badge:</strong> Shows how many profiles you've written notes for</li>
                <li><strong>Edit or delete:</strong> You can update or remove notes at any time</li>
                <li><strong>Privacy:</strong> Notes are 100% private — the other person will never know you wrote a note about them</li>
              </ul>
              <p><strong>Use cases for Notes:</strong></p>
              <ul>
                <li>Remember key details from a profile ("Works at Google, loves hiking")</li>
                <li>Track conversation topics ("Discussed meeting next week")</li>
                <li>Note your impressions ("Very compatible, follow up soon")</li>
                <li>Keep track of important dates or facts mentioned in chats</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>� Exclusion (Not Interested) Feature</h3>
              <p>When you mark someone as "Not Interested", a confirmation modal shows what will be removed:</p>
              <ul>
                <li><strong>Preview modal:</strong> Shows count of messages, favorites, shortlists, and requests that will be deleted</li>
                <li><strong>Permanent action:</strong> Removes all interaction history with that person</li>
                <li><strong>Search hiding:</strong> The excluded profile will no longer appear in your search results</li>
                <li><strong>Notification:</strong> The other user receives a notification that a profile they were interested in is no longer available</li>
                <li><strong>Undo:</strong> You can remove someone from exclusions to see them in searches again</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>�🔔 Notification Ticker (Top Scrolling Bar)</h3>
              <p>The scrolling notification bar at the very top shows recent activity on your profile:</p>
              <ul>
                <li><strong>Profile views:</strong> "Neil Mishra viewed your profile 25d ago" — shows who viewed you and when</li>
                <li><strong>New matches:</strong> Notifications about new compatible profiles matching your saved searches</li>
                <li><strong>System alerts:</strong> Important platform announcements</li>
                <li><strong>Click to navigate:</strong> Click any notification to go directly to that profile or action</li>
                <li><strong>Dismiss (✕):</strong> Click the X to dismiss individual notifications</li>
                <li><strong>Auto-scroll:</strong> Notifications scroll automatically; hover to pause</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>⚡ Bottom Action Buttons</h3>
              <p>Fixed buttons at the bottom of the dashboard for quick actions:</p>
              <ul>
                <li><strong>⊞/☰ View Toggle:</strong> Switch between Card view and Row view for profile displays</li>
                <li><strong>🔄 Refresh:</strong> Reload all dashboard data without refreshing the entire page</li>
                <li><strong>⇲/⇱ Expand/Collapse All:</strong> Toggle all sections open or closed at once</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🦋 L3V3L Button (Header)</h3>
              <p>The purple "L3V3L" button in the header takes you to your AI-powered compatibility matches:</p>
              <ul>
                <li>See profiles ranked by compatibility score</li>
                <li>Get personalized match recommendations</li>
                <li>View detailed compatibility breakdowns</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🟢 Members Online Indicator</h3>
              <p>The green "X members online" badge shows how many users are currently active on the platform:</p>
              <ul>
                <li>Higher numbers mean more potential for real-time conversations</li>
                <li>Online users may respond to messages faster</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🔍 Quick Search & Actions (Header Icons)</h3>
              <p>The header contains quick action icons:</p>
              <ul>
                <li><strong>🔍 Search icon:</strong> Quick access to the search page</li>
                <li><strong>💬 Chat icon:</strong> Access your messages/conversations</li>
                <li><strong>👤 Profile avatar:</strong> Click to access your profile, settings, and logout</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🎴 User Cards & Kebab Menu</h3>
              <p>Each profile card in your dashboard has a kebab menu (⋮) with quick actions:</p>
              <ul>
                <li><strong>👁️ View Profile:</strong> Open the full profile page</li>
                <li><strong>💬 Message:</strong> Start or continue a conversation</li>
                <li><strong>❤️ Add/Remove Favorite:</strong> Toggle favorite status</li>
                <li><strong>📋 Add/Remove Shortlist:</strong> Toggle shortlist status</li>
                <li><strong>📷 Request Access:</strong> Request photo or contact info access</li>
                <li><strong>🚫 Not Interested:</strong> Add to exclusions (with confirmation)</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tips:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                <li>Check your Dashboard daily to stay on top of new views and requests</li>
                <li>Respond to Contact Requests promptly — it shows you're active and increases engagement!</li>
                <li>Use the bottom refresh button (🔄) to get the latest counts without reloading the entire page</li>
                <li>Enable MFA for better account security — it only takes a minute to set up</li>
                <li>Click the stat cards to see detailed lists (who viewed you, who favorited you, etc.)</li>
                <li>Drag and drop profiles between Favorites, Shortlists, and Exclusions to organize</li>
                <li>Use Notes to remember important details about profiles you're interested in</li>
                <li>Upload photos to get up to 10x more profile views!</li>
                <li>Favorites and Shortlists auto-expire after 45 days — take action on profiles you like!</li>
              </ul>
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="help-content">
            <h2>🔍 Search & Filters</h2>
            
            <div className="help-section">
              <h3>How Search Works</h3>
              <p>Search shows you profiles that match your filters. Think of filters like a shopping checklist — the more you add, the fewer results you'll see. Start broad and narrow down as needed.</p>
            </div>

            <div className="help-section">
              <h3>🎯 Profile ID Search (Direct Lookup)</h3>
              <p>If you know someone's exact Profile ID, you can find them instantly:</p>
              <ul>
                <li>Enter the Profile ID (e.g., <code>STHa9Lor</code>) in the <strong>Profile ID</strong> field</li>
                <li>Click <strong>Search</strong> — this bypasses all other filters</li>
                <li>Profile IDs are shown on each profile card and in the URL when viewing a profile</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🎚️ L3V3L Compatibility Score Slider</h3>
              <p>Filter matches by their compatibility score with you:</p>
              <ul>
                <li>Drag the slider to set a <strong>minimum compatibility percentage</strong></li>
                <li><strong>0%</strong> — Show all profiles (no filtering)</li>
                <li><strong>50-60%</strong> — Good starting point for more options</li>
                <li><strong>70%+</strong> — Focus on stronger compatibility matches</li>
                <li>Results update instantly as you move the slider</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>📝 Basic Filters (Always Visible)</h3>
              <p>These filters are always available at the top of the search page:</p>
              <ul>
                <li><strong>Keyword Search:</strong> Search across all profile fields — bio, interests, occupation, education, and more. Leave empty to see all matches.</li>
                <li><strong>Location:</strong> Filter by city, state, or region. Partial matches work (e.g., "CA" for California, "Bay" for Bay Area).</li>
                <li><strong>Age Range:</strong> Set minimum and maximum age (19-100). <em>Required for non-admin users.</em></li>
                <li><strong>Height Range:</strong> Set minimum and maximum height in feet and inches.</li>
                <li><strong>Days Back:</strong> Show only profiles created within the last X days — great for finding new members!</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>⚙️ Advanced Filters (Click "View More")</h3>
              <p>Click <strong>▼ View More</strong> to reveal additional filters:</p>
              <ul>
                <li><strong>Gender:</strong> Filter by gender preference (locked to opposite gender for regular users; admins can search all)</li>
                <li><strong>Body Type:</strong> Filter by body type preference</li>
                <li><strong>Occupation:</strong> Filter by profession or career field</li>
                <li><strong>Eating Preference:</strong> Vegetarian, non-vegetarian, vegan, eggetarian, etc.</li>
                <li><strong>Drinking:</strong> Never, socially, regularly, etc.</li>
                <li><strong>Smoking:</strong> Never, occasionally, regularly, etc.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>🔘 Action Buttons</h3>
              <ul>
                <li><strong>🔍 Search:</strong> Run the search with your current filters</li>
                <li><strong>🗑️ Clear / 🔄 Reset:</strong> Clear all filters (admins) or reset to your partner preference defaults (regular users)</li>
                <li><strong>💾 Save Search:</strong> Save your current filter combination for quick access later</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>💾 Saved Searches</h3>
              <p>Save your favorite filter combinations to run them again with one click:</p>
              <ol>
                <li>Set your desired filters</li>
                <li>Click <strong>💾 Save Search</strong></li>
                <li>Give your search a name (e.g., "Bay Area 25-30")</li>
                <li>Access saved searches from the sidebar or search page</li>
                <li>Get notified when new profiles match your saved search criteria!</li>
              </ol>
            </div>

            <div className="help-section">
              <h3>📊 Search Results</h3>
              <p>After searching, you'll see matching profiles displayed as cards:</p>
              <ul>
                <li>Each card shows the profile photo, name, age, location, and L3V3L score</li>
                <li>Click a card to view the full profile</li>
                <li>Use the ❤️ (Favorite), ⭐ (Shortlist), or 💬 (Message) buttons for quick actions</li>
                <li>Results are sorted by compatibility score by default</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tips:</strong>
              <ul style={{ marginTop: '8px', marginBottom: 0 }}>
                <li>Start with just <strong>Age Range + Location</strong>, then add more filters</li>
                <li>If you see too few results, remove some filters or lower the L3V3L score</li>
                <li>Use <strong>Days Back</strong> to discover newly joined members</li>
                <li>Save your most-used searches to save time</li>
              </ul>
            </div>
          </div>
        );

      case 'l3v3l':
        return (
          <div className="help-content">
            <h2>🦋 L3V3L Matching System</h2>
            
            <div className="help-section">
              <h3>What is L3V3L?</h3>
              <p>L3V3L is our compatibility score. It summarizes how well two profiles align based on multiple parts of the profile (values, preferences, lifestyle, and more).</p>
            </div>

            <div className="help-section">
              <h3>How L3V3L Scoring Works</h3>
              <div className="score-breakdown">
                <div className="score-item">
                  <strong>85-100%</strong> - Excellent Match 💕
                  <p>Very strong alignment across most categories.</p>
                </div>
                <div className="score-item">
                  <strong>70-84%</strong> - Great Match 💚
                  <p>Strong compatibility — a great place to start conversations.</p>
                </div>
                <div className="score-item">
                  <strong>50-69%</strong> - Good Match 👍
                  <p>Some strong overlaps, some differences. Worth exploring.</p>
                </div>
                <div className="score-item">
                  <strong>Below 50%</strong> - Low Compatibility
                  <p>Lower alignment. You can still connect if something stands out.</p>
                </div>
              </div>
            </div>

            <div className="help-section">
              <h3>What the Score Looks At</h3>
              <ul>
                <li><strong>Demographics:</strong> Age, location/region, education, occupation.</li>
                <li><strong>Partner preferences:</strong> Whether you match what each other is looking for.</li>
                <li><strong>Lifestyle:</strong> Habits and day-to-day preferences (when available).</li>
                <li><strong>Values & personality signals:</strong> Based on what’s written in the profile and preference fields.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>See the Breakdown</h3>
              <p>When you open a profile, you may see an L3V3L breakdown that explains the score. Use it as a guide — not a rule.</p>
              <ul>
                <li>Which areas are strongest</li>
                <li>Where there may be differences</li>
                <li>Helpful “reasons” that summarize why the match is recommended</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Use L3V3L score to prioritize, then read the profile carefully. A great profile fit beats a number.
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="help-content">
            <h2>👤 Your Profile</h2>
            
            <div className="help-section">
              <h3>Why Your Profile Matters</h3>
              <p>Your profile is what others use to decide whether to connect. The more complete and honest it is, the better your results.</p>
            </div>

            <div className="help-section">
              <h3>Editing Your Profile</h3>
              <ol>
                <li>
                  <strong>Basic Information:</strong>
                  <p>The basics that power search filters (age, height, region, etc.).</p>
                </li>
                <li>
                  <strong>About You:</strong>
                  <p>Write in simple, real language. What are you like day-to-day? What are you looking for?</p>
                </li>
                <li>
                  <strong>Education & Career:</strong>
                  <p>Your educational background and occupation</p>
                </li>
                <li>
                  <strong>Background & Preferences:</strong>
                  <p>Details that help people understand values and expectations.</p>
                </li>
                <li>
                  <strong>Lifestyle & Interests:</strong>
                  <p>Hobbies, eating preferences, habits</p>
                </li>
                <li>
                  <strong>Partner Preferences:</strong>
                  <p>This is used heavily in matching. If you’re too strict, you may see fewer results.</p>
                </li>
              </ol>
            </div>

            <div className="help-section">
              <h3>Photo Tips</h3>
              <ul>
                <li>Use clear, recent photos that look like you today.</li>
                <li>Avoid heavy filters (it reduces trust).</li>
                <li>If you prefer privacy, you can keep photos hidden and grant access later.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Collapsible Sections</h3>
              <p>On your profile page, sections can be expanded/collapsed. This helps keep long profiles readable.</p>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Update your profile occasionally (even small updates) — active profiles tend to get more engagement.
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
                <li><strong>Favorite:</strong> Save someone you like for quick access later.</li>
                <li><strong>Shortlist:</strong> Your “serious consideration” list.</li>
                <li><strong>Message:</strong> Start a conversation in the built-in chat.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Chat Features</h3>
              <ul>
                <li>Real-time messaging (messages appear instantly when you’re both online)</li>
                <li>Conversation history saved</li>
                <li>Online indicators (when available)</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Your Lists (Where to Find People Again)</h3>
              <ul>
                <li><strong>Favorites:</strong> Your saved profiles</li>
                <li><strong>Shortlist:</strong> Your top candidates</li>
                <li><strong>Not Interested / Exclusions:</strong> Profiles you don’t want to see again</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Not Interested (Exclusions)</h3>
              <p>If you don’t want to see a profile again, exclude it. Excluded profiles won’t show up in your search results.</p>
              <ol>
                <li>Go to their profile</li>
                <li>Choose the exclude/not-interested action</li>
                <li>Manage excluded profiles from the Exclusions page</li>
              </ol>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> Read the profile before messaging. Start with a polite, specific opener (mention something you liked).
            </div>
          </div>
        );

      case 'contact-access':
        return (
          <div className="help-content">
            <h2>🔐 Contact & Photo Access</h2>

            <div className="help-section">
              <h3>Why are some details hidden?</h3>
              <p>For privacy, sensitive details (like contact info and private photos) may be hidden by default. Access is shared only when the profile owner approves it.</p>
            </div>

            <div className="help-section">
              <h3>Requesting access (as the viewer)</h3>
              <ol>
                <li>Open the person’s profile</li>
                <li>Request the specific access you want (for example: photos or LinkedIn)</li>
                <li>Wait for approval (you’ll see the status as Pending/Approved)</li>
              </ol>
              <p>Once approved, you can view the newly available information directly on their profile.</p>
            </div>

            <div className="help-section">
              <h3>Approving requests (as the profile owner)</h3>
              <p>Go to <strong>PII Management</strong> to review requests.</p>
              <ul>
                <li><strong>Incoming:</strong> requests you received (you can approve or reject)</li>
                <li><strong>Outgoing:</strong> requests you sent (you can track status)</li>
                <li><strong>Received:</strong> access granted to you</li>
                <li><strong>Granted:</strong> access you granted to others</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> If you clicked an email button like “View Contact Info”, it should open the profile and expand the Contact section when access is granted.
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="help-content">
            <h2>🔒 Privacy & Safety</h2>
            
            <div className="help-section">
              <h3>Your Privacy Matters</h3>
              <p>Use privacy controls to stay safe while you get to know someone.</p>
              <ul>
                <li>Share contact info only when you’re ready (via request/approval)</li>
                <li>Exclude profiles you don’t want to see again</li>
                <li>Keep conversations inside the platform until trust is built</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Safety Guidelines</h3>
              <ul>
                <li><strong>Don’t share money or financial info:</strong> Never send money to someone you haven’t met and verified.</li>
                <li><strong>Meet in public first:</strong> Choose a safe, public place.</li>
                <li><strong>Trust your instincts:</strong> If something feels wrong, step back.</li>
                <li><strong>Move slowly:</strong> Verify details over time.</li>
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
              <h3>Managing Your Experience</h3>
              <p>If you don’t want to interact with someone, use exclusions and focus on profiles you feel comfortable with.</p>
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
                <li><strong>Password:</strong> You can change your password from Preferences.</li>
                <li><strong>Notifications:</strong> Choose which updates you want to receive.</li>
                <li><strong>Pause account:</strong> Take a break without deleting your profile.</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Notifications</h3>
              <p>You can control what you’re notified about (and by which channel). Common examples include:</p>
              <ul>
                <li>Messages</li>
                <li>Requests for private access (photos/contact)</li>
                <li>System announcements</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Pause Account (Taking a Break)</h3>
              <p>Pausing hides you from search and stops active interactions while keeping your profile saved. You can un-pause anytime.</p>
              <ul>
                <li>Hidden from searches while paused</li>
                <li>Profile stays saved</li>
                <li>You can still edit your profile</li>
              </ul>
            </div>

            <div className="help-tip">
              <strong>💡 Pro Tip:</strong> If you stop seeing profiles or messages, check whether your account is paused.
            </div>
          </div>
        );

      case 'faq':
        return (
          <div className="help-content">
            <h2>❓ Frequently Asked Questions</h2>
            
            <div className="faq-item">
              <h3>Q: Is L3V3L Matches free to use?</h3>
              <p><strong>A:</strong> Most core features are available to everyone. Some features may vary by account type or rollout.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How does L3V3L matching work?</h3>
              <p><strong>A:</strong> It combines multiple parts of the profile (preferences + lifestyle + demographics + written profile info) into a single score (0–100%).</p>
            </div>

            <div className="faq-item">
              <h3>Q: Why can't I see certain profiles?</h3>
              <p><strong>A:</strong> Usually it’s because filters are too strict, or the profile is not available in search (for example, paused or not active). Try widening your filters.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How do I get more profile views?</h3>
              <p><strong>A:</strong> Complete your profile, write a clear bio, add (or later share) photos, and respond to messages. Consistency helps.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Can I hide my profile temporarily?</h3>
              <p><strong>A:</strong> Yes — use the <strong>Pause Account</strong> option in Preferences. Your data stays saved.</p>
            </div>

            <div className="faq-item">
              <h3>Q: How do I delete my account?</h3>
              <p><strong>A:</strong> If the option is available in your account settings, it will permanently remove your profile. If you don’t see it, contact support for help.</p>
            </div>

            <div className="faq-item">
              <h3>Q: What if I forgot my password?</h3>
              <p><strong>A:</strong> Click "Forgot Password" on login page. We'll send a reset link to your registered email.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Why can’t I see photos or contact info?</h3>
              <p><strong>A:</strong> Some information is private by default. You can request access, and the profile owner can approve it in PII Management.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Can I save my search criteria?</h3>
              <p><strong>A:</strong> Yes! After setting filters, click "Save Search". Access saved searches anytime from the Saved tab.</p>
            </div>

            <div className="faq-item">
              <h3>Q: Still need help?</h3>
              <p><strong>A:</strong> Email <strong>support@l3v3lmatches.com</strong> and include your username plus a short description of the issue.</p>
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
