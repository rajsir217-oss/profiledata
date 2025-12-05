import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { EducationHistory, WorkExperience, TextAreaWithSamples, GenderSelector, Autocomplete } from "./shared";
import { US_STATES, US_CITIES_BY_STATE } from "../data/usLocations";
import Logo from "./Logo";
import "./Register.css";

const Register = () => {
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
    dateOfBirth: "",  // Renamed from dob
    gender: "",  // Renamed from sex
    heightFeet: "",  // Feet: 4-7
    heightInches: "",  // Inches: 0-11
    profileCreatedBy: "me",  // Who created this profile
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
      location: "Any Location",
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
  const [images, setImages] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [savedUser, setSavedUser] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [touchedFields, setTouchedFields] = useState({});
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
      
      case "passwordConfirm":
        if (!value) {
          error = "Please confirm your password";
        } else if (value !== formData.password) {
          error = "Passwords do not match";
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
        if (!value.trim()) {
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

  // Education and Work Experience handlers are now in shared components

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

  // Helper function to scroll to and focus a field
  const scrollToAndFocusField = (fieldName) => {
    // Try to find the input element by name or id
    const inputElement = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
    
    if (inputElement) {
      // Scroll to the element with offset for better visibility
      const elementPosition = inputElement.getBoundingClientRect().top + window.pageYOffset;
      const offsetPosition = elementPosition - 100; // 100px offset from top
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
      
      // Focus and select the input after scrolling
      setTimeout(() => {
        inputElement.focus();
        if (inputElement.select && inputElement.type !== 'checkbox') {
          inputElement.select(); // Select text if it's a text input
        }
      }, 300); // Wait for smooth scroll to complete
    } else {
      // Fallback to scrolling to top if element not found
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setSavedUser(null);

    // Validate legal consents first
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (!formData.workExperience || formData.workExperience.length === 0) {
      setErrorMsg("❌ Please add at least one work experience entry using the '+ Add' button in the Work Experience section");
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    
    images.forEach((img) => data.append("images", img));

    try {
      setIsSubmitting(true);
      
      // Step 1: Register user (email is sent automatically by backend)
      const res = await api.post("/register", data);

      // Step 2: Fetch the saved user profile from backend to get final image URLs
      const profileRes = await api.get(`/profile/${formData.username}`);
      setSavedUser(profileRes.data);
      
      // Step 3: Show success modal
      setSuccessMsg(res.data.message);
      setShowSuccessModal(true);
      
      // Step 4: Redirect to login after 5 seconds
      setTimeout(() => {
        navigate('/login');
      }, 5000);

    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
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
    <div className="register-container">
      <div className="card p-4 shadow">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <Logo variant="modern" size="medium" showText={true} theme="light" />
        </div>
      <h3 className="text-center mb-3">Create Your Profile</h3>
      {errorMsg && <div className="alert alert-danger">{errorMsg}</div>}
      {successMsg && <div className="alert alert-success">{successMsg}</div>}
      <form onSubmit={handleSubmit} encType="multipart/form-data">
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

        {/* Custom row for contactNumber and contactEmail */}
        <div className="row mb-3">
          <div className="col-md-6">
            <label className="form-label">Contact Number</label>
            <input 
              type="text" 
              className={`form-control ${getFieldClass('contactNumber', formData.contactNumber)} ${fieldErrors.contactNumber && touchedFields.contactNumber ? 'is-invalid' : ''}`}
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
            <label className="form-label">Contact Email</label>
            <input 
              type="email" 
              className={`form-control ${getFieldClass('contactEmail', formData.contactEmail)} ${fieldErrors.contactEmail && touchedFields.contactEmail ? 'is-invalid' : ''}`}
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
              <Autocomplete
                value={formData.state}
                onChange={(value) => {
                  setFormData({ ...formData, state: value, location: '' });
                  setFieldErrors({ ...fieldErrors, state: '' });
                  setTouchedFields({ ...touchedFields, state: true });
                }}
                suggestions={US_STATES}
                placeholder="Type to search states..."
                name="state"
                className={`${getFieldClass('state', formData.state)} ${fieldErrors.state && touchedFields.state ? 'is-invalid' : ''}`}
              />
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
            <label className="form-label">City/Town (Optional)</label>
            {formData.countryOfResidence === 'US' && formData.state && US_CITIES_BY_STATE[formData.state] ? (
              <Autocomplete
                value={formData.location}
                onChange={(value) => {
                  setFormData({ ...formData, location: value });
                }}
                suggestions={US_CITIES_BY_STATE[formData.state]}
                placeholder="Type to search cities..."
                name="location"
                disabled={!formData.state}
                className={getFieldClass('location', formData.location)}
              />
            ) : (
              <input
                type="text"
                className="form-control"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Bangalore, New York City"
              />
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
              <label className="form-label">Minimum Height (shortest acceptable)</label>
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
                <option value="-24">2 feet shorter</option>
                <option value="-12">1 foot shorter</option>
                <option value="-6">6 inches shorter</option>
                <option value="-4">4 inches shorter</option>
                <option value="-3">3 inches shorter</option>
                <option value="-2">2 inches shorter</option>
                <option value="-1">1 inch shorter</option>
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
            <div className="col-md-6">
              <label className="form-label">Maximum Height (tallest acceptable)</label>
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
                <option value="-24">2 feet shorter</option>
                <option value="-12">1 foot shorter</option>
                <option value="-6">6 inches shorter</option>
                <option value="-4">4 inches shorter</option>
                <option value="-3">3 inches shorter</option>
                <option value="-2">2 inches shorter</option>
                <option value="-1">1 inch shorter</option>
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
            <label className="form-label">Preferred Locations</label>
            <input
              type="text"
              className="form-control"
              value={formData.partnerCriteria.location}
              onChange={(e) => {
                setFormData(prev => ({
                  ...prev,
                  partnerCriteria: { ...prev.partnerCriteria, location: e.target.value }
                }));
              }}
              placeholder="e.g., Any Location, California, New York, etc."
            />
            <small className="text-muted">Enter preferred locations (comma-separated or free text)</small>
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

        {/* Legal Agreements Section */}
        <div className="legal-agreements-section mt-4 p-4 border rounded" style={{ backgroundColor: '#fff3cd', borderColor: '#ffc107' }}>
          <h5 className="text-danger mb-3">⚠️ Legal Agreements (Required)</h5>
          
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

        <button className="btn btn-success" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Creating Profile...
            </>
          ) : (
            'Create Profile'
          )}
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
      
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header" style={{
                background: 'linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%)',
                color: 'white',
                border: 'none'
              }}>
                <h5 className="modal-title">
                  ✅ Profile Created Successfully!
                </h5>
              </div>
              <div className="modal-body text-center p-4">
                <div className="mb-3">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <h4>Check Your Email!</h4>
                </div>
                <p className="lead">
                  We've sent a verification email to <strong>{formData.contactEmail}</strong>
                </p>
                <div className="alert alert-info" role="alert">
                  <strong>📧 Next Steps:</strong>
                  <ol className="text-start mt-2 mb-0">
                    <li>Check your email inbox (and spam folder)</li>
                    <li>Click the verification link</li>
                    <li>Wait for admin approval (usually within 24 hours)</li>
                    <li>Start matching!</li>
                  </ol>
                </div>
                <p className="text-muted">
                  Redirecting to login page in 5 seconds...
                </p>
              </div>
              <div className="modal-footer justify-content-center">
                <button 
                  className="btn btn-primary" 
                  onClick={() => navigate('/login')}
                >
                  Go to Login Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Register;
