import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PIIRequestModal from "./PIIRequestModal";
import "./Profile.css";

const Profile = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  
  // PII Access states
  const [piiAccess, setPiiAccess] = useState({
    images: false,
    contact_info: false,
    dob: false
  });
  const [showPIIRequestModal, setShowPIIRequestModal] = useState(false);
  
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/profile/${username}`);
        setUser(res.data);
        
        // Check if this is the current user's profile
        setIsOwnProfile(currentUsername === username);
        
        // Track profile view (only if viewing someone else's profile)
        if (currentUsername && currentUsername !== username) {
          try {
            await api.post('/profile-views', {
              profileUsername: username,
              viewedByUsername: currentUsername
            });
          } catch (viewErr) {
            // Silently fail - don't block profile loading if tracking fails
            console.error("Error tracking profile view:", viewErr);
          }
          
          // Check PII access
          await checkPIIAccess();
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Unable to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  const checkPIIAccess = async () => {
    if (!currentUsername || isOwnProfile) return;
    
    try {
      const [imagesRes, contactRes, dobRes] = await Promise.all([
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=images`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=contact_info`),
        api.get(`/pii-access/check?requester=${currentUsername}&profile_owner=${username}&access_type=dob`)
      ]);
      
      setPiiAccess({
        images: imagesRes.data.hasAccess,
        contact_info: contactRes.data.hasAccess,
        dob: dobRes.data.hasAccess
      });
    } catch (err) {
      console.error("Error checking PII access:", err);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleEditProfile = () => {
    navigate('/edit-profile');
  };

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!user) return <p>No profile found.</p>;

  const age = user.dob ? calculateAge(user.dob) : null;

  return (
    <div className="container mt-4">
      <div className="profile-header">
        <h2>{user.firstName} {user.lastName}</h2>
        {isOwnProfile && (
          <button 
            className="btn-edit-profile"
            onClick={handleEditProfile}
            title="Edit Profile"
          >
            <span>✏️</span>
            <span>Edit Profile</span>
          </button>
        )}
      </div>

      {/* PII Request Button (only for others' profiles) */}
      {!isOwnProfile && (
        <div className="pii-request-section">
          <button
            className="btn-request-access"
            onClick={() => setShowPIIRequestModal(true)}
          >
            🔒 Request Private Information Access
          </button>
          <p className="pii-hint">Request access to photos, contact info, or date of birth</p>
        </div>
      )}
      
      {/* Profile Images Section */}
      <div className="profile-section">
        <h3>📷 Photos</h3>
        {isOwnProfile || piiAccess.images ? (
          user.images?.length > 0 ? (
            <div
              id="profileCarousel"
              className="carousel slide profile-carousel"
              data-bs-ride="carousel"
            >
              <div className="carousel-inner">
                {user.images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`carousel-item ${idx === 0 ? "active" : ""}`}
                  >
                    <img
                      src={img}
                      className="d-block w-100"
                      alt={`Slide ${idx + 1}`}
                      style={{ maxHeight: "500px", objectFit: "cover" }}
                    />
                  </div>
                ))}
              </div>
              <button
                className="carousel-control-prev"
                type="button"
                data-bs-target="#profileCarousel"
                data-bs-slide="prev"
              >
                <span className="carousel-control-prev-icon" aria-hidden="true" />
                <span className="visually-hidden">Previous</span>
              </button>
              <button
                className="carousel-control-next"
                type="button"
                data-bs-target="#profileCarousel"
                data-bs-slide="next"
              >
                <span className="carousel-control-next-icon" aria-hidden="true" />
                <span className="visually-hidden">Next</span>
              </button>
            </div>
          ) : (
            <p className="no-data">No photos available</p>
          )
        ) : (
          <div className="pii-locked">
            <div className="lock-icon">🔒</div>
            <p>Photos are private</p>
            <button
              className="btn-request-small"
              onClick={() => setShowPIIRequestModal(true)}
            >
              Request Access
            </button>
          </div>
        )}
      </div>

      {/* Basic Info (Always visible) */}
      <div className="profile-section">
        <h3>👤 Basic Information</h3>
        <div className="profile-info">
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Sex:</strong> {user.sex}</p>
          {age && <p><strong>Age:</strong> {age} years</p>}
          <p><strong>Height:</strong> {user.height}</p>
          <p><strong>Location:</strong> {user.location}</p>
          <p><strong>Education:</strong> {user.education}</p>
          <p><strong>Working Status:</strong> {user.workingStatus}</p>
          {user.workplace && <p><strong>Workplace:</strong> {user.workplace}</p>}
          <p><strong>Citizenship Status:</strong> {user.citizenshipStatus}</p>
        </div>
      </div>

      {/* Contact Information (PII Protected) */}
      <div className="profile-section">
        <h3>📧 Contact Information</h3>
        {isOwnProfile || piiAccess.contact_info ? (
          <div className="profile-info">
            <p><strong>Contact Number:</strong> {user.contactNumber || 'Not provided'}</p>
            <p><strong>Contact Email:</strong> {user.contactEmail || 'Not provided'}</p>
          </div>
        ) : (
          <div className="pii-locked">
            <div className="lock-icon">🔒</div>
            <p>Contact information is private</p>
            <button
              className="btn-request-small"
              onClick={() => setShowPIIRequestModal(true)}
            >
              Request Access
            </button>
          </div>
        )}
      </div>

      {/* Date of Birth (PII Protected) */}
      <div className="profile-section">
        <h3>🎂 Date of Birth</h3>
        {isOwnProfile || piiAccess.dob ? (
          <div className="profile-info">
            <p><strong>Date of Birth:</strong> {user.dob ? new Date(user.dob).toLocaleDateString() : 'Not provided'}</p>
            {age && <p><strong>Age:</strong> {age} years</p>}
          </div>
        ) : (
          <div className="pii-locked">
            <div className="lock-icon">🔒</div>
            <p>Date of birth is private (Age: {age || 'Unknown'})</p>
            <button
              className="btn-request-small"
              onClick={() => setShowPIIRequestModal(true)}
            >
              Request Access
            </button>
          </div>
        )}
      </div>

      {/* Preferences & Background (Always visible) */}
      <div className="profile-section">
        <h3>💭 Preferences & Background</h3>
        <div className="profile-info">
          <p><strong>Caste Preference:</strong> {user.castePreference}</p>
          <p><strong>Eating Preference:</strong> {user.eatingPreference}</p>
          <p><strong>Family Background:</strong> {user.familyBackground}</p>
          <p><strong>About:</strong> {user.aboutYou}</p>
          <p><strong>Partner Preference:</strong> {user.partnerPreference}</p>
        </div>
      </div>

      {/* PII Request Modal */}
      <PIIRequestModal
        isOpen={showPIIRequestModal}
        profileUsername={username}
        profileName={`${user.firstName} ${user.lastName}`}
        onClose={() => setShowPIIRequestModal(false)}
        onSuccess={() => {
          alert('Request sent successfully!');
          checkPIIAccess(); // Refresh access status
        }}
      />
    </div>
  );
};

export default Profile;

