import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function SearchableCombobox({ 
  label, 
  value, 
  onChange, 
  options, 
  placeholder, 
  required, 
  errorMsg,
  touched,
  setTouched
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  // Sync internal search state with value
  useEffect(() => {
    setSearch(value);
  }, [value]);

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSearch(val);
    onChange(val);
    setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleFocus = () => {
    setIsOpen(true);
    setTouched(true);
  };

  const handleSelectOption = (opt) => {
    onChange(opt);
    setSearch(opt);
    setIsOpen(false);
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelectOption(filteredOptions[highlightedIndex]);
      } else if (search.trim()) {
        handleSelectOption(search);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const hasError = required && touched && !value.trim();

  return (
    <div className="combobox-container" ref={containerRef}>
      <label className="form-group label" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-main)' }}>
        {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      <div className="combobox-input-wrapper">
        <input
          type="text"
          className={`form-control ${hasError ? 'error' : value.trim() ? 'success' : ''}`}
          value={search}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="combobox-toggle"
          onClick={() => {
            setIsOpen(!isOpen);
            setTouched(true);
          }}
          aria-label={`Toggle dropdown for ${label}`}
        >
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {isOpen && (
        <ul className="combobox-dropdown">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, i) => (
              <li
                key={i}
                onClick={() => handleSelectOption(opt)}
                className={`combobox-option ${value === opt ? 'selected' : ''}`}
                style={{
                  background: highlightedIndex === i || value === opt ? '#f1f5f9' : 'transparent',
                }}
              >
                {opt}
              </li>
            ))
          ) : (
            <li className="combobox-no-options">
              Press Enter to use custom: "{search}"
            </li>
          )}
        </ul>
      )}
      {hasError && <span className="error-message">{errorMsg}</span>}
    </div>
  );
}

function StudentForm() {
  const [name, setName] = useState('');
  const [currentCourse, setCurrentCourse] = useState('');
  const [interestedField, setInterestedField] = useState('');
  
  const [isNameTouched, setIsNameTouched] = useState(false);
  const [isCourseTouched, setIsCourseTouched] = useState(false);
  const [isFieldTouched, setIsFieldTouched] = useState(false);

  const navigate = useNavigate();

  const commonCourses = [
    'B.Tech',
    'BCA',
    'B.Sc',
    'BBA',
    'Class 10',
    'Class 12',
    'Diploma',
    'MCA',
    'M.Tech',
    'Other'
  ];

  const commonFields = [
    'Artificial Intelligence',
    'Machine Learning',
    'Data Science',
    'Web Development',
    'Python',
    'Java',
    'Mathematics',
    'Physics',
    'Chemistry',
    'Computer Science',
    'Other'
  ];

  const handleContinue = (e) => {
    e.preventDefault();
    if (!name.trim() || !currentCourse.trim() || !interestedField.trim()) {
      return;
    }
    
    // Store student data in localStorage
    localStorage.setItem('studentName', name.trim());
    localStorage.setItem('currentCourse', currentCourse.trim());
    localStorage.setItem('interestedCourse', interestedField.trim());
    
    navigate('/quiz-config');
  };

  const isNameError = isNameTouched && !name.trim();
  const isFormValid = name.trim() !== '' && currentCourse.trim() !== '' && interestedField.trim() !== '';

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '500px', margin: '4rem auto' }}>
        <h2 className="title">Student Performance Analyzer</h2>
        <p style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)' }}>
          Create your profile to begin the assessment
        </p>

        <form onSubmit={handleContinue}>
          {/* Student Name */}
          <div className="form-group">
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-main)' }}>
              Student Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input 
              type="text" 
              className={`form-control ${isNameError ? 'error' : name.trim() ? 'success' : ''}`} 
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIsNameTouched(true);
              }}
              onBlur={() => setIsNameTouched(true)}
              placeholder="Enter your full name"
              required 
            />
            {isNameError && <span className="error-message">Student Name is required</span>}
          </div>

          {/* Current Course Searchable Dropdown */}
          <SearchableCombobox 
            label="Current Course"
            value={currentCourse}
            onChange={setCurrentCourse}
            options={commonCourses}
            placeholder="e.g. BCA, Class 12, B.Tech"
            required={true}
            errorMsg="Current Course is required"
            touched={isCourseTouched}
            setTouched={setIsCourseTouched}
          />

          {/* Interested Field Searchable Dropdown */}
          <SearchableCombobox 
            label="Interested Field"
            value={interestedField}
            onChange={setInterestedField}
            options={commonFields}
            placeholder="e.g. Machine Learning, Physics"
            required={true}
            errorMsg="Interested Field is required"
            touched={isFieldTouched}
            setTouched={setIsFieldTouched}
          />

          <button 
            type="submit" 
            className="btn btn-primary mt-4" 
            disabled={!isFormValid}
          >
            Start Quiz
          </button>
        </form>
      </div>
    </div>
  );
}

export default StudentForm;
