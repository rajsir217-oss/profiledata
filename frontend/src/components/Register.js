import React, { useState } from "react";
import api from "../api";

const Register = () => {
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    firstName: "",
    lastName: "",
    contactNumber: "",
    contactEmail: "",
    dob: "",
    sex: "",
    height: "",
    castePreference: "",
    eatingPreference: "",
    location: "",
    education: "",
    workingStatus: "",
    workplace: "",
    citizenshipStatus: "Citizen",
    familyBackground: "",
    aboutYou: "",
    partnerPreference: ""
  });

  const [images, setImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedUser, setSavedUser] = useState(null);

  // Handle text input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle image selection with validation
  const handleImageChange = (e) => {
    setErrorMsg("");
    let files = Array.from(e.target.files);

    if (files.length > 5) {
      setErrorMsg("❌ You can upload up to 5 images only.");
      return;
    }

    for (let file of files) {
      if (!file.type.startsWith("image/")) {
        setErrorMsg("❌ Only image files are allowed.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg(`❌ ${file.name} is larger than 5MB.`);
        return;
      }
    }

    setImages(files);
    setPreviewIndex(0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSavedUser(null);

    const data = new FormData();
    for (const key in formData) {
      data.append(key, formData[key]);
    }
    images.forEach((img) => data.append("images", img));

    try {
      const res = await api.post("/register", data);
      setSuccessMsg(res.data.message);

      // Fetch the saved user profile from backend to get final image URLs
      const profileRes = await api.get(`/profile/${formData.username}`);

      setSavedUser(profileRes.data);

    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.error || "❌ Something went wrong.");
    }
  };

  return (
    <div className="card p-4 shadow">
      <h3>[Register Profile]</h3>
      {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        {/* Custom row for firstName and lastName */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">firstName</label>
            <input type="text" className="form-control" name="firstName" value={formData.firstName} onChange={handleChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">lastName</label>
            <input type="text" className="form-control" name="lastName" value={formData.lastName} onChange={handleChange} required />
          </div>
        </div>
        {/* Custom row for dob, height, sex, citizenshipStatus */}
        <div className="row mb-3">
          <div className="col-md-3">
            <label className="form-label">dob</label>
            <input type="date" className="form-control" name="dob" value={formData.dob} onChange={handleChange} required />
          </div>
          <div className="col-md-3">
            <label className="form-label">height</label>
            <input type="text" className="form-control" name="height" value={formData.height} onChange={handleChange} required />
          </div>
          <div className="col-md-3 d-flex align-items-center">
            <label className="form-label me-3 mb-0">Sex<span className="text-danger">*</span></label>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" name="sex" id="sexNone" value="" checked={formData.sex === ""} onChange={handleChange} required />
              <label className="form-check-label" htmlFor="sexNone">None</label>
            </div>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" name="sex" id="sexMale" value="Male" checked={formData.sex === "Male"} onChange={handleChange} required />
              <label className="form-check-label" htmlFor="sexMale">Male</label>
            </div>
            <div className="form-check form-check-inline">
              <input className="form-check-input" type="radio" name="sex" id="sexFemale" value="Female" checked={formData.sex === "Female"} onChange={handleChange} required />
              <label className="form-check-label" htmlFor="sexFemale">Female</label>
            </div>
          </div>
          <div className="col-md-3">
            <label className="form-label">Citizenship Status</label>
            <select className="form-control" name="citizenshipStatus" value={formData.citizenshipStatus} onChange={handleChange}>
              <option>Citizen</option>
              <option>Greencard</option>
            </select>
          </div>
        </div>
        {/* Custom row for contactNumber and contactEmail */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">contactNumber</label>
            <input type="text" className="form-control" name="contactNumber" value={formData.contactNumber} onChange={handleChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">contactEmail</label>
            <input type="email" className="form-control" name="contactEmail" value={formData.contactEmail} onChange={handleChange} required />
          </div>
        </div>
        {/* Custom row for username and password */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">username</label>
            <input type="text" className="form-control" name="username" value={formData.username} onChange={handleChange} required />
          </div>
          <div className="col-md-6">
            <label className="form-label">password</label>
            <input type="password" className="form-control" name="password" value={formData.password} onChange={handleChange} required />
          </div>
        </div>
        {/* Custom row for castePreference, eatingPreference, and location */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">castePreference</label>
            <input type="text" className="form-control" name="castePreference" value={formData.castePreference} onChange={handleChange} required />
          </div>
          <div className="col-md-4">
            <label className="form-label">eatingPreference</label>
            <select className="form-control" name="eatingPreference" value={formData.eatingPreference} onChange={handleChange} required>
              <option value="">Select...</option>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div className="col-md-4">
            <label className="form-label">location</label>
            <input type="text" className="form-control" name="location" value={formData.location} onChange={handleChange} required />
          </div>
        </div>
        {/* Render all other fields as input or textarea as appropriate (deduplicated) */}
        {Object.entries(formData).map(([key, value]) => {
          if (["username", "password", "firstName", "lastName", "contactNumber", "contactEmail", "dob", "height", "sex", "citizenshipStatus", "workingStatus", "castePreference", "eatingPreference", "location"].includes(key)) return null;
          if (["education", "aboutYou", "partnerPreference", "familyBackground", "workplace"].includes(key)) {
            return (
              <div className="mb-3" key={key}>
                <label className="form-label">{key}</label>
                <textarea className="form-control" name={key} value={value} onChange={handleChange} required rows={3} style={{ resize: 'both' }} />
              </div>
            );
          }
          return (
            <div className="mb-3" key={key}>
              <label className="form-label">{key}</label>
              <input type={key.includes("Email") ? "email" : "text"} className="form-control" name={key} value={value} onChange={handleChange} required />
            </div>
          );
        })}
        {/* Image Upload */}
        <div className="mb-3">
          <label>Upload Images (Max 5, 5MB each)</label>
          <input type="file" className="form-control" name="images" multiple accept="image/*" onChange={handleImageChange} />
        </div>
        {/* Local Preview */}
        {images.length > 0 && (
          <div className="mb-3 text-center">
            <img src={URL.createObjectURL(images[previewIndex])} alt="preview" className="img-thumbnail" width="200" height="200" />
            <div className="mt-2">
              <button type="button" className="btn btn-outline-primary me-2" onClick={() => setPreviewIndex((previewIndex - 1 + images.length) % images.length)}>
                ◀️
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={() => setPreviewIndex((previewIndex + 1) % images.length)}>
                ▶️
              </button>
            </div>
          </div>
        )}
        <button className="btn btn-success" type="submit">
          Create Profile
        </button>
      </form>
      {/* Show backend images after save */}
      {savedUser && savedUser.images?.length > 0 && (
        <div className="mt-4 text-center">
          <h5>Saved Profile Images (from backend)</h5>
          {savedUser.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`saved-${idx}`}
              className="img-thumbnail m-2"
              width="150"
              height="150"
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default Register;
