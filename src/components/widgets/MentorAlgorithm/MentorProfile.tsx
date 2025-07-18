import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import './MentorProgram.css';
import industriesList from '../../../constants/industries';
import hobbiesByCategory from '../../../constants/hobbiesByCategory';
import ethnicityOptions from '../../../constants/ethnicityOptions';
import religionOptions from '../../../constants/religionOptions';
import ukEducationLevels from '../../../constants/ukEducationLevels';
import { MentorMenteeProfile } from './algorithm/matchUsers';
import MentorAvailability from './MentorAvailability';
import MentorBookings from './booking/MentorBookings';
import CalComModal from './CalCom/CalComModal';
import CalComConnect from './CalCom/CalComConnect';

export default function MentorProfile() {
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<MentorMenteeProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [animateIn, setAnimateIn] = useState(false);
  // Restore top-level tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'availability' | 'bookings'>('profile');
  // Add main tab state for profile sections
  const [mainTab, setMainTab] = useState<'personal' | 'education' | 'skills' | 'additional'>('personal');
  // Add subtab state for skills/hobbies
  const [skillsTab, setSkillsTab] = useState<'skills' | 'hobbies'>('skills');
  const [calComModalOpen, setCalComModalOpen] = useState(false);
  const [calComConnectOpen, setCalComConnectOpen] = useState(false);

  useEffect(() => {
    setAnimateIn(false);
    const fetchProfile = async () => {
      if (!currentUser) return;
      
      try {
        const mentorDoc = await getDoc(doc(db, 'mentorProgram', currentUser.uid));
        if (mentorDoc.exists()) {
          setProfile(mentorDoc.data() as MentorMenteeProfile);
        }
      } catch (err) {
        setError('Failed to load profile');
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
        setTimeout(() => setAnimateIn(true), 100); // trigger entrance animation
      }
    };

    fetchProfile();
  }, [currentUser]);

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!currentUser || !profile) return;

    try {
      // Convert profile to a plain object for Firestore
      const profileData = {
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        age: profile.age || '',
        degree: profile.degree || '',
        educationLevel: profile.educationLevel || '',
        county: profile.county || '',
        profession: profile.profession || '',
        pastProfessions: profile.pastProfessions || [],
        linkedin: profile.linkedin || '',
        calCom: profile.calCom || '',
        hobbies: profile.hobbies || [],
        ethnicity: profile.ethnicity || '',
        religion: profile.religion || '',
        skills: profile.skills || [],
        lookingFor: profile.lookingFor || [],
        industries: profile.industries || [],
      };

      await updateDoc(doc(db, 'mentorProgram', currentUser.uid), profileData);
      setSuccess('Profile updated successfully');
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update profile');
      console.error('Error updating profile:', err);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    setSuccess(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (!profile) return;
    const { name, value } = e.target;
    setProfile(prev => prev ? { ...prev, [name]: value } : null);
  };

  if (loading) {
    return <div className="mentor-profile-loading">Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div className="mentor-profile-empty">
        <p>You haven't signed up as a mentor or mentee yet.</p>
        <p>Please complete the sign-up form to create your profile.</p>
      </div>
    );
  }

  return (
    <div className={`mentor-profile mentor-profile-animate${animateIn ? ' in' : ''}`}>
      {profile && (
        <div className="mentor-profile-tabs" style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          <button className={activeTab === 'profile' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setActiveTab('profile')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === 'profile' ? '#ff2a2a' : '#181818', color: activeTab === 'profile' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Profile</button>
          {profile.type === 'mentor' && (
            <button className={activeTab === 'availability' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setActiveTab('availability')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === 'availability' ? '#ff2a2a' : '#181818', color: activeTab === 'availability' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Availability</button>
          )}
          <button className={activeTab === 'bookings' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setActiveTab('bookings')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: activeTab === 'bookings' ? '#ff2a2a' : '#181818', color: activeTab === 'bookings' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Bookings</button>
        </div>
      )}
      {/* Top-level tab content */}
      {activeTab === 'profile' && (
        <>
          <div className="mentor-profile-section-tabs" style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <button className={mainTab === 'personal' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setMainTab('personal')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: mainTab === 'personal' ? '#ff2a2a' : '#181818', color: mainTab === 'personal' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Personal Info</button>
            <button className={mainTab === 'education' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setMainTab('education')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: mainTab === 'education' ? '#ff2a2a' : '#181818', color: mainTab === 'education' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Education & Professional</button>
            <button className={mainTab === 'skills' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setMainTab('skills')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: mainTab === 'skills' ? '#ff2a2a' : '#181818', color: mainTab === 'skills' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Skills & Interests</button>
            <button className={mainTab === 'additional' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setMainTab('additional')} style={{ fontWeight: 700, fontSize: '1.08rem', padding: '0.7rem 1.5rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: mainTab === 'additional' ? '#ff2a2a' : '#181818', color: mainTab === 'additional' ? '#fff' : '#ff2a2a', transition: 'all 0.18s' }}>Additional Info</button>
          </div>
          {mainTab === 'personal' && (
            <div className="mentor-profile-section mentor-profile-section-animate">
              <h4>Personal Information</h4>
                <div className="mentor-profile-field">
                  <label>Name</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={profile.name || ''}
                      onChange={handleChange}
                      required
                    />
                  ) : (
                    <p className="mentor-profile-value">{profile.name}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>Email</label>
                  <p className="mentor-profile-value">{profile.email}</p>
                </div>
                <div className="mentor-profile-field">
                  <label>Phone</label>
                  {isEditing ? (
                    <input
                      type="tel"
                      name="phone"
                      value={profile.phone || ''}
                      onChange={handleChange}
                      required
                    />
                  ) : (
                    <p className="mentor-profile-value">{profile.phone}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>Age</label>
                  {isEditing ? (
                    <input
                      type="number"
                      name="age"
                      value={profile.age || ''}
                      onChange={handleChange}
                      required
                      min="10"
                      max="100"
                    />
                  ) : (
                    <p className="mentor-profile-value">{profile.age}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>County</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="county"
                      value={profile.county || ''}
                      onChange={handleChange}
                      required
                    />
                  ) : (
                    <p className="mentor-profile-value">{profile.county}</p>
                  )}
                </div>
            </div>
          )}
          {mainTab === 'education' && (
            <div className="mentor-profile-section mentor-profile-section-animate">
              <h4>Education & Professional</h4>
                <div className="mentor-profile-field">
                  <label>Degree</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="degree"
                      value={profile.degree || ''}
                      onChange={handleChange}
                      required
                    />
                  ) : (
                    <p className="mentor-profile-value">{profile.degree}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>Education Level</label>
                  {isEditing ? (
                    <select
                      name="educationLevel"
                      value={profile.educationLevel || ''}
                      onChange={handleChange}
                      required
                      style={{ padding: '0.85rem 1rem', borderRadius: 8, border: '1.5px solid #3a0a0a', background: '#181818', color: '#fff', fontSize: '1rem', width: '100%' }}
                    >
                      <option value="">Select Education Level</option>
                      {ukEducationLevels
                        .filter(level => {
                          // For mentees, only show up to Bachelor's degree
                          if (profile.type === 'mentee') {
                            const menteeLevels = [
                              'GCSEs', 'A-Levels', 'BTEC', 'Foundation Degree', "Bachelor's Degree"
                            ];
                            return menteeLevels.includes(level);
                          }
                          // For mentors, show all levels
                          return true;
                        })
                        .map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                    </select>
                  ) : (
                    <p className="mentor-profile-value">{profile.educationLevel}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label className="mentor-profile-label">{profile.type === 'mentee' ? 'Desired Profession' : 'Current Profession'}</label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="profession"
                      value={profile.profession || ''}
                      onChange={handleChange}
                      required
                      className="mentor-profile-input"
                      style={{ width: '100%', padding: '0.8rem', border: '1.5px solid #3a0a0a', borderRadius: 8, background: '#181818', color: '#fff', fontSize: '1rem', marginBottom: 0 }}
                    />
                  ) : (
                    <p className="mentor-profile-value">{profile.profession}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>Past Professions</label>
                  {isEditing ? (
                    <div className="mentor-profile-list">
                      {profile.pastProfessions.map((prof, idx) => (
                        <input
                          key={idx}
                          type="text"
                          value={prof}
                          onChange={(e) => {
                            const newPastProfessions = [...profile.pastProfessions];
                            newPastProfessions[idx] = e.target.value;
                            setProfile(prev => prev ? { ...prev, pastProfessions: newPastProfessions } : null);
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mentor-profile-list mentor-profile-chips">
                      {profile.pastProfessions.map((prof, idx) => (
                        <span className="mentor-profile-chip" key={idx}>{prof}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>LinkedIn</label>
                  {isEditing ? (
                    <input
                      type="url"
                      name="linkedin"
                      value={profile.linkedin || ''}
                      onChange={handleChange}
                      pattern="https?://(www\\.)?linkedin\\.com/in/[A-Za-z0-9_-]+/?"
                      title="Please enter a valid LinkedIn profile URL"
                    />
                  ) : (
                    <p className="mentor-profile-value">
                      {profile.linkedin ? (
                        <a
                          href={profile.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mentor-profile-linkedin-btn"
                          title="View LinkedIn Profile"
                        >
                          <svg className="linkedin-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 6, verticalAlign: 'middle' }}><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-10h3v10zm-1.5-11.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm15.5 11.268h-3v-5.604c0-1.337-.025-3.063-1.868-3.063-1.868 0-2.154 1.459-2.154 2.967v5.7h-3v-10h2.881v1.367h.041c.401-.761 1.379-1.563 2.838-1.563 3.034 0 3.595 1.997 3.595 4.594v5.602z"/></svg>
                          LinkedIn
                        </a>
                      ) : (
                        'Not provided'
                      )}
                    </p>
                  )}
                </div>
                {profile.type === 'mentor' && (
                  <div className="mentor-profile-field">
                    <label>Cal.com</label>
                    {isEditing ? (
                      <input
                        type="url"
                        name="calCom"
                        value={profile.calCom || ''}
                        onChange={handleChange}
                        required
                        pattern="https?://.*\.cal\.com/.*"
                        title="Please enter a valid Cal.com URL (e.g. https://yourname.cal.com/30min)"
                      />
                    ) : (
                      <p className="mentor-profile-value">
                        {profile.calCom ? (
                          <a
                            href={profile.calCom}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mentor-profile-calcom-btn"
                            title="Book a session"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '0.4rem 0.8rem',
                              background: 'linear-gradient(90deg, #ff2a2a 60%, #a80000 100%)',
                              color: '#fff',
                              textDecoration: 'none',
                              borderRadius: 6,
                              fontSize: '0.9rem',
                              fontWeight: 600,
                              transition: 'all 0.2s',
                              boxShadow: '0 2px 8px rgba(255,42,42,0.2)'
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                            </svg>
                            Book Session
                          </a>
                        ) : (
                          'Not provided'
                        )}
                      </p>
                    )}
                    {profile.type === 'mentor' && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <button
                          onClick={() => setCalComConnectOpen(true)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '0.4rem 0.8rem',
                            background: 'transparent',
                            color: '#ff2a2a',
                            border: '1px solid #ff2a2a',
                            borderRadius: 6,
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                          title="Connect Cal.com API for advanced booking management"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                          </svg>
                          Connect API
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="mentor-profile-field">
                  <label>{profile.type === 'mentor' ? 'Industries (Current/Previous)' : 'Industries (Desired)'}</label>
                  {isEditing ? (
                    <>
                      <select
                        name="industries"
                        multiple
                        value={profile.industries || []}
                        onChange={e => {
                          const options = Array.from(e.target.selectedOptions, o => o.value);
                          setProfile(prev => prev ? { ...prev, industries: options } : null);
                        }}
                        style={{ minHeight: 90, background: '#181818', color: '#fff', border: '1.5px solid #3a0a0a', borderRadius: 8, padding: '0.7rem 1rem', fontSize: '1rem' }}
                      >
                        {industriesList.map(ind => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                      {profile.industries && profile.industries.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {profile.industries.map((industry) => (
                            <span className="mentor-profile-chip mentor-profile-industry-chip" key={industry} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {industry}
                              <button
                                type="button"
                                aria-label={`Remove ${industry}`}
                                onClick={e => {
                                  e.preventDefault();
                                  setProfile(prev => prev ? { ...prev, industries: prev.industries.filter((i: string) => i !== industry) } : null);
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#00eaff',
                                  fontWeight: 700,
                                  fontSize: 18,
                                  cursor: 'pointer',
                                  marginLeft: 2,
                                  lineHeight: 1
                                }}
                              >×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="mentor-profile-list mentor-profile-chips mentor-profile-industries-chips">
                      {(profile.industries || []).map((industry, idx) => (
                        <span className="mentor-profile-chip mentor-profile-industry-chip mentor-profile-chip-animate" style={{ animationDelay: `${0.05 * idx + 0.1}s` }} key={idx}>{industry}</span>
                      ))}
                    </div>
                  )}
                </div>
            </div>
          )}
          {mainTab === 'skills' && (
            <div className="mentor-profile-section mentor-profile-section-animate">
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <button className={skillsTab === 'skills' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setSkillsTab('skills')} style={{ fontWeight: 700, fontSize: '1.02rem', padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: skillsTab === 'skills' ? '#ffb300' : '#181818', color: skillsTab === 'skills' ? '#181818' : '#ffb300', transition: 'all 0.18s' }}>Skills Offered</button>
                <button className={skillsTab === 'hobbies' ? 'mentor-profile-tab-active' : 'mentor-profile-tab'} onClick={() => setSkillsTab('hobbies')} style={{ fontWeight: 700, fontSize: '1.02rem', padding: '0.5rem 1.2rem', borderRadius: 8, border: 'none', cursor: 'pointer', background: skillsTab === 'hobbies' ? '#ffb300' : '#181818', color: skillsTab === 'hobbies' ? '#181818' : '#ffb300', transition: 'all 0.18s' }}>Hobbies & Interests</button>
              </div>
              {skillsTab === 'skills' && (
                <div className="mentor-profile-skills mentor-profile-chips" style={{ flexWrap: 'wrap', gap: 8, fontSize: '0.95rem' }}>
                  {(profile.type === 'mentor' ? profile.skills : profile.lookingFor).map((skill, idx) => (
                    <span className="mentor-profile-chip mentor-profile-skill-chip mentor-profile-chip-animate" style={{ animationDelay: `${0.05 * idx + 0.1}s`, padding: '4px 10px', fontSize: '0.95rem' }} key={idx}>{skill}</span>
                  ))}
                </div>
              )}
              {skillsTab === 'hobbies' && (
                <div className="mentor-profile-list mentor-profile-chips mentor-profile-hobbies-chips" style={{ flexWrap: 'wrap', gap: 8, fontSize: '0.95rem' }}>
                  {profile.hobbies && profile.hobbies.length > 0 ? (
                    Object.entries(hobbiesByCategory).map(([category, hobbies]) => (
                      <React.Fragment key={category}>
                        {profile.hobbies.some(hobby => hobbies.includes(hobby)) && (
                          <div style={{ marginBottom: 4 }}>
                            <div style={{ fontWeight: 700, color: '#ffb300', fontSize: '1.02rem', margin: '0.5rem 0 0.2rem 0.7rem' }}>{category.replace(/([A-Z])/g, ' $1').trim()}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                              {hobbies.filter(hobby => profile.hobbies.includes(hobby)).map((hobby, idx) => (
                                <span className="mentor-profile-chip mentor-profile-hobby-chip mentor-profile-chip-animate" style={{ animationDelay: `${0.05 * idx + 0.1}s`, padding: '4px 10px', fontSize: '0.95rem' }} key={hobby}>{hobby}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <p className="mentor-profile-value">Not specified</p>
                  )}
                </div>
              )}
            </div>
          )}
          {mainTab === 'additional' && (
            <div className="mentor-profile-section mentor-profile-section-animate">
              <h4>Additional Information</h4>
                <div className="mentor-profile-field">
                  <label>Ethnicity</label>
                  {isEditing ? (
                    <select
                      name="ethnicity"
                      value={profile.ethnicity || ''}
                      onChange={handleChange}
                      style={{ padding: '0.85rem 1rem', borderRadius: 8, border: '1.5px solid #3a0a0a', background: '#181818', color: '#fff', fontSize: '1rem', width: '100%' }}
                    >
                      <option value="">Select Ethnicity</option>
                      {ethnicityOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="mentor-profile-value">{profile.ethnicity || 'Not specified'}</p>
                  )}
                </div>
                <div className="mentor-profile-field">
                  <label>Religion</label>
                  {isEditing ? (
                    <select
                      name="religion"
                      value={profile.religion || ''}
                      onChange={handleChange}
                      style={{ padding: '0.85rem 1rem', borderRadius: 8, border: '1.5px solid #3a0a0a', background: '#181818', color: '#fff', fontSize: '1rem', width: '100%' }}
                    >
                      <option value="">Select Religion</option>
                      {religionOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="mentor-profile-value">{profile.religion || 'Not specified'}</p>
                  )}
                </div>
            </div>
          )}
        </>
      )}
      {activeTab === 'availability' && profile && profile.type === 'mentor' && <MentorAvailability />}
      {activeTab === 'bookings' && profile && <MentorBookings />}

      <CalComModal open={calComModalOpen} onClose={() => setCalComModalOpen(false)} mentor={profile} />
      <CalComConnect 
        open={calComConnectOpen} 
        onClose={() => setCalComConnectOpen(false)} 
        onSuccess={() => {
          setCalComConnectOpen(false);
          // Optionally refresh profile data
        }}
      />
      {profile?.type === 'mentor' && (
        <div className="mentor-profile-actions">
          {!isEditing ? (
            <button onClick={handleEdit} className="mentor-profile-edit-btn mentor-profile-btn-animate">
              <FaEdit /> Edit Profile
            </button>
          ) : (
            <>
              <button onClick={handleSave} className="mentor-profile-save-btn mentor-profile-btn-animate">
                <FaSave /> Save
              </button>
              <button onClick={handleCancel} className="mentor-profile-cancel-btn mentor-profile-btn-animate">
                <FaTimes /> Cancel
              </button>
            </>
          )}
        </div>
      )}
      {error && <div className="mentor-profile-error mentor-profile-fadein">{error}</div>}
      {success && <div className="mentor-profile-success mentor-profile-fadein">{success}</div>}
    </div>
  );
} 