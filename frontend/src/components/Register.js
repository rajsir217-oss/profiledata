import React, { useState, useEffect, useRef } from "react";
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
    gender: "",
    height: "",
    castePreference: "",
    eatingPreference: "",
    location: "",
    education: "",
    workingStatus: "Yes",
    workplace: "",
    citizenshipStatus: "Citizen",
    familyBackground: "",
    aboutYou: "",
    partnerPreference: "",
    // New dating-app fields
    relationshipStatus: "",
    lookingFor: "",
    interests: "",
    languages: "",
    drinking: "",
    smoking: "",
    religion: "",
    bodyType: "",
    occupation: "",
    incomeRange: "",
    hasChildren: "",
    wantsChildren: "",
    pets: "",
    bio: "",
  });

  const [images, setImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedUser, setSavedUser] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const usernameCheckTimeout = useRef(null);
  const emailCheckTimeout = useRef(null);

  // Check if username exists in database
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      return; // Don't check if username is too short
    }

    try {
      setCheckingUsername(true);
      const response = await api.get(`/profile/${username}`);
      
      // If we get a response, username exists
      if (response.data) {
        setFieldErrors((prev) => ({ 
          ...prev, 
          username: "❌ Username already exists. Please choose another." 
        }));
      }
    } catch (error) {
      // 404 means username doesn't exist (available)
      if (error.response && error.response.status === 404) {
        setFieldErrors((prev) => {
          const newErrors = { ...prev };
          // Only clear the error if it was about username existing
          if (newErrors.username && newErrors.username.includes("already exists")) {
            delete newErrors.username;
          }
          return newErrors;
        });
      }
      // Other errors are ignored (network issues, etc.)
    } finally {
      setCheckingUsername(false);
    }
  };

  // Check if email exists in database (by trying to find any user with that email)
  const checkEmailAvailability = async (email) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return; // Don't check if email is invalid
    }

    try {
      setCheckingEmail(true);
      // We'll use the register endpoint validation - if email exists, backend will return 409
      // For now, we'll just show a note that email will be validated on submit
      // In a production app, you'd want a dedicated endpoint to check email availability
    } catch (error) {
      // Handle errors
    } finally {
      setCheckingEmail(false);
    }
  };

  // Debounced username check effect
  useEffect(() => {
    if (formData.username && touchedFields.username) {
      // Clear existing timeout
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }

      // Set new timeout to check username after 500ms of no typing
      usernameCheckTimeout.current = setTimeout(() => {
        checkUsernameAvailability(formData.username);
      }, 500);
    }

    // Cleanup
    return () => {
      if (usernameCheckTimeout.current) {
        clearTimeout(usernameCheckTimeout.current);
      }
    };
  }, [formData.username, touchedFields.username]);

  // Validation rules for each field
  const validateField = (name, value) => {
    let error = "";

    switch (name) {
      case "username":
        if (!value.trim()) {
          error = "Username is required";
        } else if (value.length < 3) {
          error = "Username must be at least 3 characters";
        } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
          error = "Username can only contain letters, numbers, and underscores";
        }
        break;

      case "password":
        if (!value) {
          error = "Password is required";
        } else if (value.length < 6) {
          error = "Password must be at least 6 characters";
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          error = "Password must contain uppercase, lowercase, and number";
        }
        break;

      case "firstName":
      case "lastName":
        if (!value.trim()) {
          error = `${name === "firstName" ? "First" : "Last"} name is required`;
        } else if (value.length < 2) {
          error = `${name === "firstName" ? "First" : "Last"} name must be at least 2 characters`;
        } else if (!/^[a-zA-Z\s]+$/.test(value)) {
          error = "Name can only contain letters and spaces";
        }
        break;

      case "contactNumber":
        if (!value.trim()) {
          error = "Contact number is required";
        } else if (!/^\+?[\d\s\-()]{10,}$/.test(value)) {
          error = "Enter a valid phone number (at least 10 digits)";
        }
        break;

      case "contactEmail":
        if (!value.trim()) {
          error = "Email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "Enter a valid email address";
        }
        break;

      case "dob":
        if (!value) {
          error = "Date of birth is required";
        } else {
          const birthDate = new Date(value);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          if (age < 18) {
            error = "You must be at least 18 years old";
          } else if (age > 100) {
            error = "Please enter a valid date of birth";
          }
        }
        break;

      case "height":
        if (!value.trim()) {
          error = "Height is required";
        } else if (!/^\d+(\.\d+)?['"]?\s?(ft|cm|m|inches?)?$/i.test(value)) {
          error = "Enter a valid height (e.g., 5'8\", 170cm)";
        }
        break;

      case "gender":
        if (!value) {
          error = "Please select a gender";
        }
        break;

      case "castePreference":
        if (!value.trim()) {
          error = "Caste preference is required";
        } else if (value.length < 2) {
          error = "Please enter a valid caste preference";
        }
        break;

      case "eatingPreference":
        if (!value) {
          error = "Please select an eating preference";
        }
        break;

      case "location":
        if (!value.trim()) {
          error = "Location is required";
        } else if (value.length < 2) {
          error = "Please enter a valid location";
        }
        break;

      case "education":
        if (!value.trim()) {
          error = "Education details are required";
        } else if (value.length < 5) {
          error = "Please provide more details about your education";
        }
        break;

      case "workingStatus":
        if (!value.trim()) {
          error = "Working status is required";
        }
        break;

      case "workplace":
        if (!value.trim()) {
          error = "Workplace information is required";
        } else if (value.length < 3) {
          error = "Please provide more details about your workplace";
        }
        break;

      case "familyBackground":
        if (!value.trim()) {
          error = "Family background is required";
        } else if (value.length < 10) {
          error = "Please provide more details (at least 10 characters)";
        }
        break;

      case "aboutYou":
        if (!value.trim()) {
          error = "Please tell us about yourself";
        } else if (value.length < 20) {
          error = "Please provide more details (at least 20 characters)";
        }
        break;

      case "partnerPreference":
        if (!value.trim()) {
          error = "Partner preference is required";
        } else if (value.length < 10) {
          error = "Please provide more details (at least 10 characters)";
        }
        break;

      default:
        break;
    }

    return error;
  };

  // Handle text input changes with validation
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Validate on change if field has been touched
    if (touchedFields[name]) {
      const error = validateField(name, value);
      setFieldErrors((prev) => ({ ...prev, [name]: error }));
    }
  };

  // Handle field blur (when user leaves the field)
  const handleBlur = (e) => {
    const { name, value } = e.target;
    setTouchedFields((prev) => ({ ...prev, [name]: true }));
    
    const error = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: error }));
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

    // Validate all fields before submission
    const errors = {};
    let hasErrors = false;
    const errorFields = [];

    Object.keys(formData).forEach((key) => {
      const error = validateField(key, formData[key]);
      if (error) {
        errors[key] = error;
        hasErrors = true;
        errorFields.push(key);
      }
    });

    // Mark all fields as touched so errors show up
    const allTouched = {};
    Object.keys(formData).forEach((key) => {
      allTouched[key] = true;
    });
    setTouchedFields(allTouched);
    setFieldErrors(errors);

    if (hasErrors) {
      const fieldList = errorFields.join(", ");
      setErrorMsg(`❌ Please fix validation errors in the following fields: ${fieldList}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

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
      const errorDetail = err.response?.data?.detail || err.response?.data?.error || "❌ Something went wrong.";
      
      // Handle specific backend validation errors
      if (errorDetail.includes("Username already exists")) {
        setFieldErrors((prev) => ({ ...prev, username: "❌ " + errorDetail }));
        setErrorMsg("❌ Username already exists. Please choose a different username.");
      } else if (errorDetail.includes("Email already registered")) {
        setFieldErrors((prev) => ({ ...prev, contactEmail: "❌ " + errorDetail }));
        setErrorMsg("❌ Email already registered. Please use a different email.");
      } else {
        setErrorMsg(errorDetail);
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
            <input 
              type="text" 
              className={`form-control ${fieldErrors.firstName && touchedFields.firstName ? 'is-invalid' : ''}`}
              name="firstName" 
              value={formData.firstName} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.firstName && touchedFields.firstName && (
              <div className="invalid-feedback d-block">{fieldErrors.firstName}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">lastName</label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.lastName && touchedFields.lastName ? 'is-invalid' : ''}`}
              name="lastName" 
              value={formData.lastName} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.lastName && touchedFields.lastName && (
              <div className="invalid-feedback d-block">{fieldErrors.lastName}</div>
            )}
          </div>
        </div>
        {/* Custom row for dob, height, gender, citizenshipStatus */}
        <div className="row mb-3">
          <div className="col-md-3">
            <label className="form-label">dob</label>
            <input 
              type="date" 
              className={`form-control ${fieldErrors.dob && touchedFields.dob ? 'is-invalid' : ''}`}
              name="dob" 
              value={formData.dob} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.dob && touchedFields.dob && (
              <div className="invalid-feedback d-block">{fieldErrors.dob}</div>
            )}
          </div>
          <div className="col-md-3">
            <label className="form-label">height</label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.height && touchedFields.height ? 'is-invalid' : ''}`}
              name="height" 
              value={formData.height} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.height && touchedFields.height && (
              <div className="invalid-feedback d-block">{fieldErrors.height}</div>
            )}
          </div>
          <div className="col-md-3">
            <label className="form-label me-3 mb-2">Gender<span className="text-danger">*</span></label>
            <div className="d-flex align-items-center">
              <div className="form-check form-check-inline">
                <input 
                  className="form-check-input" 
                  type="radio" 
                  name="gender" 
                  id="genderMale" 
                  value="Male" 
                  checked={formData.gender === "Male"} 
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required 
                />
                <label className="form-check-label" htmlFor="genderMale">Male</label>
              </div>
              <div className="form-check form-check-inline">
                <input 
                  className="form-check-input" 
                  type="radio" 
                  name="gender" 
                  id="genderFemale" 
                  value="Female" 
                  checked={formData.gender === "Female"} 
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required 
                />
                <label className="form-check-label" htmlFor="genderFemale">Female</label>
              </div>
            </div>
            {fieldErrors.gender && touchedFields.gender && (
              <div className="text-danger small mt-1">{fieldErrors.gender}</div>
            )}
          </div>
          <div className="col-md-3">
            <label className="form-label">Citizenship Status</label>
            <select 
              className="form-control" 
              name="citizenshipStatus" 
              value={formData.citizenshipStatus} 
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option>Citizen</option>
              <option>Greencard</option>
            </select>
          </div>
        </div>
        {/* Custom row for contactNumber and contactEmail */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">contactNumber</label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.contactNumber && touchedFields.contactNumber ? 'is-invalid' : ''}`}
              name="contactNumber" 
              value={formData.contactNumber} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.contactNumber && touchedFields.contactNumber && (
              <div className="invalid-feedback d-block">{fieldErrors.contactNumber}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">contactEmail</label>
            <input 
              type="email" 
              className={`form-control ${fieldErrors.contactEmail && touchedFields.contactEmail ? 'is-invalid' : ''}`}
              name="contactEmail" 
              value={formData.contactEmail} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.contactEmail && touchedFields.contactEmail && (
              <div className="invalid-feedback d-block">{fieldErrors.contactEmail}</div>
            )}
          </div>
        </div>
        {/* Custom row for username and password */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">
              username
              {checkingUsername && (
                <span className="text-muted small ms-2">
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Checking availability...
                </span>
              )}
            </label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.username && touchedFields.username ? 'is-invalid' : touchedFields.username && !checkingUsername && !fieldErrors.username ? 'is-valid' : ''}`}
              name="username" 
              value={formData.username} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.username && touchedFields.username && (
              <div className="invalid-feedback d-block">{fieldErrors.username}</div>
            )}
            {!fieldErrors.username && touchedFields.username && !checkingUsername && formData.username.length >= 3 && (
              <div className="valid-feedback d-block">✅ Username is available!</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">password</label>
            <input 
              type="password" 
              className={`form-control ${fieldErrors.password && touchedFields.password ? 'is-invalid' : ''}`}
              name="password" 
              value={formData.password} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.password && touchedFields.password && (
              <div className="invalid-feedback d-block">{fieldErrors.password}</div>
            )}
          </div>
        </div>
        {/* Custom row for castePreference, eatingPreference, and location */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">castePreference</label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.castePreference && touchedFields.castePreference ? 'is-invalid' : ''}`}
              name="castePreference" 
              value={formData.castePreference} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.castePreference && touchedFields.castePreference && (
              <div className="invalid-feedback d-block">{fieldErrors.castePreference}</div>
            )}
          </div>
          <div className="col-md-4">
            <label className="form-label">eatingPreference</label>
            <select 
              className={`form-control ${fieldErrors.eatingPreference && touchedFields.eatingPreference ? 'is-invalid' : ''}`}
              name="eatingPreference" 
              value={formData.eatingPreference} 
              onChange={handleChange}
              onBlur={handleBlur}
              required
            >
              <option value="">Select...</option>
              <option value="Vegetarian">Vegetarian</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Others">Others</option>
            </select>
            {fieldErrors.eatingPreference && touchedFields.eatingPreference && (
              <div className="invalid-feedback d-block">{fieldErrors.eatingPreference}</div>
            )}
          </div>
          <div className="col-md-4">
            <label className="form-label">location</label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.location && touchedFields.location ? 'is-invalid' : ''}`}
              name="location" 
              value={formData.location} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.location && touchedFields.location && (
              <div className="invalid-feedback d-block">{fieldErrors.location}</div>
            )}
          </div>
        </div>
        {/* Working Status */}
        <div className="mb-3">
          <label className="form-label me-3">Working Status<span className="text-danger">*</span></label>
          <div className="d-flex align-items-center">
            <div className="form-check form-check-inline">
              <input 
                className="form-check-input" 
                type="radio" 
                name="workingStatus" 
                id="workingStatusYes" 
                value="Yes" 
                checked={formData.workingStatus === "Yes"} 
                onChange={handleChange}
                onBlur={handleBlur}
                required 
              />
              <label className="form-check-label" htmlFor="workingStatusYes">Yes</label>
            </div>
            <div className="form-check form-check-inline">
              <input 
                className="form-check-input" 
                type="radio" 
                name="workingStatus" 
                id="workingStatusNo" 
                value="No" 
                checked={formData.workingStatus === "No"} 
                onChange={handleChange}
                onBlur={handleBlur}
                required 
              />
              <label className="form-check-label" htmlFor="workingStatusNo">No</label>
            </div>
          </div>
          {fieldErrors.workingStatus && touchedFields.workingStatus && (
            <div className="text-danger small mt-1">{fieldErrors.workingStatus}</div>
          )}
        </div>
        {/* Render all other fields as input or textarea as appropriate (deduplicated) */}
        {Object.entries(formData).map(([key, value]) => {
          // Exclude fields that are rendered explicitly elsewhere
          const excludedFields = [
            "username", "password", "firstName", "lastName", "contactNumber", "contactEmail", 
            "dob", "height", "gender", "citizenshipStatus", "workingStatus", 
            "castePreference", "eatingPreference", "location",
            // Exclude new dating-app fields (rendered in Dating Preferences section)
            "relationshipStatus", "lookingFor", "interests", "languages", 
            "drinking", "smoking", "religion", "bodyType", "occupation", 
            "incomeRange", "hasChildren", "wantsChildren", "pets", "bio"
          ];
          
          if (excludedFields.includes(key)) return null;
          
          if (["education", "aboutYou", "partnerPreference", "familyBackground", "workplace"].includes(key)) {
            return (
              <div className="mb-3" key={key}>
                <label className="form-label">{key}</label>
                <textarea 
                  className={`form-control ${fieldErrors[key] && touchedFields[key] ? 'is-invalid' : ''}`}
                  name={key} 
                  value={value} 
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required 
                  rows={3} 
                  style={{ resize: 'both' }} 
                />
                {fieldErrors[key] && touchedFields[key] && (
                  <div className="invalid-feedback d-block">{fieldErrors[key]}</div>
                )}
              </div>
            );
          }
          return (
            <div className="mb-3" key={key}>
              <label className="form-label">{key}</label>
              <input 
                type={key.includes("Email") ? "email" : "text"} 
                className={`form-control ${fieldErrors[key] && touchedFields[key] ? 'is-invalid' : ''}`}
                name={key} 
                value={value} 
                onChange={handleChange}
                onBlur={handleBlur}
                required 
              />
              {fieldErrors[key] && touchedFields[key] && (
                <div className="invalid-feedback d-block">{fieldErrors[key]}</div>
              )}
            </div>
          );
        })}
        
        {/* Dating App Specific Fields */}
        <h5 className="mt-4 mb-3 text-primary">Dating Preferences</h5>
        
        {/* Relationship Status & Looking For */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Relationship Status</label>
            <select
              className={`form-control ${fieldErrors.relationshipStatus && touchedFields.relationshipStatus ? 'is-invalid' : ''}`}
              name="relationshipStatus"
              value={formData.relationshipStatus}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Single">Single</option>
              <option value="Divorced">Divorced</option>
              <option value="Widowed">Widowed</option>
              <option value="Separated">Separated</option>
            </select>
            {fieldErrors.relationshipStatus && touchedFields.relationshipStatus && (
              <div className="invalid-feedback d-block">{fieldErrors.relationshipStatus}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Looking For</label>
            <select
              className={`form-control ${fieldErrors.lookingFor && touchedFields.lookingFor ? 'is-invalid' : ''}`}
              name="lookingFor"
              value={formData.lookingFor}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Serious Relationship">Serious Relationship</option>
              <option value="Marriage">Marriage</option>
              <option value="Casual Dating">Casual Dating</option>
              <option value="Friendship">Friendship</option>
            </select>
            {fieldErrors.lookingFor && touchedFields.lookingFor && (
              <div className="invalid-feedback d-block">{fieldErrors.lookingFor}</div>
            )}
          </div>
        </div>

        {/* Religion & Body Type */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Religion</label>
            <select
              className={`form-control ${fieldErrors.religion && touchedFields.religion ? 'is-invalid' : ''}`}
              name="religion"
              value={formData.religion}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Hindu">Hindu</option>
              <option value="Muslim">Muslim</option>
              <option value="Christian">Christian</option>
              <option value="Sikh">Sikh</option>
              <option value="Buddhist">Buddhist</option>
              <option value="Jain">Jain</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            {fieldErrors.religion && touchedFields.religion && (
              <div className="invalid-feedback d-block">{fieldErrors.religion}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Body Type</label>
            <select
              className={`form-control ${fieldErrors.bodyType && touchedFields.bodyType ? 'is-invalid' : ''}`}
              name="bodyType"
              value={formData.bodyType}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Slim">Slim</option>
              <option value="Athletic">Athletic</option>
              <option value="Average">Average</option>
              <option value="Curvy">Curvy</option>
              <option value="Heavyset">Heavyset</option>
            </select>
            {fieldErrors.bodyType && touchedFields.bodyType && (
              <div className="invalid-feedback d-block">{fieldErrors.bodyType}</div>
            )}
          </div>
        </div>

        {/* Drinking & Smoking */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Drinking</label>
            <select
              className={`form-control ${fieldErrors.drinking && touchedFields.drinking ? 'is-invalid' : ''}`}
              name="drinking"
              value={formData.drinking}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Never">Never</option>
              <option value="Socially">Socially</option>
              <option value="Regularly">Regularly</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            {fieldErrors.drinking && touchedFields.drinking && (
              <div className="invalid-feedback d-block">{fieldErrors.drinking}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Smoking</label>
            <select
              className={`form-control ${fieldErrors.smoking && touchedFields.smoking ? 'is-invalid' : ''}`}
              name="smoking"
              value={formData.smoking}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Never">Never</option>
              <option value="Socially">Socially</option>
              <option value="Regularly">Regularly</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            {fieldErrors.smoking && touchedFields.smoking && (
              <div className="invalid-feedback d-block">{fieldErrors.smoking}</div>
            )}
          </div>
        </div>

        {/* Has Children & Wants Children */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Has Children</label>
            <select
              className={`form-control ${fieldErrors.hasChildren && touchedFields.hasChildren ? 'is-invalid' : ''}`}
              name="hasChildren"
              value={formData.hasChildren}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            {fieldErrors.hasChildren && touchedFields.hasChildren && (
              <div className="invalid-feedback d-block">{fieldErrors.hasChildren}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Wants Children</label>
            <select
              className={`form-control ${fieldErrors.wantsChildren && touchedFields.wantsChildren ? 'is-invalid' : ''}`}
              name="wantsChildren"
              value={formData.wantsChildren}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Select...</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="Maybe">Maybe</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            {fieldErrors.wantsChildren && touchedFields.wantsChildren && (
              <div className="invalid-feedback d-block">{fieldErrors.wantsChildren}</div>
            )}
          </div>
        </div>

        {/* Pets */}
        <div className="mb-3">
          <label className="form-label">Pets</label>
          <select
            className={`form-control ${fieldErrors.pets && touchedFields.pets ? 'is-invalid' : ''}`}
            name="pets"
            value={formData.pets}
            onChange={handleChange}
            onBlur={handleBlur}
          >
            <option value="">Select...</option>
            <option value="Dog">Dog</option>
            <option value="Cat">Cat</option>
            <option value="Both">Both</option>
            <option value="Other">Other</option>
            <option value="None">None</option>
          </select>
          {fieldErrors.pets && touchedFields.pets && (
            <div className="invalid-feedback d-block">{fieldErrors.pets}</div>
          )}
        </div>

        {/* Occupation & Income Range */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Occupation</label>
            <input
              type="text"
              className={`form-control ${fieldErrors.occupation && touchedFields.occupation ? 'is-invalid' : ''}`}
              name="occupation"
              value={formData.occupation}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="e.g., Software Engineer"
            />
            {fieldErrors.occupation && touchedFields.occupation && (
              <div className="invalid-feedback d-block">{fieldErrors.occupation}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Income Range (Optional)</label>
            <select
              className={`form-control ${fieldErrors.incomeRange && touchedFields.incomeRange ? 'is-invalid' : ''}`}
              name="incomeRange"
              value={formData.incomeRange}
              onChange={handleChange}
              onBlur={handleBlur}
            >
              <option value="">Prefer not to say</option>
              <option value="Under $50k">Under $50k</option>
              <option value="$50k - $75k">$50k - $75k</option>
              <option value="$75k - $100k">$75k - $100k</option>
              <option value="$100k - $150k">$100k - $150k</option>
              <option value="Over $150k">Over $150k</option>
            </select>
            {fieldErrors.incomeRange && touchedFields.incomeRange && (
              <div className="invalid-feedback d-block">{fieldErrors.incomeRange}</div>
            )}
          </div>
        </div>

        {/* Interests */}
        <div className="mb-3">
          <label className="form-label">Interests & Hobbies</label>
          <input
            type="text"
            className={`form-control ${fieldErrors.interests && touchedFields.interests ? 'is-invalid' : ''}`}
            name="interests"
            value={formData.interests}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g., Reading, Hiking, Cooking, Travel"
          />
          <small className="text-muted">Separate with commas</small>
          {fieldErrors.interests && touchedFields.interests && (
            <div className="invalid-feedback d-block">{fieldErrors.interests}</div>
          )}
        </div>

        {/* Languages */}
        <div className="mb-3">
          <label className="form-label">Languages Spoken</label>
          <input
            type="text"
            className={`form-control ${fieldErrors.languages && touchedFields.languages ? 'is-invalid' : ''}`}
            name="languages"
            value={formData.languages}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="e.g., English, Spanish, Hindi"
          />
          <small className="text-muted">Separate with commas</small>
          {fieldErrors.languages && touchedFields.languages && (
            <div className="invalid-feedback d-block">{fieldErrors.languages}</div>
          )}
        </div>

        {/* Bio */}
        <div className="mb-3">
          <label className="form-label">Bio / Tagline</label>
          <textarea
            className={`form-control ${fieldErrors.bio && touchedFields.bio ? 'is-invalid' : ''}`}
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={3}
            placeholder="A short tagline about yourself..."
            maxLength={200}
          />
          <small className="text-muted">{formData.bio.length}/200 characters</small>
          {fieldErrors.bio && touchedFields.bio && (
            <div className="invalid-feedback d-block">{fieldErrors.bio}</div>
          )}
        </div>

        {/* Image Upload */}
        <h5 className="mt-4 mb-3 text-primary">Profile Images</h5>
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
