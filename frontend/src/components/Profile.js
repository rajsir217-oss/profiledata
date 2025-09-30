

import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";

const Profile = () => {
  const { username } = useParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(`/profile/${username}`);
        setUser(res.data);
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("Unable to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [username]);

  if (loading) return <p>Loading profile...</p>;
  if (error) return <p className="text-danger">{error}</p>;
  if (!user) return <p>No profile found.</p>;

  return (
    <div className="container mt-4">
      <h2>{user.firstName} {user.lastName}</h2>
      <p><strong>Username:</strong> {user.username}</p>
      <p><strong>Contact Number:</strong> {user.contactNumber}</p>
      <p><strong>Contact Email:</strong> {user.contactEmail}</p>
      <p><strong>Date of Birth:</strong> {user.dob ? new Date(user.dob).toLocaleDateString() : ""}</p>
      <p><strong>Sex:</strong> {user.sex}</p>
      <p><strong>Height:</strong> {user.height}</p>
      <p><strong>Caste Preference:</strong> {user.castePreference}</p>
      <p><strong>Eating Preference:</strong> {user.eatingPreference}</p>
      <p><strong>Location:</strong> {user.location}</p>
      <p><strong>Education:</strong> {user.education}</p>
      <p><strong>Working Status:</strong> {user.workingStatus}</p>
      <p><strong>Workplace:</strong> {user.workplace}</p>
      <p><strong>Citizenship Status:</strong> {user.citizenshipStatus}</p>
      <p><strong>Family Background:</strong> {user.familyBackground}</p>
      <p><strong>About You:</strong> {user.aboutYou}</p>
      <p><strong>Partner Preference:</strong> {user.partnerPreference}</p>
      <p><strong>Created At:</strong> {user.createdAt ? new Date(user.createdAt).toLocaleString() : ""}</p>
      <p><strong>Updated At:</strong> {user.updatedAt ? new Date(user.updatedAt).toLocaleString() : ""}</p>
      {user.images?.length > 0 && (
        <div
          id="profileCarousel"
          className="carousel slide"
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
      )}
    </div>
  );
};

export default Profile;

