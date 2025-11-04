import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import TabContainer from "./TabContainer";
import ImageManager from "./ImageManager";
import { EducationHistory, WorkExperience, TextAreaWithSamples, GenderSelector, Autocomplete } from "./shared";
import { US_STATES, US_CITIES_BY_STATE } from "../data/usLocations";
import SEO from "./SEO";
import { getPageSEO } from "../utils/seo";
import "./Register.css";
import "./Register2.css";

const Register2 = ({ mode = 'register', editUsername = null }) => {
  // Detect if we're in edit mode
  const isEditMode = mode === 'edit' || editUsername !== null;
  const pageSEO = getPageSEO('register');
  // Helper function to calculate age from DOB
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
  
  // Helper function to convert height to inches
  const heightToInches = (feet, inches) => {
    const f = parseInt(feet) || 0;
    const i = parseInt(inches) || 0;
    return (f * 12) + i;
  };
  
  // Helper function to convert inches to feet'inches" format
  const inchesToHeightString = (totalInches) => {
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}'${inches}"`;
  };

  // Store initial default values for comparison
  const defaultValues = {
    religion: "No Religion",
    languagesSpoken: ["English"],
    castePreference: "No Preference",
    eatingPreference: "No Preference",
    countryOfOrigin: "US",
    countryOfResidence: "US",
    state: "California",
    location: "San Francisco",
    citizenshipStatus: "Citizen",
    educationHistory: [{
      level: "Under Graduation",
      degree: "BS",
      institution: "One of the Top 10 Institution"
    }],
    workExperience: [{
      status: "current",
      description: "Marketing Manager in Health Care Sector",
      location: "San Francisco"
    }],
    familyBackground: "Loving nuclear family from Srinagar. Father is retired and mother is working professional. Have siblings.",
    aboutMe: "I am a entrepreneur based in Srinagar. Love to explore new places and cuisines. Seeking a travel buddy and life companion.",
    partnerPreference: "Looking for someone who is family-oriented and ambitious. Education and values are important to me.",
    partnerCriteria: {
      educationLevel: ["Bachelor's"],
      profession: ["Any"],
      languages: ["English"],
      religion: ["Any Religion"],
      caste: "No Preference",
      location: ["Any"],
      eatingPreference: ["Any"],
      familyType: ["Any"],
      familyValues: ["Moderate"]
    }
  };

  const [formData, setFormData] = useState({
    // Basic Information
    username: "",
    password: "",
    passwordConfirm: "",  // For validation only, not sent to backend
    firstName: "",
    lastName: "",
    contactNumber: "",
    contactEmail: "",
    smsOptIn: false,  // SMS notifications opt-in
    dateOfBirth: "",  // Renamed from dob
    gender: "",  // Renamed from sex
    heightFeet: "",  // Feet: 4-7
    heightInches: "0",  // Inches: 0-11, default to 0
    profileCreatedBy: "me",  // Who created this profile
    // Creator Information (for non-self profiles)
    creatorInfo: {
      fullName: "",
      relationship: "",
      notes: ""
    },
    // Preferences & Cultural Information
    religion: "No Religion",  // Default value
    languagesSpoken: ["English"],  // Array of languages, default English
    castePreference: "No Preference",  // Default "No Preference"
    eatingPreference: "No Preference",  // Default "No Preference"
    // Residential Information (Mandatory)
    countryOfOrigin: "US",  // Mandatory, default US
    countryOfResidence: "US",  // Mandatory, default US
    state: "California",  // Default based on residence
    location: "San Francisco",  // Default based on residence
    // USA-specific field
    citizenshipStatus: "Citizen",  // Relevant for USA only
    // India-specific fields (optional)
    caste: "",
    motherTongue: "",
    familyType: "",
    familyValues: "",
    // Educational Information
    educationHistory: [{
      level: "Under Graduation",
      degree: "BS",
      institution: "One of the Top 10 Institution"
    }],  // Array of education entries with default
    // Professional & Work Related Information
    workExperience: [{
      status: "current",
      description: "Marketing Manager in Health Care Sector",
      location: "San Francisco"
    }],  // Array of work experience entries with default
    linkedinUrl: "",
    // About Me and Partner Information
    familyBackground: "Loving nuclear family from Srinagar. Father is retired and mother is working professional. Have siblings.",
    aboutMe: "I am a entrepreneur based in Srinagar. Love to explore new places and cuisines. Seeking a travel buddy and life companion.",  // Renamed from aboutYou
    partnerPreference: "Looking for someone who is family-oriented and ambitious. Education and values are important to me.",
    // Partner Matching Criteria
    partnerCriteria: {
      ageRange: { min: "", max: "" }, // Legacy - kept for backward compatibility
      ageRangeRelative: { minOffset: 0, maxOffset: 5 }, // NEW: Relative age preference
      heightRange: {
        minFeet: "",
        minInches: "",
        maxFeet: "",
        maxInches: ""
      }, // Legacy
      heightRangeRelative: { minInches: 0, maxInches: 6 }, // NEW: Relative height in inches
      educationLevel: ["Bachelor's"],
      profession: ["Any"],
      languages: ["English"],
      religion: ["Any Religion"],
      caste: "No Preference",
      location: ["Any"],
      eatingPreference: ["Any"],
      familyType: ["Any"],
      familyValues: ["Moderate"]
    },
    // New dating-app fields
    relationshipStatus: "Single",
    lookingFor: "Serious Relationship",
    interests: "Reading, Hiking, cooking, travel",
    languages: "",
    drinking: "Socially",
    smoking: "Never",
    // religion moved to main preferences above
    bodyType: "Average",
    hasChildren: "No",
    wantsChildren: "Yes",
    pets: "None",
    bio: "Independent woman seeking a partner who respects my ambitions and shares my values.",
    // Legal consent fields
    agreedToAge: false,
    agreedToTerms: false,
    agreedToPrivacy: false,
    agreedToGuidelines: false,
    agreedToDataProcessing: false,
    agreedToMarketing: false,
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Invitation state
  const [invitationToken, setInvitationToken] = useState(null);
  const [, setInvitationData] = useState(null); // eslint-disable-line no-unused-vars
  const [, setLoadingInvitation] = useState(false); // eslint-disable-line no-unused-vars
  
  // ImageManager state - For registration, we only have new images (no existing)
  const [existingImages, setExistingImages] = useState([]); // Empty for new registration
  const [imagesToDelete, setImagesToDelete] = useState([]); // Not used in registration
  const [newImages, setNewImages] = useState([]); // New images to upload
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedUser, setSavedUser] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDraftModal, setShowDraftModal] = useState(false);
  const [draftData, setDraftData] = useState(null);
  const usernameCheckTimeout = useRef(null);

  // Helper function to get field CSS class based on value state
  const getFieldClass = (fieldName, value) => {
    // Check if field is empty
    const isEmpty = !value || value === "" || (Array.isArray(value) && value.length === 0);
    
    if (isEmpty) {
      return 'field-empty';
    }
    
    // Check if value matches default
    const defaultValue = defaultValues[fieldName];
    if (defaultValue !== undefined) {
      // Handle array comparison
      if (Array.isArray(defaultValue) && Array.isArray(value)) {
        const isDefault = JSON.stringify(defaultValue) === JSON.stringify(value);
        return isDefault ? 'field-default' : 'field-filled';
      }
      // Handle object comparison (for partnerCriteria)
      if (typeof defaultValue === 'object' && typeof value === 'object' && !Array.isArray(defaultValue)) {
        const isDefault = JSON.stringify(defaultValue) === JSON.stringify(value);
        return isDefault ? 'field-default' : 'field-filled';
      }
      // Handle simple value comparison
      const isDefault = defaultValue === value;
      return isDefault ? 'field-default' : 'field-filled';
    }
    
    // If no default exists and not empty, it's filled by user
    return 'field-filled';
  };

  // Sample description carousel states
  const [aboutMeSampleIndex, setAboutMeSampleIndex] = useState(0);  // Renamed from aboutYouSampleIndex
  const [partnerPrefSampleIndex, setPartnerPrefSampleIndex] = useState(0);
  const [bioSampleIndex, setBioSampleIndex] = useState(0);
  // familyBackgroundSampleIndex is now managed inside TextAreaWithSamples component

  // Reset bio sample index when gender changes
  useEffect(() => {
    setBioSampleIndex(0);
  }, [formData.gender]);

  // Hide topbar and remove body padding ONLY for registration (not edit mode)
  useEffect(() => {
    if (!isEditMode) {
      // Only hide topbar for registration
      const topbar = document.querySelector('.top-bar');
      if (topbar) {
        topbar.style.display = 'none';
      }
      
      // Remove any body padding/margin
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';
    }
    
    // Restore when leaving (only if we changed it)
    return () => {
      if (!isEditMode) {
        const topbar = document.querySelector('.top-bar');
        if (topbar) {
          topbar.style.display = 'flex';
        }
        document.body.style.overflow = 'auto';
      }
    };
  }, [isEditMode]);

  // Sample descriptions for "About Me"
  const aboutMeSamples = [  // Renamed from aboutYouSamples
    "I am a warm-hearted and family-oriented individual who values tradition while embracing modern perspectives. My friends describe me as compassionate, reliable, and someone with a great sense of humor. I enjoy meaningful conversations, weekend getaways, and trying new cuisines. In my free time, I love reading, cooking, and spending quality time with loved ones. I believe in honesty, respect, and building a strong foundation of friendship in a relationship.",
    
    "As a dedicated professional, I've built a successful career while maintaining a healthy work-life balance. I'm passionate about personal growth, fitness, and exploring new cultures through travel. I value deep connections and believe in the power of communication and understanding. Whether it's a quiet evening at home or an adventure in the mountains, I appreciate life's simple pleasures. I'm looking for someone who shares my values and is ready to build a beautiful future together.",
    
    "I'm an optimistic person who finds joy in life's little moments. My family means everything to me, and I cherish the values they've instilled in me. I have a curious mind and love learning new things, whether it's picking up a new hobby or exploring different perspectives. I enjoy cooking traditional dishes with a modern twist, practicing yoga, and volunteering in my community. I believe in mutual respect, trust, and supporting each other's dreams in a partnership.",
    
    "I would describe myself as down-to-earth, ambitious, and emotionally intelligent. My career keeps me engaged, but I always make time for family, friends, and personal interests. I'm passionate about music, art, and staying active through sports or outdoor activities. I value authenticity and believe that the best relationships are built on friendship, laughter, and shared values. I'm looking for a life partner who is equally committed to growing together while celebrating our individual strengths.",
    
    "I'm a creative soul with a practical approach to life. I balance my professional responsibilities with hobbies like photography, gardening, and exploring local food scenes. My friends appreciate my loyalty and my ability to listen without judgment. I come from a close-knit family and hope to create the same warmth in my own home someday. I value kindness, integrity, and a good sense of humor. Life's too short not to laugh, love, and make beautiful memories along the way."
  ];

  // Sample descriptions for "Partner Preference"
  const partnerPrefSamples = [
    "I'm seeking a life partner who values family, honesty, and mutual respect. Someone who is educated, career-oriented, and has a balanced approach to life. I appreciate a person who can engage in meaningful conversations and shares similar cultural values while being open-minded. A good sense of humor and the ability to handle life's ups and downs with grace are qualities I deeply admire. Most importantly, I'm looking for someone who believes in partnership, where we support each other's goals and grow together.",
    
    "I'm looking for someone who is kind-hearted, ambitious, and has strong family values. Education and career are important, but what matters most is finding someone with emotional maturity and excellent communication skills. I value a partner who enjoys both quiet evenings at home and occasional adventures exploring new places. Someone who respects traditions while embracing modern thinking would be a perfect match. Honesty, loyalty, and a positive outlook on life are qualities I hold dear in a potential life partner.",
    
    "My ideal partner is someone who is compassionate, well-educated, and has a strong sense of self. I appreciate independence but also value togetherness and teamwork in building a life. Someone who shares my love for family, respects my ambitions, and has their own passions and interests would be wonderful. I'm drawn to people who are genuine, have integrity, and can find humor in everyday situations. A partner who believes in equality, mutual growth, and creating a loving home together would be my perfect match.",
    
    "I'm seeking a partner who is emotionally intelligent, supportive, and shares similar values about family and relationships. Professional stability is important, but I'm more interested in someone's character, kindness, and ability to communicate openly. I appreciate someone who is health-conscious, enjoys staying active, and values personal growth. A great sense of humor, patience, and the ability to be both my best friend and life partner are qualities I'm looking for. Together, I hope we can build a relationship based on trust, love, and mutual respect.",
    
    "I envision a partner who is confident yet humble, successful yet grounded. Someone who values their roots while being open to new experiences and perspectives. I appreciate a person who can balance career ambitions with family priorities and knows the importance of quality time together. Shared values about honesty, loyalty, and commitment are essential to me. I'm looking for someone who can be my companion through life's journey—celebrating successes, supporting through challenges, and creating a warm, loving family together."
  ];

  // Sample descriptions for "Family Background"
  const familyBackgroundSamples = [
    "I come from a close-knit, traditional family that values education, respect, and strong moral principles. My parents have been wonderful role models, teaching me the importance of hard work, honesty, and compassion. We celebrate all festivals together and maintain strong bonds with extended family. My family is supportive of my career and personal choices while instilling cultural values. They believe in modern thinking while respecting traditions, and family gatherings are always filled with warmth and joy.",
    
    "I belong to a modern, progressive family that encourages independence and personal growth. My parents are both professionals who have always supported my education and career aspirations. We have a small, close family that values open communication and mutual respect. While we respect our cultural roots, we're also open to different perspectives and beliefs. Family is important to us, but we also believe in giving each other space to pursue individual dreams and passions.",
    
    "I come from a well-educated, middle-class family with strong values of integrity and kindness. My father is retired, and my mother is a homemaker who has been the pillar of our family. I have siblings who are all well-settled in their respective careers. We're a traditional yet modern family that believes in maintaining cultural heritage while embracing change. Family gatherings, festivals, and celebrations are an integral part of our lives, and we share a deep bond of love and support.",
    
    "My family is small but very loving and supportive. We believe in simplicity, honesty, and treating everyone with respect. My parents have always encouraged me to pursue my dreams while staying grounded in our values. We may not have elaborate celebrations, but we treasure quality time together. Education and good character have always been priorities in our household. My family is understanding and would welcome a life partner who shares similar values of respect and love.",
    
    "I belong to a large, joint family where traditions and togetherness are highly valued. We have regular family gatherings, celebrate all occasions with enthusiasm, and maintain strong connections with relatives. My family is well-respected in our community and places great importance on values like hospitality, respect for elders, and cultural traditions. At the same time, they're progressive in their thinking and supportive of individual choices. Growing up in such a nurturing environment has shaped my values and outlook on relationships and family life."
  ];

  // Sample descriptions for "Bio / Tagline" - Gender-specific
  const maleBioSamples = [
    "Family-oriented professional seeking genuine connection and lifelong partnership 💕",
    "Traditional values, modern outlook. Love travel, food, and meaningful conversations ✨",
    "Career-driven gentleman looking for my partner in crime and best friend 🌟",
    "Adventure seeker with strong family values. Let's create beautiful memories together 🎯",
    "Passionate about life, career, and family. Seeking someone who values honesty and respect 💫"
  ];

  const femaleBioSamples = [
    "Independent woman seeking a partner who respects my ambitions and shares my values 💕",
    "Traditional values with modern dreams. Love exploring new places and cultures ✨",
    "Strong, compassionate soul looking for my partner in crime and best friend 🌟",
    "Adventure seeker with family at heart. Let's build beautiful memories together 🎯",
    "Passionate about career, family, and genuine connections. Looking for mutual respect and love 💫"
  ];

  // Get appropriate bio samples based on selected gender
  const bioSamples = formData.gender === 'Female' ? femaleBioSamples : maleBioSamples;

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

  // Email availability check is handled by backend during registration

  // Generate username from first and last name
  const generateUsername = (firstName, lastName) => {
    if (!firstName || !lastName) return '';
    
    // Get 3 random characters from firstName
    const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
    const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');
    
    if (cleanFirst.length < 3 || cleanLast.length < 3) return '';
    
    // Get 3 random characters from first name
    let firstPart = '';
    const firstChars = cleanFirst.split('');
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * firstChars.length);
      firstPart += firstChars[randomIndex];
      firstChars.splice(randomIndex, 1); // Remove to avoid duplicates
    }
    
    // Get 3 random characters from last name
    let lastPart = '';
    const lastChars = cleanLast.split('');
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * lastChars.length);
      lastPart += lastChars[randomIndex];
      lastChars.splice(randomIndex, 1);
    }
    
    // Generate 3 random digits
    const randomDigits = Math.floor(100 + Math.random() * 900); // 100-999
    
    return `${firstPart}${lastPart}${randomDigits}`;
  };

  // Auto-generate username when first/last name changes
  useEffect(() => {
    if (formData.firstName && formData.lastName && !formData.username) {
      const generatedUsername = generateUsername(formData.firstName, formData.lastName);
      if (generatedUsername) {
        setFormData(prev => ({
          ...prev,
          username: generatedUsername
        }));
      }
    }
  }, [formData.firstName, formData.lastName, formData.username]);

  // Update state, location, and work location based on country of residence
  useEffect(() => {
    setFormData(prev => {
      const updates = {};
      
      if (prev.countryOfResidence === 'US') {
        updates.state = 'California';
        updates.location = 'San Francisco';
        updates.citizenshipStatus = 'Citizen';
        // Update work location if work experience exists
        if (prev.workExperience && prev.workExperience.length > 0) {
          updates.workExperience = prev.workExperience.map(exp => ({
            ...exp,
            location: 'San Francisco'
          }));
        }
      } else if (prev.countryOfResidence === 'India') {
        updates.state = 'TS';
        updates.location = 'Hyderabad';
        updates.citizenshipStatus = 'n/a';
        // Update work location if work experience exists
        if (prev.workExperience && prev.workExperience.length > 0) {
          updates.workExperience = prev.workExperience.map(exp => ({
            ...exp,
            location: 'Hyderabad'
          }));
        }
      }
      
      return { ...prev, ...updates };
    });
  }, [formData.countryOfResidence]);

  // Debounced username check effect (skip in edit mode)
  useEffect(() => {
    if (!isEditMode && formData.username && touchedFields.username) {
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
  }, [formData.username, touchedFields.username, isEditMode]);

  // Validation rules for each field
  const validateField = (name, value) => {
    let error = "";

    switch (name) {
      case "username":
        // Skip username validation in edit mode
        if (!isEditMode) {
          if (!value.trim()) {
            error = "Username is required";
          } else if (value.length < 3) {
            error = "Username must be at least 3 characters";
          } else if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            error = "Username can only contain letters, numbers, and underscores";
          }
        }
        break;

      case "password":
        // Skip password validation in edit mode
        if (!isEditMode) {
          if (!value) {
            error = "Password is required";
          } else if (value.length < 6) {
            error = "Password must be at least 6 characters";
          } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
            error = "Password must contain uppercase, lowercase, and number";
          }
        }
        break;
      
      case "passwordConfirm":
        // Skip password confirmation validation in edit mode
        if (!isEditMode) {
          if (!value) {
            error = "Please confirm your password";
          } else if (value !== formData.password) {
            error = "Passwords do not match";
          }
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

      case "dateOfBirth":  // Renamed from dob
        if (!value) {
          error = "Date of birth is required";
        } else {
          const birthDate = new Date(value);
          const today = new Date();
          
          // Check for future dates
          if (birthDate > today) {
            error = "Date of birth cannot be in the future";
          } else {
            // Calculate age accurately
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            
            // Minimum age requirement: 20 years
            if (age < 20) {
              error = "You must be at least 20 years old to register";
            } else if (age > 100) {
              error = "Please enter a valid date of birth";
            }
          }
        }
        break;

      case "heightFeet":
        if (!value) {
          error = "Please select feet";
        }
        break;
      
      case "heightInches":
        if (!value && value !== "0") {
          error = "Please select inches";
        }
        break;
      
      case "state":
        // Skip state validation in edit mode (legacy users might not have this field)
        if (isEditMode) {
          break; // No validation in edit mode
        }
        
        // For new registrations: State is required if country is US or India
        const country = formData.countryOfResidence || '';
        const requireState = (country === 'US' || country === 'India');
        
        if (requireState && !value.trim()) {
          error = "State is required";
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
        // Location is now mandatory for both register and edit modes
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

      case "familyBackground":
        if (!value.trim()) {
          error = "Family background is required";
        } else if (value.length < 10) {
          error = "Please provide more details (at least 10 characters)";
        }
        break;

      case "aboutMe":  // Renamed from aboutYou
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

  // Handle creator info changes (nested object)
  const handleCreatorInfoChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      creatorInfo: {
        ...prev.creatorInfo,
        [name]: value
      }
    }));
  };

  // Education and Work Experience handlers are now in shared components
  // Image handling is now done by ImageManager component

  // Helper function to actually scroll and focus (extracted for reuse)
  const scrollAndFocus = (inputElement) => {
    // Scroll to the element with offset for fixed tab bar (70px TopBar + 80px TabBar)
    const elementPosition = inputElement.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - 180; // 180px offset for TopBar + TabBar + spacing
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
    
    // Focus and select the input after scrolling
    setTimeout(() => {
      inputElement.focus();
      
      // Add visual highlight
      inputElement.style.outline = '3px solid var(--warning-color)';
      inputElement.style.outlineOffset = '2px';
      
      // Select text if it's a text input
      if (inputElement.select && inputElement.type !== 'checkbox' && inputElement.type !== 'radio') {
        inputElement.select();
      }
      
      // Remove highlight after 2 seconds
      setTimeout(() => {
        inputElement.style.outline = '';
        inputElement.style.outlineOffset = '';
      }, 2000);
    }, 400); // Wait for smooth scroll to complete
  };

  // Helper function to scroll to and focus a field (enhanced for tabbed layout)
  const scrollToAndFocusField = (fieldName) => {
    // Try to find the input element by name or id
    const inputElement = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
    
    if (inputElement) {
      // Check if element is in a hidden tab and switch to it first
      const tabPanel = inputElement.closest('.tab-panel');
      if (tabPanel && !tabPanel.classList.contains('active')) {
        // Find which tab this field belongs to
        const tabSections = {
          'about-me': ['username', 'password', 'passwordConfirm', 'firstName', 'lastName', 'contactNumber', 'contactEmail', 'dateOfBirth', 'gender', 'heightFeet', 'heightInches', 'countryOfOrigin', 'countryOfResidence', 'state', 'location', 'religion', 'languagesSpoken', 'caste', 'motherTongue', 'profileCreatedBy', 'relationshipStatus', 'lookingFor', 'interests', 'bio'],
          'background': ['educationHistory', 'workExperience', 'linkedinUrl', 'familyBackground', 'familyType', 'familyValues', 'aboutMe', 'drinking', 'smoking', 'bodyType', 'hasChildren', 'wantsChildren', 'pets'],
          'partner-preferences': ['partnerPreference', 'ageRangeYounger', 'ageRangeOlder', 'heightRangeMin', 'heightRangeMax', 'educationLevel', 'profession', 'languages', 'partnerReligion', 'partnerCaste', 'partnerLocation', 'eatingPreference', 'partnerFamilyType', 'familyValues']
        };
        
        // Find which tab the field belongs to
        let targetTabId = 'about-me'; // default
        for (const [tabId, fields] of Object.entries(tabSections)) {
          if (fields.includes(fieldName)) {
            targetTabId = tabId;
            break;
          }
        }
        
        // Click the tab button to switch tabs
        const tabButton = document.querySelector(`[data-tab-id="${targetTabId}"]`) || 
                         document.querySelector(`.tab-button:nth-child(${targetTabId === 'about-me' ? 1 : targetTabId === 'background' ? 2 : 3})`);
        if (tabButton) {
          tabButton.click();
          // No animation delay needed - instant tab switch
          setTimeout(() => scrollAndFocus(inputElement), 50);
          return;
        }
      }
      
      scrollAndFocus(inputElement);
    } else {
      // Fallback to scrolling to top if element not found
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSavedUser(null);

    // Validate legal consents first (only for registration, not edit mode)
    if (!isEditMode) {
      if (!formData.agreedToAge) {
        setErrorMsg("❌ You must confirm that you are at least 18 years old to register.");
        scrollToAndFocusField('agreedToAge');
        return;
      }

      if (!formData.agreedToTerms) {
        setErrorMsg("❌ You must agree to the Terms of Service to register.");
        scrollToAndFocusField('agreedToTerms');
        return;
      }

      if (!formData.agreedToPrivacy) {
        setErrorMsg("❌ You must agree to the Privacy Policy to register.");
        scrollToAndFocusField('agreedToPrivacy');
        return;
      }

      if (!formData.agreedToGuidelines) {
        setErrorMsg("❌ You must agree to follow the Community Guidelines to register.");
        scrollToAndFocusField('agreedToGuidelines');
        return;
      }

      if (!formData.agreedToDataProcessing) {
        setErrorMsg("❌ You must consent to data processing for matchmaking purposes.");
        scrollToAndFocusField('agreedToDataProcessing');
        return;
      }
    }

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
      
      // Scroll to and focus the first field with an error
      scrollToAndFocusField(errorFields[0]);
      return;
    }

    // Validate array fields (education and work experience)
    if (!formData.educationHistory || formData.educationHistory.length === 0) {
      setErrorMsg("❌ Please add at least one education entry using the '+ Add' button in the Education History section");
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    if (!formData.workExperience || formData.workExperience.length === 0) {
      setErrorMsg("❌ Please add at least one work experience entry using the '+ Add' button in the Work Experience section");
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }

    const data = new FormData();
    for (const key in formData) {
      // Skip passwordConfirm, heightFeet, heightInches - handled separately
      if (key === 'passwordConfirm' || key === 'heightFeet' || key === 'heightInches') continue;
      
      // Handle arrays and objects specially
      if (key === 'languagesSpoken') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (key === 'partnerCriteria') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (key === 'educationHistory') {
        data.append(key, JSON.stringify(formData[key]));
      } else if (key === 'workExperience') {
        data.append(key, JSON.stringify(formData[key]));
      } else {
        data.append(key, formData[key]);
      }
    }
    
    // Combine heightFeet and heightInches into single height field
    if (formData.heightFeet && formData.heightInches !== '') {
      const height = `${formData.heightFeet}'${formData.heightInches}"`;
      data.append('height', height);
    }
    
    // Append images from ImageManager (newImages contains File objects)
    console.log('📸 Images being uploaded:', newImages.length, 'files');
    newImages.forEach((img, index) => {
      console.log(`  - Image ${index + 1}:`, img.name, `(${(img.size / 1024).toFixed(2)} KB)`);
      data.append("images", img);
    });

    try {
      setIsSubmitting(true);
      
      if (isEditMode) {
        // EDIT MODE: Update existing profile
        const username = editUsername || localStorage.getItem('username');
        
        // Add images to delete
        if (imagesToDelete.length > 0) {
          data.append('imagesToDelete', JSON.stringify(imagesToDelete));
        }
        
        // Add existing images (that weren't deleted)
        data.append('existingImages', JSON.stringify(existingImages));
        
        console.log('📝 Updating profile for:', username);
        console.log('  - Contact Number:', formData.contactNumber);
        console.log('  - Contact Email:', formData.contactEmail);
        console.log('  - Country of Residence:', formData.countryOfResidence);
        console.log('  - State:', formData.state);
        console.log('  - Existing images:', existingImages.length);
        console.log('  - New images:', newImages.length);
        console.log('  - Images to delete:', imagesToDelete.length);
        
        // Log all FormData entries
        console.log('FormData entries:');
        for (let [key, value] of data.entries()) {
          if (key === 'images') continue; // Skip image file objects
          console.log(`  ${key}:`, value);
        }
        
        await api.put(`/profile/${username}`, data);
        
        setIsSubmitting(false); // Clear loading state
        setSuccessMsg('✅ Profile updated successfully! You can continue editing or click "Back to Profile" when done.');
        window.scrollTo({ top: 0, behavior: 'auto' }); // Scroll to top to see success message
        
      } else {
        // REGISTER MODE: Create new user
        // Step 1: Register user (email is sent automatically by backend)
        await api.post("/register", data);

        // Step 2: Fetch the saved user profile from backend to get final image URLs
        const profileRes = await api.get(`/profile/${formData.username}`);
        setSavedUser(profileRes.data);
        
        // Step 2.5: Update invitation status if user registered via invitation
        if (invitationToken) {
          try {
            await api.post(`/api/invitations/accept/${invitationToken}`, {
              registeredUsername: formData.username
            });
            console.log('✅ Invitation accepted successfully');
          } catch (invErr) {
            console.error('Failed to update invitation status:', invErr);
            // Don't block registration if invitation update fails
          }
        }
        
        // Step 3: Redirect to email verification sent page
        setIsSubmitting(false); // Clear loading state
        navigate('/verify-email-sent', {
          state: {
            email: formData.contactEmail,
            username: formData.username
          }
        });
      }

    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
      const errorDetail = err.response?.data?.detail || err.response?.data?.error || "❌ Something went wrong.";
      
      // Handle specific backend validation errors
      if (errorDetail.includes("Username already exists")) {
        setFieldErrors((prev) => ({ ...prev, username: "❌ " + errorDetail }));
        setErrorMsg("❌ Username already exists. Please choose a different username.");
        scrollToAndFocusField('username'); // Auto-scroll to username field
      } else if (errorDetail.includes("Email already registered")) {
        setFieldErrors((prev) => ({ ...prev, contactEmail: "❌ " + errorDetail }));
        setErrorMsg("❌ Email already registered. Please use a different email.");
        scrollToAndFocusField('contactEmail'); // Auto-scroll to email field
      } else {
        setErrorMsg(errorDetail);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    }
  };

  // ========== TAB HELPER FUNCTIONS ==========
  
  // Calculate progress for each tab (0-100%)
  const calculateTabProgress = (tabId) => {
    let totalFields = 0;
    let filledFields = 0;

    if (tabId === 'about-me') {
      const fields = [
        'username', 'password', 'passwordConfirm', 'firstName', 'lastName',
        'contactNumber', 'contactEmail', 'dateOfBirth', 'gender',
        'heightFeet', 'heightInches', 'countryOfOrigin', 'countryOfResidence',
        'state', 'location', 'religion', 'languagesSpoken', 'bio',
        'relationshipStatus', 'lookingFor', 'interests'
      ];
      
      fields.forEach(field => {
        totalFields++;
        const value = formData[field];
        const isFilled = value && value !== "" && !(Array.isArray(value) && value.length === 0);
        if (isFilled) filledFields++;
      });
      
      totalFields++;
      if (newImages.length > 0) filledFields++;
      
    } else if (tabId === 'background') {
      const fields = [
        'educationHistory', 'workExperience', 'linkedinUrl',
        'familyBackground', 'familyType', 'familyValues', 'aboutMe',
        'drinking', 'smoking', 'bodyType', 'hasChildren', 'wantsChildren', 'pets'
      ];
      
      fields.forEach(field => {
        totalFields++;
        const value = formData[field];
        const isFilled = value && value !== "" && !(Array.isArray(value) && value.length === 0);
        if (isFilled) filledFields++;
      });
      
    } else if (tabId === 'partner-preferences') {
      totalFields = 8;
      
      if (formData.partnerPreference && formData.partnerPreference.trim().length >= 10) {
        filledFields++;
      }
      
      const criteria = formData.partnerCriteria || {};
      if (criteria.educationLevel && criteria.educationLevel.length > 0) filledFields++;
      if (criteria.profession && criteria.profession.length > 0) filledFields++;
      if (criteria.religion && criteria.religion.length > 0) filledFields++;
      if (criteria.languages && criteria.languages.length > 0) filledFields++;
      if (criteria.location && criteria.location.length > 0) filledFields++;
      if (criteria.eatingPreference && criteria.eatingPreference.length > 0) filledFields++;
      if (criteria.familyType && criteria.familyType.length > 0) filledFields++;
    }

    return totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
  };

  // Validate tab before switching
  const validateTabBeforeSwitch = async (tabId) => {
    const errors = {};

    if (tabId === 'about-me') {
      // Different required fields for register vs edit mode
      const requiredFields = isEditMode 
        ? ['firstName', 'lastName', 'contactNumber', 'contactEmail', 'dateOfBirth', 'gender', 'heightFeet', 'heightInches']
        : ['username', 'password', 'passwordConfirm', 'firstName', 'lastName', 'contactNumber', 'contactEmail', 'dateOfBirth', 'gender', 'heightFeet', 'heightInches'];
      
      requiredFields.forEach(field => {
        const error = validateField(field, formData[field]);
        if (error) errors[field] = error;
      });
      
    } else if (tabId === 'background') {
      const error = validateField('aboutMe', formData.aboutMe);
      if (error) errors.aboutMe = error;
      
    } else if (tabId === 'partner-preferences') {
      const error = validateField('partnerPreference', formData.partnerPreference);
      if (error) errors.partnerPreference = error;
    }

    return errors;
  };

  // Auto-save on tab switch (only for register mode, not edit mode)
  const handleTabAutoSave = async (tabId) => {
    // Skip auto-save in edit mode - we only save on explicit submit
    if (isEditMode) {
      console.log(`Skipping auto-save in edit mode for tab: ${tabId}`);
      return;
    }
    
    console.log(`Auto-saving ${tabId} data...`);
    
    try {
      const draftData = {
        ...formData,
        images: newImages.map(img => img.name),
        lastSaved: new Date().toISOString(),
        lastTab: tabId
      };
      localStorage.setItem('register2Draft', JSON.stringify(draftData));
    } catch (error) {
      console.error('Failed to save draft:', error);
    }
  };

  // Load draft on mount (only for register mode)
  useEffect(() => {
    if (!isEditMode) {
      try {
        const draft = localStorage.getItem('register2Draft');
        if (draft) {
          const parsed = JSON.parse(draft);
          setDraftData(parsed);
          setShowDraftModal(true);
        }
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [isEditMode]);

  // Load invitation data if invitation token is present in URL
  useEffect(() => {
    const loadInvitationData = async () => {
      if (!isEditMode) {
        const token = searchParams.get('invitation');
        if (token) {
          setInvitationToken(token);
          setLoadingInvitation(true);
          
          try {
            const response = await api.get(`/api/invitations/validate/${token}`);
            const invitation = response.data;
            
            setInvitationData(invitation);
            
            // Pre-fill form with invitation data
            setFormData(prev => ({
              ...prev,
              firstName: invitation.name ? invitation.name.split(' ')[0] : prev.firstName,
              lastName: invitation.name ? invitation.name.split(' ').slice(1).join(' ') : prev.lastName,
              contactEmail: invitation.email || prev.contactEmail,
              contactNumber: invitation.phone || prev.contactNumber
            }));
            
            setSuccessMsg(`✨ Welcome! You're registering with an invitation from ${invitation.invitedBy}`);
          } catch (err) {
            console.error('Failed to load invitation:', err);
            const errorMsg = err.response?.data?.detail || 'Invalid or expired invitation link';
            setErrorMsg(`⚠️ ${errorMsg}`);
          } finally {
            setLoadingInvitation(false);
          }
        }
      }
    };
    
    loadInvitationData();
  }, [isEditMode, searchParams]);

  // Load user data for edit mode
  useEffect(() => {
    const loadUserData = async () => {
      if (isEditMode) {
        const username = editUsername || localStorage.getItem('username');
        if (!username) {
          setErrorMsg('No username provided for editing');
          return;
        }

        try {
          console.log('Loading user data for editing:', username);
          // Add requester parameter to get unmasked data for own profile
          const response = await api.get(`/profile/${username}?requester=${username}`);
          const userData = response.data;
          
          console.log('Loaded user data:', userData);

          // Parse height from "5'6"" format
          let heightFeet = '';
          let heightInches = '';
          if (userData.height) {
            const heightMatch = userData.height.match(/(\d+)'(\d+)"/);
            if (heightMatch) {
              heightFeet = heightMatch[1];
              heightInches = heightMatch[2];
            }
          }

          // Check if values are masked (backend security feature)
          // For owner editing their own profile, contact info should be unmasked
          const isMaskedPhone = userData.contactNumber && userData.contactNumber.includes('***');
          const isMaskedEmail = userData.contactEmail && userData.contactEmail.includes('***');
          
          console.log('Contact fields check:', {
            phone: userData.contactNumber,
            isMasked: isMaskedPhone,
            email: userData.contactEmail,
            isMaskedEmail: isMaskedEmail,
            note: 'Owner should see unmasked contact info'
          });
          
          console.log('Location data check:', {
            countryOfResidence: userData.countryOfResidence,
            state: userData.state,
            location: userData.location
          });

          // Populate form with existing data
          setFormData({
            username: userData.username || '',
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            // Don't pre-fill masked values - user needs to re-enter them
            contactNumber: isMaskedPhone ? '' : (userData.contactNumber || ''),
            contactEmail: isMaskedEmail ? '' : (userData.contactEmail || ''),
            smsOptIn: userData.smsOptIn || false,  // SMS opt-in preference
            dateOfBirth: userData.dateOfBirth || '',
            gender: userData.gender || '',
            heightFeet,
            heightInches,
            profileCreatedBy: userData.profileCreatedBy || 'me',
            creatorInfo: userData.creatorInfo || {
              fullName: '',
              relationship: '',
              notes: ''
            },
            religion: userData.religion || 'No Religion',
            languagesSpoken: userData.languagesSpoken || ['English'],
            castePreference: userData.castePreference || 'No Preference',
            eatingPreference: userData.eatingPreference || 'No Preference',
            countryOfOrigin: userData.countryOfOrigin || 'US',
            countryOfResidence: userData.countryOfResidence || 'US',
            state: userData.state || (userData.countryOfResidence === 'US' ? 'California' : userData.countryOfResidence === 'India' ? 'Telangana' : ''),
            location: userData.location || (userData.countryOfResidence === 'US' ? 'San Francisco' : userData.countryOfResidence === 'India' ? 'Hyderabad' : ''),
            citizenshipStatus: userData.citizenshipStatus || 'Citizen',
            caste: userData.caste || '',
            motherTongue: userData.motherTongue || '',
            familyType: userData.familyType || '',
            familyValues: userData.familyValues || '',
            educationHistory: userData.educationHistory || [],
            workExperience: userData.workExperience || [],
            linkedinUrl: userData.linkedinUrl || '',
            familyBackground: userData.familyBackground || '',
            aboutMe: userData.aboutMe || '',
            partnerPreference: userData.partnerPreference || '',
            partnerCriteria: {
              ageRange: userData.partnerCriteria?.ageRange || { min: "", max: "" },
              ageRangeRelative: userData.partnerCriteria?.ageRangeRelative || { minOffset: 0, maxOffset: 5 },
              heightRange: userData.partnerCriteria?.heightRange || {
                minFeet: "",
                minInches: "",
                maxFeet: "",
                maxInches: ""
              },
              heightRangeRelative: userData.partnerCriteria?.heightRangeRelative || { minInches: 0, maxInches: 6 },
              educationLevel: userData.partnerCriteria?.educationLevel || ['Bachelor\'s'],
              profession: userData.partnerCriteria?.profession || ['Any'],
              languages: userData.partnerCriteria?.languages || ['English'],
              religion: userData.partnerCriteria?.religion || ['Any Religion'],
              caste: userData.partnerCriteria?.caste || 'No Preference',
              location: userData.partnerCriteria?.location || ['Any'],
              eatingPreference: userData.partnerCriteria?.eatingPreference || ['Any'],
              familyType: userData.partnerCriteria?.familyType || ['Any'],
              familyValues: userData.partnerCriteria?.familyValues || ['Moderate']
            },
            relationshipStatus: userData.relationshipStatus || 'Single',
            lookingFor: userData.lookingFor || 'Serious Relationship',
            interests: userData.interests || '',
            drinking: userData.drinking || 'Never',
            smoking: userData.smoking || 'Never',
            bodyType: userData.bodyType || 'Average',
            hasChildren: userData.hasChildren || 'No',
            wantsChildren: userData.wantsChildren || 'Yes',
            pets: userData.pets || 'None',
            bio: userData.bio || '',
            // Don't load password fields in edit mode
            password: '',
            passwordConfirm: ''
          });

          // Set existing images
          if (userData.images && Array.isArray(userData.images)) {
            setExistingImages(userData.images);
          }

        } catch (error) {
          console.error('Error loading user data:', error);
          setErrorMsg('Failed to load profile data');
        }
      }
    };

    loadUserData();
  }, [isEditMode, editUsername]);

  // Handle draft restore
  const handleRestoreDraft = () => {
    if (draftData) {
      const { images: savedImageNames, ...restData } = draftData;
      // Ensure creatorInfo exists
      setFormData({
        ...restData,
        creatorInfo: restData.creatorInfo || {
          fullName: '',
          relationship: '',
          notes: ''
        }
      });
    }
    setShowDraftModal(false);
  };

  // Handle draft discard
  const handleDiscardDraft = () => {
    localStorage.removeItem('register2Draft');
    setShowDraftModal(false);
  };

  return (
    <>
      {!isEditMode && (
        <SEO
          title={pageSEO.title}
          description={pageSEO.description}
          keywords={pageSEO.keywords}
          url={pageSEO.url}
        />
      )}
    <div className={`register-container ${isEditMode ? 'edit-mode' : 'registration-mode'}`} style={{
      ...(!isEditMode && {
        // Wedding background only for registration
        minHeight: '100vh',
        height: '100%',
        background: `
          linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)),
          url('/images/wedding-bg.jpg') center/cover no-repeat fixed
        `,
        padding: '20px 20px 40px',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'auto'
      })
    }}>
      {/* Dark overlay for readability - only for registration */}
      {!isEditMode && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.3)',
          zIndex: 0,
          pointerEvents: 'none'
        }}></div>
      )}
      
      {/* Content wrapper to center the card */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: window.innerWidth <= 768 ? '12px' : '20px',
        position: 'relative',
        zIndex: 1
      }}>
        <div className="card p-4 shadow" style={{
          ...(!isEditMode ? {
            // Glass effect only for registration
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
          } : {
            // Theme-aware colors for edit mode
            background: 'var(--card-background)',
            color: 'var(--text-color)'
          })
        }}>
          {/* Header with Logo and Back Button */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}></div>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              gap: '2px'
            }}>
              <div style={{ fontSize: '40px', lineHeight: '1' }}>🦋</div>
              <div style={{ 
                fontSize: '28px', 
                fontWeight: '800',
                background: 'linear-gradient(135deg, #ec4899 0%, #a78bfa 50%, #6366f1 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                letterSpacing: '2px',
                fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif'
              }}>
                L3V3L
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            {isEditMode && (
              <button 
                type="button" 
                className="btn btn-outline-secondary"
                onClick={() => navigate(`/profile/${editUsername || localStorage.getItem('username')}`)}
                style={{ whiteSpace: 'nowrap' }}
              >
                ← Back to Profile
              </button>
            )}
          </div>
        </div>
        
        {/* Title */}
        <h3 className="text-center mb-1">
          {isEditMode ? '✏️ Edit Your Profile' : '📝 Create Your Profile'}
        </h3>
        <p className="text-center text-muted" style={{ marginBottom: '12px' }}>
          {isEditMode ? 'Update your information across organized tabs' : 'Complete each section to find your perfect match'}
        </p>
      {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">

        {/* ========== TABBED NAVIGATION ========== */}
        <TabContainer
          tabs={[
            {
              id: 'about-me',
              label: 'About Me',
              icon: '👤',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">👤 Personal Information</h3>
                  {/* Custom row for firstName and lastName */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">First Name</label>
            <input 
              type="text" 
              className={`form-control ${getFieldClass('firstName', formData.firstName)} ${fieldErrors.firstName && touchedFields.firstName ? 'is-invalid' : ''}`}
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
            <label className="form-label">Last Name</label>
            <input 
              type="text" 
              className={`form-control ${getFieldClass('lastName', formData.lastName)} ${fieldErrors.lastName && touchedFields.lastName ? 'is-invalid' : ''}`}
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
        {/* Custom row for dateOfBirth, height, gender */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Date of Birth <span className="text-danger">*</span></label>
            <input 
              type="date" 
              className={`form-control ${getFieldClass('dateOfBirth', formData.dateOfBirth)} ${fieldErrors.dateOfBirth && touchedFields.dateOfBirth ? 'is-invalid' : ''}`}
              name="dateOfBirth" 
              value={formData.dateOfBirth} 
              onChange={handleChange}
              onBlur={handleBlur}
              max={new Date().toISOString().split('T')[0]}
              required 
            />
            {fieldErrors.dateOfBirth && touchedFields.dateOfBirth && (
              <div className="invalid-feedback d-block">{fieldErrors.dateOfBirth}</div>
            )}
          </div>
          <div className="col-md-4">
            <label className="form-label">Height <span className="text-danger">*</span></label>
            <div className="row">
              <div className="col-6">
                <select
                  className={`form-control ${fieldErrors.heightFeet && touchedFields.heightFeet ? 'is-invalid' : ''}`}
                  name="heightFeet"
                  value={formData.heightFeet}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                >
                  <option value="">Feet</option>
                  <option value="4">4 ft</option>
                  <option value="5">5 ft</option>
                  <option value="6">6 ft</option>
                  <option value="7">7 ft</option>
                </select>
                {fieldErrors.heightFeet && touchedFields.heightFeet && (
                  <div className="invalid-feedback d-block">{fieldErrors.heightFeet}</div>
                )}
              </div>
              <div className="col-6">
                <select
                  className={`form-control ${fieldErrors.heightInches && touchedFields.heightInches ? 'is-invalid' : ''}`}
                  name="heightInches"
                  value={formData.heightInches}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  required
                >
                  <option value="">Inches</option>
                  <option value="0">0 in</option>
                  <option value="1">1 in</option>
                  <option value="2">2 in</option>
                  <option value="3">3 in</option>
                  <option value="4">4 in</option>
                  <option value="5">5 in</option>
                  <option value="6">6 in</option>
                  <option value="7">7 in</option>
                  <option value="8">8 in</option>
                  <option value="9">9 in</option>
                  <option value="10">10 in</option>
                  <option value="11">11 in</option>
                </select>
                {fieldErrors.heightInches && touchedFields.heightInches && (
                  <div className="invalid-feedback d-block">{fieldErrors.heightInches}</div>
                )}
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <GenderSelector
              value={formData.gender}
              onChange={handleChange}
              onBlur={handleBlur}
              required
              label="Gender"
              name="gender"
              error={fieldErrors.gender}
              touched={touchedFields.gender}
            />
          </div>
        </div>

        {/* Profile Created By Field */}
        <div className="mb-3">
          <label htmlFor="profileCreatedBy" className="form-label">
            Profile Created By <span className="text-danger">*</span>
          </label>
          <select
            id="profileCreatedBy"
            name="profileCreatedBy"
            value={formData.profileCreatedBy}
            onChange={handleChange}
            className="form-control"
            required
          >
            <option value="me">Myself - I'm creating my own profile</option>
            <option value="parent">Parent/Guardian - Creating for my child</option>
            <option value="other">Other - Sibling/Friend/Relative</option>
          </select>
          <small className="form-text text-muted">
            Who is creating this matrimonial profile?
          </small>
        </div>

        {/* Creator Information Section (shown when not creating for self) */}
        {formData.profileCreatedBy !== 'me' && (
          <div className="creator-info-section">
            <div className="section-header mb-3">
              <h5 className="section-title">👤 Profile Creator Information</h5>
              <p className="section-subtitle">
                Please provide your information as the person creating this profile
              </p>
            </div>

            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="creatorFullName" className="form-label">
                  Your Full Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="creatorFullName"
                  name="fullName"
                  className="form-control"
                  placeholder="Enter your full name"
                  value={formData.creatorInfo?.fullName || ''}
                  onChange={handleCreatorInfoChange}
                  required={formData.profileCreatedBy !== 'me'}
                />
                <small className="form-text text-muted">
                  Name of the person creating this profile
                </small>
              </div>

              <div className="col-md-6 mb-3">
                <label htmlFor="creatorRelationship" className="form-label">
                  Relationship to Profile Owner <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="creatorRelationship"
                  name="relationship"
                  className="form-control"
                  placeholder="e.g., Mother, Father, Brother, Sister, Friend"
                  value={formData.creatorInfo?.relationship || ''}
                  onChange={handleCreatorInfoChange}
                  required={formData.profileCreatedBy !== 'me'}
                />
                <small className="form-text text-muted">
                  Your relationship to the profile owner
                </small>
              </div>
            </div>

            <div className="mb-3">
              <label htmlFor="creatorNotes" className="form-label">
                Additional Notes/Comments <span className="text-muted">(Optional)</span>
              </label>
              <textarea
                id="creatorNotes"
                name="notes"
                className="form-control"
                rows="3"
                placeholder="Any relevant information about why you're creating this profile or special circumstances..."
                value={formData.creatorInfo.notes}
                onChange={handleCreatorInfoChange}
              />
              <small className="form-text text-muted">
                Optional: Add context about the profile creation for admin review
              </small>
            </div>
          </div>
        )}

        {/* Custom row for contactNumber and contactEmail */}
        {isEditMode && !formData.contactNumber && !formData.contactEmail && (
          <div className="alert alert-info mb-3">
            <strong>🔒 Security Note:</strong> For your privacy, contact information was hidden. 
            Please enter your current contact number and email below to continue editing your profile.
          </div>
        )}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Contact Number <span className="text-danger">*</span></label>
            <input 
              type="text" 
              className={`form-control ${getFieldClass('contactNumber', formData.contactNumber)} ${fieldErrors.contactNumber && touchedFields.contactNumber ? 'is-invalid' : ''}`}
              name="contactNumber" 
              value={formData.contactNumber} 
              onChange={handleChange}
              onBlur={handleBlur}
              required
              placeholder={isEditMode && !formData.contactNumber ? "Enter your phone number" : ""}
            />
            {fieldErrors.contactNumber && touchedFields.contactNumber && (
              <div className="invalid-feedback d-block">{fieldErrors.contactNumber}</div>
            )}
            {/* SMS Opt-in Checkbox */}
            <div className="form-check mt-2 sms-optin-checkbox">
              <input 
                type="checkbox" 
                className="form-check-input" 
                id="smsOptIn"
                name="smsOptIn"
                checked={formData.smsOptIn}
                onChange={(e) => setFormData(prev => ({ ...prev, smsOptIn: e.target.checked }))}
              />
              <label className="form-check-label" htmlFor="smsOptIn">
                📱 I want to receive SMS notifications and updates
              </label>
              <small className="d-block text-muted mt-1">
                Standard messaging rates may apply. You can opt-out anytime.
              </small>
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label">Contact Email <span className="text-danger">*</span></label>
            <input 
              type="email" 
              className={`form-control ${getFieldClass('contactEmail', formData.contactEmail)} ${fieldErrors.contactEmail && touchedFields.contactEmail ? 'is-invalid' : ''}`}
              name="contactEmail" 
              value={formData.contactEmail} 
              onChange={handleChange}
              onBlur={handleBlur}
              required
              placeholder={isEditMode && !formData.contactEmail ? "Enter your email address" : ""}
            />
            {fieldErrors.contactEmail && touchedFields.contactEmail && (
              <div className="invalid-feedback d-block">{fieldErrors.contactEmail}</div>
            )}
          </div>
        </div>
        
        {/* Religion and Languages Spoken */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Religion <span className="text-muted">(Optional)</span></label>
            <select
              className={`form-control ${getFieldClass('religion', formData.religion)}`}
              name="religion"
              value={formData.religion}
              onChange={handleChange}
            >
              <option value="No Religion">No Religion</option>
              <option value="Hindu">Hindu</option>
              <option value="Muslim">Muslim</option>
              <option value="Christian">Christian</option>
              <option value="Sikh">Sikh</option>
              <option value="Buddhist">Buddhist</option>
              <option value="Jain">Jain</option>
              <option value="Jewish">Jewish</option>
              <option value="Parsi">Parsi</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
            <small className="text-muted">For both India and USA users</small>
          </div>
          <div className="col-md-6">
            <label className="form-label">Languages Spoken <span className="text-muted">(Select all that apply)</span></label>
            <select
              multiple
              className="form-control"
              name="languagesSpoken"
              value={formData.languagesSpoken}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({ ...prev, languagesSpoken: selected }));
              }}
              style={{ minHeight: '100px' }}
            >
              <option value="English">English</option>
              <option value="Hindi">Hindi</option>
              <option value="Tamil">Tamil</option>
              <option value="Telugu">Telugu</option>
              <option value="Marathi">Marathi</option>
              <option value="Bengali">Bengali</option>
              <option value="Gujarati">Gujarati</option>
              <option value="Kannada">Kannada</option>
              <option value="Malayalam">Malayalam</option>
              <option value="Punjabi">Punjabi</option>
              <option value="Urdu">Urdu</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Chinese">Chinese</option>
              <option value="Japanese">Japanese</option>
              <option value="Korean">Korean</option>
              <option value="Arabic">Arabic</option>
              <option value="Other">Other</option>
            </select>
            <small className="text-muted">Hold Ctrl/Cmd to select multiple. Selected: {formData.languagesSpoken.length}</small>
          </div>
        </div>

        {/* Bio / Tagline with Sample Carousel */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="form-label mb-0">Bio / Tagline</label>
            <div className="d-flex align-items-center gap-2">
              <small className="text-muted" style={{ fontSize: '13px' }}>Samples:</small>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setBioSampleIndex((prev) => (prev - 1 + bioSamples.length) % bioSamples.length)}
                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                title="Previous sample"
              >
                ‹
              </button>
              <span className="badge bg-primary" style={{ minWidth: '50px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}>
                {bioSampleIndex + 1}/{bioSamples.length}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setBioSampleIndex((prev) => (prev + 1) % bioSamples.length)}
                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                title="Next sample"
              >
                ›
              </button>
            </div>
          </div>
          <div 
            className="card p-2 mb-2" 
            onClick={() => setFormData({ ...formData, bio: bioSamples[bioSampleIndex] })}
            style={{ 
              backgroundColor: '#f8f9fa', 
              border: '1px dashed #dee2e6',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e3f2fd';
              e.currentTarget.style.borderColor = '#2196f3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
            title="Click to load this sample"
          >
            <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <strong>Sample {bioSampleIndex + 1}:</strong> {bioSamples[bioSampleIndex]} <span style={{ color: '#2196f3', fontWeight: 'bold' }}>↓ Click to use</span>
            </small>
          </div>
          <textarea
            className={`form-control ${fieldErrors.bio && touchedFields.bio ? 'is-invalid' : ''}`}
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={2}
            placeholder="Click sample above to load, then customize... (Max 200 characters)"
            maxLength={200}
          />
          <small className="text-muted">{formData.bio.length}/200 characters</small>
          {fieldErrors.bio && touchedFields.bio && (
            <div className="invalid-feedback d-block">{fieldErrors.bio}</div>
          )}
        </div>
        
        {/* Custom row for username, password, and confirm password */}
        <div className="row mb-3">
          {/* Username field - only show in register mode */}
          {!isEditMode && (
          <div className="col-md-4">
            <label className="form-label">
              User Name
              {checkingUsername && (
                <span className="text-muted small ms-2">
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Checking availability...
                </span>
              )}
            </label>
            <input 
              type="text" 
              className={`form-control ${getFieldClass('username', formData.username)} ${fieldErrors.username && touchedFields.username ? 'is-invalid' : touchedFields.username && !checkingUsername && !fieldErrors.username ? 'is-valid' : ''}`}
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
          )}
          {/* Password fields - only show in register mode */}
          {!isEditMode && (
            <>
          <div className="col-md-4">
            <label className="form-label">Password <span className="text-danger">*</span></label>
            <input 
              type="password" 
              className={`form-control ${getFieldClass('password', formData.password)} ${fieldErrors.password && touchedFields.password ? 'is-invalid' : ''}`}
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
          <div className="col-md-4">
            <label className="form-label">Confirm Password <span className="text-danger">*</span></label>
            <input 
              type="password" 
              className={`form-control ${fieldErrors.passwordConfirm && touchedFields.passwordConfirm ? 'is-invalid' : touchedFields.passwordConfirm && !fieldErrors.passwordConfirm ? 'is-valid' : ''}`}
              name="passwordConfirm" 
              value={formData.passwordConfirm} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
            />
            {fieldErrors.passwordConfirm && touchedFields.passwordConfirm && (
              <div className="invalid-feedback d-block">{fieldErrors.passwordConfirm}</div>
            )}
            {!fieldErrors.passwordConfirm && touchedFields.passwordConfirm && formData.passwordConfirm && (
              <div className="valid-feedback d-block">✅ Passwords match!</div>
            )}
          </div>
            </>
          )}
        </div>
        
        {/* Residential Information */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">
              Country of Origin <span className="text-danger">*</span>
            </label>
            <select
              className={`form-control ${getFieldClass('countryOfOrigin', formData.countryOfOrigin)} ${fieldErrors.countryOfOrigin && touchedFields.countryOfOrigin ? 'is-invalid' : ''}`}
              name="countryOfOrigin"
              value={formData.countryOfOrigin}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            >
              <option value="">Select Country</option>
              <option value="IN">🇮🇳 India</option>
              <option value="US">🇺🇸 United States</option>
            </select>
            <small className="text-muted">Where you're from</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">
              Residence <span className="text-danger">*</span>
            </label>
            <select
              className={`form-control ${getFieldClass('countryOfResidence', formData.countryOfResidence)} ${fieldErrors.countryOfResidence && touchedFields.countryOfResidence ? 'is-invalid' : ''}`}
              name="countryOfResidence"
              value={formData.countryOfResidence}
              onChange={handleChange}
              onBlur={handleBlur}
              required
            >
              <option value="">Select Country</option>
              <option value="IN">🇮🇳 India</option>
              <option value="US">🇺🇸 United States</option>
            </select>
            <small className="text-muted">Where you currently live</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">
              {formData.countryOfResidence === 'IN' ? 'State' : 'State/Province'} <span className="text-danger">*</span>
            </label>
            {formData.countryOfResidence === 'US' ? (
              <select
                className={`form-control ${getFieldClass('state', formData.state)} ${fieldErrors.state && touchedFields.state ? 'is-invalid' : ''}`}
                name="state"
                value={formData.state}
                onChange={(e) => {
                  setFormData({ ...formData, state: e.target.value, location: '' });
                  setFieldErrors({ ...fieldErrors, state: '' });
                  setTouchedFields({ ...touchedFields, state: true });
                }}
                onBlur={handleBlur}
                required
              >
                <option value="">Select State</option>
                {US_STATES.map(state => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            ) : (
              <select
                className={`form-control ${fieldErrors.state && touchedFields.state ? 'is-invalid' : ''}`}
                name="state"
                value={formData.state}
                onChange={handleChange}
                onBlur={handleBlur}
                required
              >
                <option value="">Select State</option>
                {formData.countryOfResidence === 'IN' && (
                  <>
                    <option value="Andhra Pradesh">Andhra Pradesh</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Kerala">Kerala</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="West Bengal">West Bengal</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Punjab">Punjab</option>
                    <option value="Haryana">Haryana</option>
                    <option value="Bihar">Bihar</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Telangana">Telangana</option>
                  </>
                )}
              </select>
            )}
            {fieldErrors.state && touchedFields.state && (
              <div className="invalid-feedback d-block">{fieldErrors.state}</div>
            )}
          </div>
        </div>
        
        {/* Location (City/Town) & Citizenship Status for USA */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">
              City/Town <span className="text-danger">*</span>
            </label>
            {formData.countryOfResidence === 'US' && formData.state && US_CITIES_BY_STATE[formData.state] ? (
              <Autocomplete
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                  setFieldErrors({ ...fieldErrors, location: '' });
                  setTouchedFields({ ...touchedFields, location: true });
                }}
                suggestions={US_CITIES_BY_STATE[formData.state]}
                placeholder="Type to search cities..."
                name="location"
                disabled={!formData.state}
                className={`${getFieldClass('location', formData.location)} ${fieldErrors.location && touchedFields.location ? 'is-invalid' : ''}`}
              />
            ) : (
              <input
                type="text"
                className={`form-control ${getFieldClass('location', formData.location)} ${fieldErrors.location && touchedFields.location ? 'is-invalid' : ''}`}
                name="location"
                value={formData.location}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="e.g., Bangalore, New York City"
                required
              />
            )}
            {fieldErrors.location && touchedFields.location && (
              <div className="invalid-feedback d-block">{fieldErrors.location}</div>
            )}
          </div>
          <div className="col-md-6">
            <label className="form-label">Citizenship Status</label>
            {formData.countryOfResidence === 'US' ? (
              <select 
                className={`form-control ${getFieldClass('citizenshipStatus', formData.citizenshipStatus)}`}
                name="citizenshipStatus" 
                value={formData.citizenshipStatus} 
                onChange={handleChange}
              >
                <option value="Citizen">Citizen</option>
                <option value="Greencard">Greencard</option>
              </select>
            ) : (
              <input
                type="text"
                className="form-control"
                value="n/a"
                readOnly
                disabled
              />
            )}
            <small className="text-muted">Relevant for USA residents</small>
          </div>
        </div>

        {/* India-Specific Fields (Conditional) */}
        {formData.countryOfOrigin === 'IN' && (
          <>
            <div className="alert alert-info" style={{marginBottom: '20px'}}>
              <strong>🇮🇳 India-Specific Fields</strong> - These fields are important for matrimonial matchmaking in India
            </div>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Caste <span className="text-muted">(Optional)</span></label>
                <input
                  type="text"
                  className="form-control"
                  name="caste"
                  value={formData.caste}
                  onChange={handleChange}
                  placeholder="e.g., Brahmin, Kshatriya, etc."
                />
                <small className="text-muted">Only visible to matched users</small>
              </div>
              <div className="col-md-6">
                <label className="form-label">Mother Tongue</label>
                <select
                  className="form-control"
                  name="motherTongue"
                  value={formData.motherTongue}
                  onChange={handleChange}
                >
                  <option value="">Select Language</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Bengali">Bengali</option>
                  <option value="Gujarati">Gujarati</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Malayalam">Malayalam</option>
                  <option value="Punjabi">Punjabi</option>
                  <option value="Urdu">Urdu</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="row mb-3">
              <div className="col-md-6">
                <label className="form-label">Family Type</label>
                <select
                  className="form-control"
                  name="familyType"
                  value={formData.familyType}
                  onChange={handleChange}
                >
                  <option value="">Select Type</option>
                  <option value="Joint Family">Joint Family</option>
                  <option value="Nuclear Family">Nuclear Family</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label">Family Values</label>
                <select
                  className="form-control"
                  name="familyValues"
                  value={formData.familyValues}
                  onChange={handleChange}
                >
                  <option value="">Select Values</option>
                  <option value="Traditional">Traditional</option>
                  <option value="Moderate">Moderate</option>
                  <option value="Liberal">Liberal</option>
                </select>
              </div>
            </div>
          </>
        )}

        {/* Profile Images - ImageManager Component */}
        <div className="mt-4">
          <h5 className="mb-3 text-primary">📸 Profile Images</h5>
          <p className="text-muted small mb-3">
            Upload up to 6 photos (5MB each). Drag to reorder. First photo will be your profile picture.
          </p>
          <ImageManager
            existingImages={existingImages}
            setExistingImages={setExistingImages}
            imagesToDelete={imagesToDelete}
            setImagesToDelete={setImagesToDelete}
            newImages={newImages}
            setNewImages={setNewImages}
            onError={(msg) => setErrorMsg(msg)}
          />
        </div>


                </div>
              )
            },
            {
              id: 'background',
              label: 'Qualifications',
              icon: '🎓',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">🎓 Qualifications</h3>

        {/* Education History Section - Using Shared Component */}
        <EducationHistory
          educationHistory={formData.educationHistory}
          setEducationHistory={(value) => setFormData(prev => ({ ...prev, educationHistory: value }))}
          isRequired={true}
          showValidation={true}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
        />

        {/* Work Experience Section - Using Shared Component */}
        <WorkExperience
          workExperience={formData.workExperience}
          setWorkExperience={(value) => setFormData(prev => ({ ...prev, workExperience: value }))}
          isRequired={true}
          showValidation={true}
          errorMsg={errorMsg}
          setErrorMsg={setErrorMsg}
        />

        {/* Render all other fields as input or textarea as appropriate (deduplicated) */}
        {Object.entries(formData).map(([key, value]) => {
          // Exclude fields that are rendered explicitly elsewhere
          const excludedFields = [
            "username", "password", "passwordConfirm", "firstName", "lastName", "contactNumber", "contactEmail", 
            "dateOfBirth", "heightFeet", "heightInches", "gender", "citizenshipStatus", 
            "profileCreatedBy",  // Rendered explicitly above
            "religion", "languagesSpoken",  // NEW: rendered explicitly
            "castePreference", "eatingPreference", "location",
            // Exclude country/regional fields (rendered explicitly above)
            "countryOfOrigin", "countryOfResidence", "state", "caste", "motherTongue", 
            "familyType", "familyValues",
            // Exclude education fields (rendered explicitly in Education History section)
            "educationHistory",
            // Exclude work-related fields (rendered explicitly or auto-calculated)
            "workExperience", "workLocation", "linkedinUrl",
            // Exclude new dating-app fields (rendered in Dating Preferences section)
            "relationshipStatus", "lookingFor", "interests", "languages", 
            "drinking", "smoking", "bodyType",
            "hasChildren", "wantsChildren", "pets", "bio",
            // Exclude legal consent fields (backend-only metadata, not profile fields)
            "agreedToAge", "agreedToTerms", "agreedToPrivacy", "agreedToGuidelines",
            "agreedToDataProcessing", "agreedToMarketing",
            // Exclude SMS opt-in (rendered as checkbox with Contact Number)
            "smsOptIn",
            // Exclude aboutMe, partnerPreference, and partnerCriteria (rendered explicitly)
            "aboutMe", "partnerPreference", "partnerCriteria"
          ];
          
          if (excludedFields.includes(key)) return null;
          
          if (key === "familyBackground") {
            return (
              <TextAreaWithSamples
                key={key}
                label="Family Background"
                name="familyBackground"
                value={formData.familyBackground}
                onChange={handleChange}
                onBlur={handleBlur}
                required
                rows={5}
                placeholder="Click the sample texts above to load a description, then customize it to your liking..."
                samples={familyBackgroundSamples}
                error={fieldErrors.familyBackground}
                touched={touchedFields.familyBackground}
                className={getFieldClass('familyBackground', formData.familyBackground)}
              />
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
        
        {/* About Me with Sample Carousel */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="form-label mb-0">About Me</label>
            <div className="d-flex align-items-center gap-2">
              <small className="text-muted" style={{ fontSize: '13px' }}>Samples:</small>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setAboutMeSampleIndex((prev) => (prev - 1 + aboutMeSamples.length) % aboutMeSamples.length)}
                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                title="Previous sample"
              >
                ‹
              </button>
              <span className="badge bg-primary" style={{ minWidth: '50px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}>
                {aboutMeSampleIndex + 1}/{aboutMeSamples.length}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setAboutMeSampleIndex((prev) => (prev + 1) % aboutMeSamples.length)}
                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                title="Next sample"
              >
                ›
              </button>
            </div>
          </div>
          <div 
            className="card p-2 mb-2" 
            onClick={() => setFormData({ ...formData, aboutMe: aboutMeSamples[aboutMeSampleIndex] })}
            style={{ 
              backgroundColor: '#f8f9fa', 
              border: '1px dashed #dee2e6',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e3f2fd';
              e.currentTarget.style.borderColor = '#2196f3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
            title="Click to load this sample"
          >
            <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <strong>Sample {aboutMeSampleIndex + 1}:</strong> {aboutMeSamples[aboutMeSampleIndex].substring(0, 150)}... <span style={{ color: '#2196f3', fontWeight: 'bold' }}>↓ Click to use</span>
            </small>
          </div>
          <textarea
            className={`form-control ${getFieldClass('aboutMe', formData.aboutMe)} ${fieldErrors.aboutMe && touchedFields.aboutMe ? 'is-invalid' : ''}`}
            name="aboutMe"
            value={formData.aboutMe}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={5}
            placeholder="Click 'Use This Sample' above to load a sample description, then customize it to your liking..."
            required
          />
          {fieldErrors.aboutMe && touchedFields.aboutMe && (
            <div className="invalid-feedback d-block">{fieldErrors.aboutMe}</div>
          )}
        </div>

        {/* Partner Matching Criteria Section */}
        <h5 className="mt-4 mb-3 text-primary">🎯 Partner Matching Criteria</h5>
        <div className="alert alert-info">
          <small>
            <strong>💡 Tip:</strong> These preferences help us find better matches for you. All fields are optional but recommended for better match quality.
          </small>
        </div>
        

                </div>
              )
            },
            {
              id: 'partner-preferences',
              label: 'Partner Preferences',
              icon: '💕',
              content: (
                <div className="tab-section">
                  <h3 className="section-title">💕 What You're Looking For</h3>

        {/* Partner Preference with Sample Carousel */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="form-label mb-0">Partner Preference</label>
            <div className="d-flex align-items-center gap-2">
              <small className="text-muted" style={{ fontSize: '13px' }}>Samples:</small>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setPartnerPrefSampleIndex((prev) => (prev - 1 + partnerPrefSamples.length) % partnerPrefSamples.length)}
                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                title="Previous sample"
              >
                ‹
              </button>
              <span className="badge bg-primary" style={{ minWidth: '50px', padding: '6px 10px', fontSize: '13px', borderRadius: '6px' }}>
                {partnerPrefSampleIndex + 1}/{partnerPrefSamples.length}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setPartnerPrefSampleIndex((prev) => (prev + 1) % partnerPrefSamples.length)}
                style={{ padding: '4px 10px', fontSize: '16px', lineHeight: '1', borderRadius: '6px' }}
                title="Next sample"
              >
                ›
              </button>
            </div>
          </div>
          <div 
            className="card p-2 mb-2" 
            onClick={() => setFormData({ ...formData, partnerPreference: partnerPrefSamples[partnerPrefSampleIndex] })}
            style={{ 
              backgroundColor: '#f8f9fa', 
              border: '1px dashed #dee2e6',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#e3f2fd';
              e.currentTarget.style.borderColor = '#2196f3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8f9fa';
              e.currentTarget.style.borderColor = '#dee2e6';
            }}
            title="Click to load this sample"
          >
            <small className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <strong>Sample {partnerPrefSampleIndex + 1}:</strong> {partnerPrefSamples[partnerPrefSampleIndex].substring(0, 150)}... <span style={{ color: '#2196f3', fontWeight: 'bold' }}>↓ Click to use</span>
            </small>
          </div>
          <textarea
            className={`form-control ${getFieldClass('partnerPreference', formData.partnerPreference)} ${fieldErrors.partnerPreference && touchedFields.partnerPreference ? 'is-invalid' : ''}`}
            name="partnerPreference"
            value={formData.partnerPreference}
            onChange={handleChange}
            onBlur={handleBlur}
            rows={5}
            placeholder="Click 'Use This Sample' above to load a sample description, then customize it to your liking..."
            required
          />
          {fieldErrors.partnerPreference && touchedFields.partnerPreference && (
            <div className="invalid-feedback d-block">{fieldErrors.partnerPreference}</div>
          )}
        </div>
        
        {/* Partner Preferences: Caste, Eating, Location */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Caste Preference</label>
            <input 
              type="text" 
              className={`form-control ${getFieldClass('castePreference', formData.castePreference)} ${fieldErrors.castePreference && touchedFields.castePreference ? 'is-invalid' : ''}`}
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
            <label className="form-label">Eating Preference</label>
            <select 
              className={`form-control ${getFieldClass('eatingPreference', formData.eatingPreference)} ${fieldErrors.eatingPreference && touchedFields.eatingPreference ? 'is-invalid' : ''}`}
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
            <label className="form-label">Location Preference</label>
            <input 
              type="text" 
              className={`form-control ${fieldErrors.location && touchedFields.location ? 'is-invalid' : ''}`}
              name="location" 
              value={formData.location} 
              onChange={handleChange}
              onBlur={handleBlur}
              required 
              placeholder="e.g., New York, USA"
            />
            {fieldErrors.location && touchedFields.location && (
              <div className="invalid-feedback d-block">{fieldErrors.location}</div>
            )}
          </div>
        </div>
        
        {/* Age Preference - Relative to Your Age */}
        <div className="mb-4" style={{ background: 'var(--info-background, #e7f3ff)', padding: '16px', borderRadius: '8px', border: '2px solid var(--info-border, #b3d9ff)' }}>
          <h6 style={{ color: 'var(--text-color, #333)', marginBottom: '12px' }}>💝 Age Preference (relative to your age)</h6>
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">How much younger?</label>
              <select
                className={`form-control ${formData.partnerCriteria.ageRangeRelative.minOffset === 0 ? 'field-default' : 'field-filled'}`}
                value={formData.partnerCriteria.ageRangeRelative.minOffset}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  partnerCriteria: {
                    ...prev.partnerCriteria,
                    ageRangeRelative: { ...prev.partnerCriteria.ageRangeRelative, minOffset: parseInt(e.target.value) }
                  }
                }))}
              >
                <option value="0">Same age</option>
                <option value="-1">1 year younger</option>
                <option value="-2">2 years younger</option>
                <option value="-3">3 years younger</option>
                <option value="-5">5 years younger</option>
                <option value="-10">10 years younger</option>
                <option value="-15">15 years younger</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">How much older?</label>
              <select
                className={`form-control ${formData.partnerCriteria.ageRangeRelative.maxOffset === 5 ? 'field-default' : 'field-filled'}`}
                value={formData.partnerCriteria.ageRangeRelative.maxOffset}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  partnerCriteria: {
                    ...prev.partnerCriteria,
                    ageRangeRelative: { ...prev.partnerCriteria.ageRangeRelative, maxOffset: parseInt(e.target.value) }
                  }
                }))}
              >
                <option value="0">Same age</option>
                <option value="1">1 year older</option>
                <option value="2">2 years older</option>
                <option value="3">3 years older</option>
                <option value="5">5 years older</option>
                <option value="10">10 years older</option>
                <option value="15">15 years older</option>
                <option value="20">20 years older</option>
              </select>
            </div>
          </div>
          {formData.dateOfBirth && (
            <div className="alert alert-info mb-0" style={{ fontSize: '14px' }}>
              📊 <strong>Preview:</strong> Looking for ages{' '}
              <strong>{calculateAge(formData.dateOfBirth) + formData.partnerCriteria.ageRangeRelative.minOffset}</strong> to{' '}
              <strong>{calculateAge(formData.dateOfBirth) + formData.partnerCriteria.ageRangeRelative.maxOffset}</strong>{' '}
              (based on your age: {calculateAge(formData.dateOfBirth)})
            </div>
          )}
          {!formData.dateOfBirth && (
            <div className="alert alert-warning mb-0" style={{ fontSize: '13px' }}>
              ⚠️ Please set your date of birth above to see age preview
            </div>
          )}
        </div>

        {/* Height Preference - Relative to Your Height */}
        <div className="mb-4" style={{ background: 'var(--info-background, #e7f3ff)', padding: '16px', borderRadius: '8px', border: '2px solid var(--info-border, #b3d9ff)' }}>
          <h6 style={{ color: 'var(--text-color, #333)', marginBottom: '12px' }}>📏 Height Preference (relative to your height)</h6>
          <div className="row mb-3">
            <div className="col-md-6">
              <label className="form-label">How much shorter?</label>
              <select
                className={`form-control ${formData.partnerCriteria.heightRangeRelative.minInches === 0 ? 'field-default' : 'field-filled'}`}
                value={formData.partnerCriteria.heightRangeRelative.minInches}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  partnerCriteria: {
                    ...prev.partnerCriteria,
                    heightRangeRelative: { ...prev.partnerCriteria.heightRangeRelative, minInches: parseInt(e.target.value) }
                  }
                }))}
              >
                <option value="0">Same height as mine</option>
                <option value="-1">1 inch shorter</option>
                <option value="-2">2 inches shorter</option>
                <option value="-3">3 inches shorter</option>
                <option value="-4">4 inches shorter</option>
                <option value="-6">6 inches shorter</option>
                <option value="-12">1 foot shorter</option>
                <option value="-24">2 feet shorter</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label">How much taller?</label>
              <select
                className={`form-control ${formData.partnerCriteria.heightRangeRelative.maxInches === 6 ? 'field-default' : 'field-filled'}`}
                value={formData.partnerCriteria.heightRangeRelative.maxInches}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  partnerCriteria: {
                    ...prev.partnerCriteria,
                    heightRangeRelative: { ...prev.partnerCriteria.heightRangeRelative, maxInches: parseInt(e.target.value) }
                  }
                }))}
              >
                <option value="0">Same height as mine</option>
                <option value="1">1 inch taller</option>
                <option value="2">2 inches taller</option>
                <option value="3">3 inches taller</option>
                <option value="4">4 inches taller</option>
                <option value="6">6 inches taller</option>
                <option value="12">1 foot taller</option>
                <option value="24">2 feet taller</option>
              </select>
            </div>
          </div>
          {(formData.heightFeet && formData.heightInches !== '') && (
            <div className="alert alert-info mb-0" style={{ fontSize: '14px' }}>
              📊 <strong>Preview:</strong> Looking for heights{' '}
              <strong>{inchesToHeightString(heightToInches(formData.heightFeet, formData.heightInches) + formData.partnerCriteria.heightRangeRelative.minInches)}</strong> to{' '}
              <strong>{inchesToHeightString(heightToInches(formData.heightFeet, formData.heightInches) + formData.partnerCriteria.heightRangeRelative.maxInches)}</strong>{' '}
              (based on your height: {formData.heightFeet}'{formData.heightInches}")
            </div>
          )}
          {!(formData.heightFeet && formData.heightInches !== '') && (
            <div className="alert alert-warning mb-0" style={{ fontSize: '13px' }}>
              ⚠️ Please set your height above to see height preview
            </div>
          )}
        </div>

        {/* Remaining static height fields for backward compatibility - hide these */}
        <div className="row mb-3" style={{ display: 'none' }}>
          <div className="col-md-4">
            <label className="form-label">Minimum Height</label>
            <div className="row">
              <div className="col-6">
                <select
                  className="form-control"
                  value={formData.partnerCriteria.heightRange.minFeet}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      heightRange: { ...prev.partnerCriteria.heightRange, minFeet: e.target.value }
                    }
                  }))}
                >
                  <option value="">Feet</option>
                  <option value="4">4 ft</option>
                  <option value="5">5 ft</option>
                  <option value="6">6 ft</option>
                  <option value="7">7 ft</option>
                </select>
              </div>
              <div className="col-6">
                <select
                  className="form-control"
                  value={formData.partnerCriteria.heightRange.minInches}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      heightRange: { ...prev.partnerCriteria.heightRange, minInches: e.target.value }
                    }
                  }))}
                >
                  <option value="">Inches</option>
                  <option value="0">0 in</option>
                  <option value="1">1 in</option>
                  <option value="2">2 in</option>
                  <option value="3">3 in</option>
                  <option value="4">4 in</option>
                  <option value="5">5 in</option>
                  <option value="6">6 in</option>
                  <option value="7">7 in</option>
                  <option value="8">8 in</option>
                  <option value="9">9 in</option>
                  <option value="10">10 in</option>
                  <option value="11">11 in</option>
                </select>
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <label className="form-label">Maximum Height</label>
            <div className="row">
              <div className="col-6">
                <select
                  className="form-control"
                  value={formData.partnerCriteria.heightRange.maxFeet}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      heightRange: { ...prev.partnerCriteria.heightRange, maxFeet: e.target.value }
                    }
                  }))}
                >
                  <option value="">Feet</option>
                  <option value="4">4 ft</option>
                  <option value="5">5 ft</option>
                  <option value="6">6 ft</option>
                  <option value="7">7 ft</option>
                </select>
              </div>
              <div className="col-6">
                <select
                  className="form-control"
                  value={formData.partnerCriteria.heightRange.maxInches}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    partnerCriteria: {
                      ...prev.partnerCriteria,
                      heightRange: { ...prev.partnerCriteria.heightRange, maxInches: e.target.value }
                    }
                  }))}
                >
                  <option value="">Inches</option>
                  <option value="0">0 in</option>
                  <option value="1">1 in</option>
                  <option value="2">2 in</option>
                  <option value="3">3 in</option>
                  <option value="4">4 in</option>
                  <option value="5">5 in</option>
                  <option value="6">6 in</option>
                  <option value="7">7 in</option>
                  <option value="8">8 in</option>
                  <option value="9">9 in</option>
                  <option value="10">10 in</option>
                  <option value="11">11 in</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* ROW 1: Education | Profession | Locations */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Preferred Education Level <span className="text-muted">(Select multiple)</span></label>
            <select
              multiple
              className="form-control"
              value={formData.partnerCriteria.educationLevel}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, educationLevel: selected }
                }));
              }}
              style={{ minHeight: '80px' }}
            >
              <option value="High School">High School</option>
              <option value="Bachelor's">Bachelor's Degree</option>
              <option value="Master's">Master's Degree</option>
              <option value="PhD">PhD/Doctorate</option>
              <option value="Professional Degree">Professional Degree (MD, JD, etc.)</option>
              <option value="Diploma">Diploma</option>
              <option value="Any">Any Education Level</option>
            </select>
            <small className="text-muted">Selected: {formData.partnerCriteria.educationLevel.length}</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">Preferred Profession <span className="text-muted">(Select multiple)</span></label>
            <select
              multiple
              className="form-control"
              value={formData.partnerCriteria.profession}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, profession: selected }
                }));
              }}
              style={{ minHeight: '80px' }}
            >
              <option value="Engineer">Engineer</option>
              <option value="Doctor">Doctor</option>
              <option value="Teacher">Teacher</option>
              <option value="Business Owner">Business Owner</option>
              <option value="Government Employee">Government Employee</option>
              <option value="IT Professional">IT Professional</option>
              <option value="Lawyer">Lawyer</option>
              <option value="Accountant">Accountant</option>
              <option value="Consultant">Consultant</option>
              <option value="Self Employed">Self Employed</option>
              <option value="Any">Any Profession</option>
            </select>
            <small className="text-muted">Selected: {formData.partnerCriteria.profession.length}</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">Preferred Locations <span className="text-muted">(Multiple)</span></label>
            <select
              multiple
              className="form-control"
              value={formData.partnerCriteria.location}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, location: selected }
                }));
              }}
              style={{ minHeight: '80px' }}
            >
              <option value="Bangalore">Bangalore</option>
              <option value="Mumbai">Mumbai</option>
              <option value="Delhi">Delhi</option>
              <option value="Chennai">Chennai</option>
              <option value="Hyderabad">Hyderabad</option>
              <option value="California">California</option>
              <option value="New York">New York</option>
              <option value="Texas">Texas</option>
              <option value="Any">Any Location</option>
            </select>
            <small className="text-muted">Selected: {formData.partnerCriteria.location.length}</small>
          </div>
        </div>
        
        {/* India-specific: Languages, Religion, Caste Preferences */}
        {formData.countryOfResidence === "India" && (
          <div className="row mb-3">
            <div className="col-md-4">
              <label className="form-label">Preferred Languages <span className="text-muted">(Multiple)</span></label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.languages}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, languages: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi</option>
                <option value="Tamil">Tamil</option>
                <option value="Telugu">Telugu</option>
                <option value="Marathi">Marathi</option>
                <option value="Bengali">Bengali</option>
                <option value="Kannada">Kannada</option>
                <option value="Malayalam">Malayalam</option>
                <option value="Gujarati">Gujarati</option>
                <option value="Punjabi">Punjabi</option>
                <option value="Any">Any Language</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple. Selected: {formData.partnerCriteria.languages.length}</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Preferred Religion <span className="text-muted">(Multiple)</span></label>
              <select
                multiple
                className="form-control"
                value={formData.partnerCriteria.religion}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData(prev => ({
                    ...prev,
                    partnerCriteria: { ...prev.partnerCriteria, religion: selected }
                  }));
                }}
                style={{ minHeight: '80px' }}
              >
                <option value="Hindu">Hindu</option>
                <option value="Muslim">Muslim</option>
                <option value="Christian">Christian</option>
                <option value="Sikh">Sikh</option>
                <option value="Buddhist">Buddhist</option>
                <option value="Jain">Jain</option>
                <option value="Jewish">Jewish</option>
                <option value="Parsi">Parsi</option>
                <option value="Other">Other</option>
                <option value="Any">Any Religion</option>
              </select>
              <small className="text-muted">Hold Ctrl/Cmd to select multiple. Selected: {formData.partnerCriteria.religion.length}</small>
            </div>
            <div className="col-md-4">
              <label className="form-label">Preferred Caste</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Any, Brahmin, Kshatriya, etc."
                value={formData.partnerCriteria.caste}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, caste: e.target.value }
                }))}
              />
              <small className="text-muted">For India users. Enter "Any" if no preference.</small>
            </div>
          </div>
        )}
        
        {/* ROW 2: Eating | Family Type | Family Values */}
        <div className="row mb-3">
          <div className="col-md-4">
            <label className="form-label">Eating Preference <span className="text-muted">(Multiple)</span></label>
            <select
              multiple
              className="form-control"
              value={formData.partnerCriteria.eatingPreference}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, eatingPreference: selected }
                }));
              }}
              style={{ minHeight: '80px' }}
            >
              <option value="Vegetarian">Vegetarian</option>
              <option value="Eggetarian">Eggetarian</option>
              <option value="Non-Veg">Non-Veg</option>
              <option value="Any">Any</option>
            </select>
            <small className="text-muted">Selected: {formData.partnerCriteria.eatingPreference.length}</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">Family Type <span className="text-muted">(Multiple)</span></label>
            <select
              multiple
              className="form-control"
              value={formData.partnerCriteria.familyType}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, familyType: selected }
                }));
              }}
              style={{ minHeight: '80px' }}
            >
              <option value="Nuclear Family">Nuclear Family</option>
              <option value="Joint Family">Joint Family</option>
              <option value="Any">Any</option>
            </select>
            <small className="text-muted">Selected: {formData.partnerCriteria.familyType.length}</small>
          </div>
          <div className="col-md-4">
            <label className="form-label">Preferred Family Values <span className="text-muted">(Select multiple)</span></label>
            <select
              multiple
              className="form-control"
              value={formData.partnerCriteria.familyValues}
              onChange={(e) => {
                const selected = Array.from(e.target.selectedOptions, option => option.value);
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, familyValues: selected }
                }));
              }}
              style={{ minHeight: '80px' }}
            >
              <option value="Traditional">Traditional</option>
              <option value="Moderate">Moderate</option>
              <option value="Liberal">Liberal</option>
              <option value="Any">Any</option>
            </select>
            <small className="text-muted">Selected: {formData.partnerCriteria.familyValues.length}</small>
          </div>
        </div>
        
        {/* ROW 3: Relationship Status | Looking For | Religion | Pets */}
        <div className="row mb-3">
          <div className="col-md-3">
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
          <div className="col-md-3">
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
          <div className="col-md-3">
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
          <div className="col-md-3">
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
        </div>

        {/* ROW 4: Body Type | Drinking | Smoking | Has Children | Wants Children */}
        <div className="row mb-3">
          <div className="col-md-2">
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
          <div className="col-md-2">
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
          <div className="col-md-3">
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
          <div className="col-md-3">
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
          <div className="col-md-2">
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

        {/* ROW 5: Interests & Hobbies | Languages Spoken */}
        <div className="row mb-3">
          <div className="col-md-6">
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
          <div className="col-md-6">
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
        </div>


                </div>
              )
            }
          ]}
          calculateProgress={calculateTabProgress}
          validateTab={validateTabBeforeSwitch}
          onAutoSave={handleTabAutoSave}
          enableAutoSave={!isEditMode}
        />

        {/* Legal Agreements - OUTSIDE TABS, BEFORE SUBMIT BUTTON - Only show in register mode */}
        {!isEditMode && (
        <div className="legal-agreements-section mt-5 p-4 border rounded">
          <h4 className="mb-2" style={{ color: 'var(--danger-color)' }}>📋 Legal Agreements (Required)</h4>
          <p className="small mb-3" style={{ color: 'var(--text-secondary)' }}>
            Please review and accept all agreements below before completing your registration.
            These are mandatory to create your profile.
          </p>

          {/* Select All Checkbox */}
          <div className="form-check select-all-agreements mb-4">
            <input
              type="checkbox"
              className="form-check-input"
              id="selectAllAgreements"
              checked={
                formData.agreedToAge &&
                formData.agreedToTerms &&
                formData.agreedToPrivacy &&
                formData.agreedToGuidelines &&
                formData.agreedToDataProcessing
              }
              onChange={(e) => {
                const checked = e.target.checked;
                setFormData({
                  ...formData,
                  agreedToAge: checked,
                  agreedToTerms: checked,
                  agreedToPrivacy: checked,
                  agreedToGuidelines: checked,
                  agreedToDataProcessing: checked
                  // Note: agreedToMarketing not included (it's optional)
                });
              }}
            />
            <label className="form-check-label" htmlFor="selectAllAgreements">
              ✅ Select All Required Agreements
            </label>
          </div>

          <hr className="my-3" />
          
          {/* Age Verification */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="ageConfirmation"
              checked={formData.agreedToAge}
              onChange={(e) => setFormData({...formData, agreedToAge: e.target.checked})}
              required
            />
            <label className="form-check-label" htmlFor="ageConfirmation">
              <strong>I confirm that I am at least 18 years old</strong> and have legal capacity to enter into a binding agreement.
            </label>
          </div>

          {/* Terms of Service */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="termsAgreement"
              checked={formData.agreedToTerms}
              onChange={(e) => setFormData({...formData, agreedToTerms: e.target.checked})}
              required
            />
            <label className="form-check-label" htmlFor="termsAgreement">
              I have read and agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary">
                Terms of Service
              </a>
            </label>
          </div>

          {/* Privacy Policy */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="privacyAgreement"
              checked={formData.agreedToPrivacy}
              onChange={(e) => setFormData({...formData, agreedToPrivacy: e.target.checked})}
              required
            />
            <label className="form-check-label" htmlFor="privacyAgreement">
              I have read and agree to the{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary">
                Privacy Policy
              </a>
            </label>
          </div>

          {/* Community Guidelines */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="guidelinesAgreement"
              checked={formData.agreedToGuidelines}
              onChange={(e) => setFormData({...formData, agreedToGuidelines: e.target.checked})}
              required
            />
            <label className="form-check-label" htmlFor="guidelinesAgreement">
              I agree to follow the{' '}
              <a href="/community-guidelines" target="_blank" rel="noopener noreferrer" className="text-primary">
                Community Guidelines
              </a>
            </label>
          </div>

          {/* Data Processing Consent (GDPR) */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="dataProcessingConsent"
              checked={formData.agreedToDataProcessing}
              onChange={(e) => setFormData({...formData, agreedToDataProcessing: e.target.checked})}
              required
            />
            <label className="form-check-label" htmlFor="dataProcessingConsent">
              I consent to the processing of my personal data for matchmaking purposes as described in the Privacy Policy
            </label>
          </div>

          {/* Marketing Communications (Optional) */}
          <div className="form-check mb-3">
            <input
              type="checkbox"
              className="form-check-input"
              id="marketingConsent"
              checked={formData.agreedToMarketing}
              onChange={(e) => setFormData({...formData, agreedToMarketing: e.target.checked})}
            />
            <label className="form-check-label" htmlFor="marketingConsent">
              <em>(Optional)</em> I would like to receive updates, promotions, and newsletters
            </label>
          </div>
        </div>
        )}

        {/* Submit Button - AFTER Legal Agreements */}
        <div className="text-center mt-4">
          <button className="btn btn-success btn-lg px-5" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                {isEditMode ? 'Saving Changes...' : 'Creating Your Profile...'}
              </>
            ) : (
              isEditMode ? "💾 Save Changes" : "Register My Profile 🚀"
            )}
          </button>
          <p className="text-muted small mt-2">
            By clicking "Complete Registration", you confirm that you have filled out all required fields 
            and agreed to all legal agreements above.
          </p>
        </div>
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

      {/* Draft Recovery Modal */}
      {showDraftModal && draftData && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                color: 'white',
                border: 'none'
              }}>
                <h5 className="modal-title">
                  💾 Saved Draft Found
                </h5>
              </div>
              <div className="modal-body p-4">
                <p className="lead mb-3">
                  Found a saved draft from <strong>{new Date(draftData.lastSaved).toLocaleDateString()}</strong> at{' '}
                  <strong>{new Date(draftData.lastSaved).toLocaleTimeString()}</strong>
                </p>
                <p className="text-muted">
                  Would you like to continue where you left off?
                </p>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-outline-secondary" 
                  onClick={handleDiscardDraft}
                >
                  Start Fresh
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleRestoreDraft}
                >
                  Continue Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
    </>
  );
};

export default Register2;
