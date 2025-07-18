import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../firebase/firebase';
import { collection, getDocs, deleteDoc, doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { MentorMenteeProfile } from '../widgets/MentorAlgorithm/algorithm/matchUsers';
import { CalComService, CalComBookingResponse, CalComAvailability, CalComTokenManager } from '../widgets/MentorAlgorithm/CalCom/calComService';
import GenerateRandomProfile from './GenerateRandomProfile';
import { FaSync, FaClock, FaUser, FaCalendarAlt, FaChartBar, FaCheck, FaPoundSign } from 'react-icons/fa';
import MentorModal from '../widgets/MentorAlgorithm/MentorModal';
import '../../styles/adminStyles/MentorManagement.css';
import BookingsTable from './BookingsTable';
import BookingDetailsModal from './BookingDetailsModal';
import BookingsGrouped from './BookingsGrouped';

// Enhanced Booking interface for admin view with Cal.com support
interface Booking {
  id: string;
  mentorName: string;
  mentorEmail: string;
  menteeName: string;
  menteeEmail: string;
  sessionDate?: Date | string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  meetLink?: string;
  eventId?: string;
  // Cal.com specific fields
  isCalComBooking?: boolean;
  calComBookingId?: string;
  calComEventType?: {
    id: number;
    title: string;
  };
  calComAttendees?: Array<{
    name: string;
    email: string;
    timeZone: string;
  }>;
  // Additional fields for analytics
  createdAt?: Date;
  mentorId?: string;
  menteeId?: string;
  duration?: number; // in minutes
  revenue?: number;
}

// Add Availability interfaces for admin view
interface TimeSlot {
  id: string;
  day?: string; // For recurring
  date?: string; // For specific date (YYYY-MM-DD)
  startTime: string;
  endTime: string;
  isAvailable: boolean;
  type: 'recurring' | 'specific';
}

interface MentorAvailability {
  mentorId: string;
  timeSlots: TimeSlot[];
  lastUpdated: Date;
}

interface MentorAvailabilityWithProfile extends MentorAvailability {
  mentorProfile?: MentorMenteeProfile;
  calComAvailability?: CalComAvailability[];
  hasCalComIntegration?: boolean;
}

interface MentorMenteeProfileWithId extends MentorMenteeProfile {
  id: string;
}

type FirestoreTimestamp = { toDate: () => Date };
function isFirestoreTimestamp(val: unknown): val is FirestoreTimestamp {
  return !!val && typeof val === 'object' && typeof (val as { toDate?: unknown }).toDate === 'function';
}

// Inline BookingAnalytics component
const BookingAnalytics = ({ bookings }: { bookings: Booking[] }) => {
  const analytics = useMemo(() => {
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const calComBookings = bookings.filter(b => b.isCalComBooking).length;
    const internalBookings = bookings.filter(b => !b.isCalComBooking).length;
    const completionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.revenue || 0), 0);

    return { totalBookings, confirmedBookings, calComBookings, internalBookings, completionRate, totalRevenue };
  }, [bookings]);

  return (
    <div>
      <h2 style={{ color: '#ffb300', marginBottom: 16 }}>Booking Analytics Dashboard</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <div style={{ background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <FaCalendarAlt style={{ fontSize: 24, color: '#ffb300', marginBottom: 8 }} />
          <h3 style={{ color: '#ffb300', fontSize: 16, marginBottom: 4 }}>Total Bookings</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{analytics.totalBookings}</p>
        </div>
        <div style={{ background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <FaCheck style={{ fontSize: 24, color: '#00e676', marginBottom: 8 }} />
          <h3 style={{ color: '#00e676', fontSize: 16, marginBottom: 4 }}>Completion Rate</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{analytics.completionRate.toFixed(1)}%</p>
        </div>
        <div style={{ background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <FaPoundSign style={{ fontSize: 24, color: '#00e676', marginBottom: 8 }} />
          <h3 style={{ color: '#00e676', fontSize: 16, marginBottom: 4 }}>Total Revenue</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>£{analytics.totalRevenue}</p>
        </div>
        <div style={{ background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 20, textAlign: 'center' }}>
          <FaClock style={{ fontSize: 24, color: '#00eaff', marginBottom: 8 }} />
          <h3 style={{ color: '#00eaff', fontSize: 16, marginBottom: 4 }}>Cal.com Bookings</h3>
          <p style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>{analytics.calComBookings}</p>
        </div>
      </div>
    </div>
  );
};

export default function MentorManagement() {
  const [users, setUsers] = useState<MentorMenteeProfileWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'mentor' | 'mentee'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState<MentorMenteeProfileWithId | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<MentorMenteeProfileWithId | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tab, setTab] = useState<'users' | 'bookings' | 'availability' | 'analytics'>('users');
  // Bookings state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  // Bookings view mode
  const [bookingsView, setBookingsView] = useState<'table' | 'grouped'>('table');
  const [groupBy, setGroupBy] = useState<'mentor' | 'mentee'>('mentor');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedAvailability, setSelectedAvailability] = useState<MentorAvailabilityWithProfile | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Availability state
  const [availabilityData, setAvailabilityData] = useState<MentorAvailabilityWithProfile[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);
  const [availabilitySearch, setAvailabilitySearch] = useState('');
  const [availabilityStatusFilter, setAvailabilityStatusFilter] = useState<'all' | 'available' | 'booked'>('all');
  const [availabilityTypeFilter, setAvailabilityTypeFilter] = useState<'all' | 'recurring' | 'specific'>('all');

  // Add state for sorting and searching
  const [userSortField, setUserSortField] = useState<'name' | 'type' | 'email' | 'profession' | 'education' | 'county'>('name');
  const [userSortDir, setUserSortDir] = useState<'asc' | 'desc'>('asc');
  const [userSearch, setUserSearch] = useState('');
  const [userTypeFilter, setUserTypeFilter] = useState<'all' | 'mentor' | 'mentee'>('all');
  const [userGeneratedFilter, setUserGeneratedFilter] = useState<'all' | 'generated' | 'real'>('all');

  // Stat tile hover state
  const [hoveredTile, setHoveredTile] = useState<'total' | 'mentors' | 'mentees' | null>(null);

  // Calculate counts
  const realUsers = users.filter(u => !u.isGenerated);
  const generatedUsers = users.filter(u => u.isGenerated);
  const realMentors = realUsers.filter(u => u.type === 'mentor');
  const generatedMentors = generatedUsers.filter(u => u.type === 'mentor');
  const realMentees = realUsers.filter(u => u.type === 'mentee');
  const generatedMentees = generatedUsers.filter(u => u.type === 'mentee');

  const fetchUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'mentorProgram'));
      const usersData = usersSnapshot.docs.map(doc => ({
        ...doc.data() as MentorMenteeProfile,
        id: doc.id
      }));
      setUsers(usersData);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Enhanced fetchBookings function that includes Cal.com bookings
  const fetchBookings = async () => {
    setLoadingBookings(true);
    setBookingsError(null);
    try {
      const results: Booking[] = [];
      
      // Fetch Firestore bookings
      const bookingsSnapshot = await getDocs(collection(db, 'bookings'));
      const firestoreBookings = bookingsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          mentorName: data.mentorName || 'Unknown',
          mentorEmail: data.mentorEmail || 'No email',
          menteeName: data.menteeName || 'Unknown',
          menteeEmail: data.menteeEmail || 'No email',
          sessionDate: data.sessionDate,
          startTime: data.startTime || '',
          endTime: data.endTime || '',
          status: data.status || 'pending',
          meetLink: data.meetLink,
          eventId: data.eventId,
          mentorId: data.mentorId,
          menteeId: data.menteeId,
          createdAt: data.createdAt,
          duration: data.duration || 60,
          revenue: data.revenue || 0,
          isCalComBooking: false
        } as Booking;
      });
      results.push(...firestoreBookings);

      // Fetch Cal.com bookings from all mentors
      try {
        const mentorsSnapshot = await getDocs(collection(db, 'mentorProgram'));
        const mentorPromises = mentorsSnapshot.docs
          .filter(doc => doc.data().type === 'mentor')
          .map(async (mentorDoc) => {
            const mentorData = mentorDoc.data();
            try {
              const calComBookings = await CalComService.getBookings(mentorDoc.id);
              return calComBookings.map((calBooking: CalComBookingResponse) => {
                const startDate = new Date(calBooking.startTime);
                const endDate = new Date(calBooking.endTime);
                
                // Find mentor and mentee from attendees
                const mentor = calBooking.attendees.find(attendee => 
                  attendee.email === mentorData.email
                );
                const mentee = calBooking.attendees.find(attendee => 
                  attendee.email !== mentorData.email
                );
                
                return {
                  id: `calcom-${calBooking.id}`,
                  mentorId: mentorDoc.id,
                  menteeId: mentee?.email || 'unknown',
                  mentorName: mentor?.name || mentorData.name || 'Unknown Mentor',
                  menteeName: mentee?.name || 'Unknown Mentee',
                  mentorEmail: mentor?.email || mentorData.email || '',
                  menteeEmail: mentee?.email || '',
                  sessionDate: startDate,
                  startTime: startDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  endTime: endDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                  status: calBooking.status === 'ACCEPTED' ? 'confirmed' : 
                          calBooking.status === 'PENDING' ? 'pending' : 'cancelled',
                  createdAt: new Date(),
                  duration: (calBooking.eventType as { length?: number; price?: number })?.length || 60,
                  revenue: (calBooking.eventType as { length?: number; price?: number })?.price || 0,
                  isCalComBooking: true,
                  calComBookingId: calBooking.id,
                  calComEventType: calBooking.eventType,
                  calComAttendees: calBooking.attendees
                } as Booking;
              });
            } catch (error) {
              console.error(`Error fetching Cal.com bookings for mentor ${mentorDoc.id}:`, error);
              return [];
            }
          });
        
        const calComResults = await Promise.all(mentorPromises);
        const allCalComBookings = calComResults.flat();
        results.push(...allCalComBookings);
      } catch (error) {
        console.error('Error fetching Cal.com bookings:', error);
        // Continue with Firestore bookings only
      }

      setBookings(results);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setBookingsError('Failed to load bookings');
    } finally {
      setLoadingBookings(false);
    }
  };

  // Fetch availability data when tab is switched to 'availability'
  const fetchAvailability = async () => {
    setLoadingAvailability(true);
    setAvailabilityError(null);
    try {
      const availabilitySnapshot = await getDocs(collection(db, 'mentorAvailability'));
      const availabilityData = availabilitySnapshot.docs.map(doc => ({
        ...doc.data(),
        mentorId: doc.id
      })) as MentorAvailabilityWithProfile[];
      
      // Fetch mentor profiles and Cal.com availability to enrich the data
      const enrichedData = await Promise.all(
        availabilityData.map(async (availability) => {
          try {
            // Fetch mentor profile
            const mentorDoc = await getDoc(doc(db, 'mentorProgram', availability.mentorId));
            if (mentorDoc.exists()) {
              availability.mentorProfile = mentorDoc.data() as MentorMenteeProfile;
            }
            
            // Check if mentor has Cal.com integration
            const hasCalComApiKey = await CalComTokenManager.hasApiKey(availability.mentorId);
            availability.hasCalComIntegration = hasCalComApiKey;
            
            // Fetch Cal.com availability if mentor has integration
            if (hasCalComApiKey) {
              try {
                // Get availability for next 7 days
                const today = new Date();
                const nextWeek = new Date(today);
                nextWeek.setDate(today.getDate() + 7);
                
                const dateFrom = today.toISOString().split('T')[0];
                const dateTo = nextWeek.toISOString().split('T')[0];
                
                const calComAvailability = await CalComService.getAvailability(
                  availability.mentorId,
                  dateFrom,
                  dateTo
                );
                
                availability.calComAvailability = calComAvailability;
              } catch (calComError) {
                console.error(`Error fetching Cal.com availability for mentor ${availability.mentorId}:`, calComError);
                // Don't fail the entire request if Cal.com fails
              }
            }
          } catch (err) {
            console.error(`Error fetching mentor profile for ${availability.mentorId}:`, err);
          }
          return availability;
        })
      );
      
      setAvailabilityData(enrichedData);
    } catch (err) {
      console.error('Error fetching availability:', err);
      setAvailabilityError('Failed to load availability data');
    } finally {
      setLoadingAvailability(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Only fetch bookings when tab is switched to 'bookings'
  useEffect(() => {
    if (tab === 'bookings') {
      fetchBookings();
    }
  }, [tab]);

  // Only fetch availability when tab is switched to 'availability'
  useEffect(() => {
    if (tab === 'availability') {
      fetchAvailability();
    }
  }, [tab]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleDeleteUser = async (user: MentorMenteeProfileWithId) => {
    const confirmed = window.confirm(`Are you sure you want to delete ${user.name} (${user.type})? This cannot be undone.`);
    if (!confirmed) return;
    setDeleteStatus(null);
    try {
      await deleteDoc(doc(db, 'mentorProgram', user.id));
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setDeleteStatus(`Deleted ${user.name} successfully.`);
    } catch {
      setDeleteStatus('Failed to delete user.');
    }
  };

  const handleEditUser = (user: MentorMenteeProfileWithId) => {
    setEditUser(user);
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (updatedUser: MentorMenteeProfile) => {
    if (!editUser) return;
    setDeleteStatus(null);
    try {
      // Update Firestore
      await setDoc(doc(db, 'mentorProgram', editUser.id), updatedUser);
      // Update local state
      setUsers(prev => prev.map(u => u.id === editUser.id ? { ...updatedUser, id: editUser.id } : u));
      setEditModalOpen(false);
      setEditUser(null);
      setDeleteStatus(`Updated ${updatedUser.name} successfully.`);
    } catch {
      setDeleteStatus('Failed to update user.');
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const confirmed = window.confirm(`Are you sure you want to delete ${selectedIds.length} selected user(s)? This cannot be undone.`);
    if (!confirmed) return;
    setDeleteStatus(null);
    try {
      await Promise.all(selectedIds.map(id => deleteDoc(doc(db, 'mentorProgram', id))));
      setUsers(prev => prev.filter(u => !selectedIds.includes(u.id)));
      setSelectedIds([]);
      setDeleteStatus(`Deleted ${selectedIds.length} user(s) successfully.`);
    } catch {
      setDeleteStatus('Failed to delete selected users.');
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesType = userTypeFilter === 'all' || user.type === userTypeFilter;
      const matchesGenerated = userGeneratedFilter === 'all' || 
        (userGeneratedFilter === 'generated' && user.isGenerated) ||
        (userGeneratedFilter === 'real' && !user.isGenerated);
      const s = userSearch.toLowerCase();
      const matchesSearch =
        s === '' ||
        (user.name?.toLowerCase() ?? '').includes(s) ||
        (user.email?.toLowerCase() ?? '').includes(s) ||
        (user.profession?.toLowerCase() ?? '').includes(s);
      return matchesType && matchesGenerated && matchesSearch;
    });
  }, [users, userTypeFilter, userGeneratedFilter, userSearch]);

  const sortedUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let vA: string | undefined, vB: string | undefined;
      if (userSortField === 'name') {
        vA = a.name?.toLowerCase(); vB = b.name?.toLowerCase();
      } else if (userSortField === 'type') {
        vA = a.type; vB = b.type;
      } else if (userSortField === 'email') {
        vA = a.email?.toLowerCase(); vB = b.email?.toLowerCase();
      } else if (userSortField === 'profession') {
        vA = a.profession?.toLowerCase(); vB = b.profession?.toLowerCase();
      } else if (userSortField === 'education') {
        vA = a.educationLevel; vB = b.educationLevel;
      } else if (userSortField === 'county') {
        vA = a.county; vB = b.county;
      }
      if (vA === undefined || vB === undefined) return 0;
      return userSortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
    });
  }, [filteredUsers, userSortField, userSortDir]);

  // Filter and sort availability data
  const filteredAvailability = useMemo(() => {
    return availabilityData.filter(availability => {
      const mentorName = availability.mentorProfile?.name?.toLowerCase() || '';
      const mentorEmail = availability.mentorProfile?.email?.toLowerCase() || '';
      const searchTerm = availabilitySearch.toLowerCase();
      
      // Filter by search term
      if (searchTerm && !mentorName.includes(searchTerm) && !mentorEmail.includes(searchTerm)) {
        return false;
      }
      
      // Filter by status
      if (availabilityStatusFilter !== 'all') {
        const hasMatchingStatus = availability.timeSlots.some(slot => 
          availabilityStatusFilter === 'available' ? slot.isAvailable : !slot.isAvailable
        );
        if (!hasMatchingStatus) return false;
      }
      
      // Filter by type
      if (availabilityTypeFilter !== 'all') {
        const hasMatchingType = availability.timeSlots.some(slot => slot.type === availabilityTypeFilter);
        if (!hasMatchingType) return false;
      }
      
      return true;
    });
  }, [availabilityData, availabilitySearch, availabilityStatusFilter, availabilityTypeFilter]);

  // Admin action handlers
  const handleDeleteBooking = async (booking: Booking) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      setBookings(prev => prev.filter(b => b.id !== booking.id));
      setDetailsModalOpen(false);
    } finally {
      setActionLoading(false);
    }
  };
  const handleUpdateBookingStatus = async (booking: Booking, status: 'confirmed' | 'cancelled') => {
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { status });
      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status } : b));
      setDetailsModalOpen(false);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper functions for availability display
  const getMentorName = (availability: MentorAvailabilityWithProfile) => {
    return availability.mentorProfile?.name || `Mentor ${availability.mentorId.slice(0, 8)}`;
  };

  const getMentorEmail = (availability: MentorAvailabilityWithProfile) => {
    return availability.mentorProfile?.email || 'No email';
  };

  const getTotalSlots = (availability: MentorAvailabilityWithProfile) => {
    return availability.timeSlots.length;
  };

  const getAvailableSlots = (availability: MentorAvailabilityWithProfile) => {
    return availability.timeSlots.filter(slot => slot.isAvailable).length;
  };

  const getBookedSlots = (availability: MentorAvailabilityWithProfile) => {
    return availability.timeSlots.filter(slot => !slot.isAvailable).length;
  };

  // Cal.com availability helper functions
  const getCalComTotalSlots = (availability: MentorAvailabilityWithProfile) => {
    if (!availability.calComAvailability) return 0;
    return availability.calComAvailability.reduce((total, day) => total + day.slots.length, 0);
  };

  const getCalComAvailableSlots = (availability: MentorAvailabilityWithProfile) => {
    if (!availability.calComAvailability) return 0;
    return availability.calComAvailability.reduce((total, day) => 
      total + day.slots.filter(slot => slot.available).length, 0);
  };

  const getCalComBookedSlots = (availability: MentorAvailabilityWithProfile) => {
    if (!availability.calComAvailability) return 0;
    return availability.calComAvailability.reduce((total, day) => 
      total + day.slots.filter(slot => !slot.available).length, 0);
  };

  // Booking statistics helper functions
  const getBookingStats = () => {
    const totalBookings = bookings.length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const calComBookings = bookings.filter(b => b.isCalComBooking).length;
    const internalBookings = bookings.filter(b => !b.isCalComBooking).length;
    const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.revenue || 0), 0);
    const completionRate = totalBookings > 0 ? (confirmedBookings / totalBookings) * 100 : 0;
    
    // Get unique mentors and mentees
    const uniqueMentors = new Set(bookings.map(b => b.mentorId)).size;
    const uniqueMentees = new Set(bookings.map(b => b.menteeId)).size;
    
    // Get today's bookings
    const today = new Date();
    const todayBookings = bookings.filter(b => {
      const bookingDate = b.sessionDate instanceof Date ? b.sessionDate : new Date(b.sessionDate || '');
      return bookingDate.toDateString() === today.toDateString();
    }).length;
    
    // Get this week's bookings
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const thisWeekBookings = bookings.filter(b => {
      const bookingDate = b.sessionDate instanceof Date ? b.sessionDate : new Date(b.sessionDate || '');
      return bookingDate >= weekStart && bookingDate <= weekEnd;
    }).length;

    return {
      totalBookings,
      confirmedBookings,
      pendingBookings,
      cancelledBookings,
      calComBookings,
      internalBookings,
      totalRevenue,
      completionRate,
      uniqueMentors,
      uniqueMentees,
      todayBookings,
      thisWeekBookings
    };
  };

  if (loading) {
    return <div className="mentor-management-loading">Loading users...</div>;
  }

  if (error) {
    return <div className="mentor-management-error">{error}</div>;
  }

  return (
    <div className="mentor-management">
      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          <FaUser style={{ marginRight: 8 }} />
          Users
        </button>
        <button className={tab === 'bookings' ? 'active' : ''} onClick={() => setTab('bookings')}>
          <FaCalendarAlt style={{ marginRight: 8 }} />
          Bookings
        </button>
        <button className={tab === 'availability' ? 'active' : ''} onClick={() => setTab('availability')}>
          <FaClock style={{ marginRight: 8 }} />
          Availability
        </button>
        <button className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>
          <FaChartBar style={{ marginRight: 8 }} />
          Analytics
        </button>
      </div>
      
      {/* USERS TAB */}
      {tab === 'users' && (
        <>
          <div className="mentor-management-header">
            <h2>Mentor Program Management</h2>
            <div className="mentor-management-controls">
              {/* In the users tab, add search and filter controls above the table */}
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search name, email, or profession..." style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #3a0a0a', background: '#181818', color: '#fff', fontSize: 15, minWidth: 180 }} />
                <select value={userTypeFilter} onChange={e => setUserTypeFilter(e.target.value as 'all' | 'mentor' | 'mentee')} style={{ padding: '6px 12px', borderRadius: 8, background: '#222', color: '#fff', fontWeight: 600 }}>
                  <option value="all">All Types</option>
                  <option value="mentor">Mentor</option>
                  <option value="mentee">Mentee</option>
                </select>
                <select value={userGeneratedFilter} onChange={e => setUserGeneratedFilter(e.target.value as 'all' | 'generated' | 'real')} style={{ padding: '6px 12px', borderRadius: 8, background: '#222', color: '#fff', fontWeight: 600 }}>
                  <option value="all">All Profiles</option>
                  <option value="real">Real Profiles</option>
                  <option value="generated">Generated Profiles</option>
                </select>
              </div>
              <div className="mentor-management-filters">
                <button
                  className={filter === 'all' ? 'active' : ''}
                  onClick={() => setFilter('all')}
                >
                  All
                </button>
                <button
                  className={filter === 'mentor' ? 'active' : ''}
                  onClick={() => setFilter('mentor')}
                >
                  Mentors
                </button>
                <button
                  className={filter === 'mentee' ? 'active' : ''}
                  onClick={() => setFilter('mentee')}
                >
                  Mentees
                </button>
                <button
                  className="refresh-button"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <FaSync className={refreshing ? 'spinning' : ''} /> Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="mentor-management-stats">
            <div className="stat-card" onMouseEnter={() => setHoveredTile('total')} onMouseLeave={() => setHoveredTile(null)}>
              <h3>Total Users</h3>
              <div className="stat-animated-number-container">
                <div className={`stat-animated-number stat-total${hoveredTile === 'total' ? ' stat-hidden' : ''}`}>
                  <p>{users.length}</p>
                </div>
                <div className={`stat-animated-number stat-split${hoveredTile === 'total' ? ' stat-visible' : ''}`}>
                  <span className="stat-real">Real: {realUsers.length}</span>
                  <span className="stat-generated">Generated: {generatedUsers.length}</span>
                </div>
              </div>
            </div>
            <div className="stat-card" onMouseEnter={() => setHoveredTile('mentors')} onMouseLeave={() => setHoveredTile(null)}>
              <h3>Mentors</h3>
              <div className="stat-animated-number-container">
                <div className={`stat-animated-number stat-total${hoveredTile === 'mentors' ? ' stat-hidden' : ''}`}>
                  <p>{users.filter(u => u.type === 'mentor').length}</p>
                </div>
                <div className={`stat-animated-number stat-split${hoveredTile === 'mentors' ? ' stat-visible' : ''}`}>
                  <span className="stat-real">Real: {realMentors.length}</span>
                  <span className="stat-generated">Generated: {generatedMentors.length}</span>
                </div>
              </div>
            </div>
            <div className="stat-card" onMouseEnter={() => setHoveredTile('mentees')} onMouseLeave={() => setHoveredTile(null)}>
              <h3>Mentees</h3>
              <div className="stat-animated-number-container">
                <div className={`stat-animated-number stat-total${hoveredTile === 'mentees' ? ' stat-hidden' : ''}`}>
                  <p>{users.filter(u => u.type === 'mentee').length}</p>
                </div>
                <div className={`stat-animated-number stat-split${hoveredTile === 'mentees' ? ' stat-visible' : ''}`}>
                  <span className="stat-real">Real: {realMentees.length}</span>
                  <span className="stat-generated">Generated: {generatedMentees.length}</span>
                </div>
              </div>
            </div>
          </div>

          <GenerateRandomProfile />

          {deleteStatus && (
            <div className={deleteStatus.startsWith('Deleted') ? 'mentor-management-success' : 'mentor-management-error'} style={{ marginBottom: '1rem' }}>
              {deleteStatus}
            </div>
          )}

          {selectedIds.length > 0 && (
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ color: '#ff2a2a', fontWeight: 600 }}>{selectedIds.length} selected</span>
              <button className="delete-profile" onClick={handleBulkDelete} style={{ background: '#2d0000', color: '#ff2a2a', border: '1.5px solid #ff2a2a', fontWeight: 600 }}>
                Delete Selected
              </button>
            </div>
          )}

          <div className="mentor-management-table">
            <table>
              <thead>
                <tr>
                  <th><input type="checkbox" checked={selectedIds.length === filteredUsers.length && filteredUsers.length > 0} onChange={handleSelectAll} /></th>
                  <th onClick={() => { setUserSortField('name'); setUserSortDir(userSortField === 'name' && userSortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>Name {userSortField === 'name' ? (userSortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setUserSortField('type'); setUserSortDir(userSortField === 'type' && userSortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>Type {userSortField === 'type' ? (userSortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setUserSortField('email'); setUserSortDir(userSortField === 'email' && userSortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>Email {userSortField === 'email' ? (userSortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setUserSortField('profession'); setUserSortDir(userSortField === 'profession' && userSortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>Profession {userSortField === 'profession' ? (userSortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setUserSortField('education'); setUserSortDir(userSortField === 'education' && userSortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>Education {userSortField === 'education' ? (userSortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th onClick={() => { setUserSortField('county'); setUserSortDir(userSortField === 'county' && userSortDir === 'asc' ? 'desc' : 'asc'); }} style={{ cursor: 'pointer' }}>County {userSortField === 'county' ? (userSortDir === 'asc' ? '▲' : '▼') : ''}</th>
                  <th>Skills</th>
                  <th>Looking For</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr key={user.id}
                    style={user.isGenerated ? { background: 'rgba(0, 200, 255, 0.10)' } : {}}
                  >
                    <td><input type="checkbox" checked={selectedIds.includes(user.id)} onChange={() => handleSelectRow(user.id)} /></td>
                    <td>
                      <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-age">{user.age} years</span>
                      </div>
                    </td>
                    <td>
                      <span className={`user-type ${user.type}`}>
                        {user.type.charAt(0).toUpperCase() + user.type.slice(1)}
                      </span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <div className="profession-info">
                        <span className="profession">{user.profession}</span>
                        {user.pastProfessions.length > 0 && (
                          <span className="past-professions">
                            {user.pastProfessions.length} past roles
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="education-info">
                        <span className="degree">{user.degree}</span>
                        <span className="education-level">{user.educationLevel}</span>
                      </div>
                    </td>
                    <td>{user.county}</td>
                    <td>
                      <div className="skills-list">
                        {user.skills.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="skill-tag">{skill}</span>
                        ))}
                        {user.skills.length > 3 && (
                          <span className="more-skills">+{user.skills.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="looking-for-list">
                        {user.lookingFor.slice(0, 3).map((skill, idx) => (
                          <span key={idx} className="skill-tag">{skill}</span>
                        ))}
                        {user.lookingFor.length > 3 && (
                          <span className="more-skills">+{user.lookingFor.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="view-profile" onClick={() => { setModalUser(user); setModalOpen(true); }}>View Profile</button>
                        <button className="edit-profile" onClick={() => handleEditUser(user)}>Edit</button>
                        <button className="delete-profile" onClick={() => handleDeleteUser(user)} style={{ background: '#2d0000', color: '#ff2a2a', border: '1.5px solid #ff2a2a' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <MentorModal open={modalOpen} onClose={() => setModalOpen(false)} user={modalUser} />
          <MentorModal open={editModalOpen} onClose={() => { setEditModalOpen(false); setEditUser(null); }} user={editUser} editMode={true} onSave={handleSaveEdit} />
        </>
      )}
      
      {/* BOOKINGS TAB */}
      {tab === 'bookings' && (
        <div>
          {/* Booking Statistics Tiles */}
          {!loadingBookings && !bookingsError && (
            <div className="mentor-management-stats" style={{ marginBottom: 24 }}>
              {(() => {
                const stats = getBookingStats();
                return (
                  <>
                    <div className="stat-card">
                      <h3>Total Bookings</h3>
                      <p>{stats.totalBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Confirmed</h3>
                      <p style={{ color: '#00e676' }}>{stats.confirmedBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Pending</h3>
                      <p style={{ color: '#ffb300' }}>{stats.pendingBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Cancelled</h3>
                      <p style={{ color: '#ff4444' }}>{stats.cancelledBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Completion Rate</h3>
                      <p style={{ color: '#00e676' }}>{stats.completionRate.toFixed(1)}%</p>
                    </div>
                    <div className="stat-card">
                      <h3>Total Revenue</h3>
                      <p style={{ color: '#00e676' }}>£{stats.totalRevenue}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Cal.com Bookings</h3>
                      <p style={{ color: '#00eaff' }}>{stats.calComBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Internal Bookings</h3>
                      <p style={{ color: '#ffb300' }}>{stats.internalBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Active Mentors</h3>
                      <p style={{ color: '#ffb300' }}>{stats.uniqueMentors}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Active Mentees</h3>
                      <p style={{ color: '#00e676' }}>{stats.uniqueMentees}</p>
                    </div>
                    <div className="stat-card">
                      <h3>Today's Bookings</h3>
                      <p style={{ color: '#00eaff' }}>{stats.todayBookings}</p>
                    </div>
                    <div className="stat-card">
                      <h3>This Week</h3>
                      <p style={{ color: '#ffb300' }}>{stats.thisWeekBookings}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
          
          {/* Bookings View Mode Switch */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 18 }}>
            <button className={bookingsView === 'table' ? 'active' : ''} onClick={() => setBookingsView('table')}>Table View</button>
            <button className={bookingsView === 'grouped' ? 'active' : ''} onClick={() => setBookingsView('grouped')}>Grouped View</button>
            {bookingsView === 'grouped' && (
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'mentor' | 'mentee')} style={{ marginLeft: 12, padding: '6px 12px', borderRadius: 8 }}>
                <option value="mentor">Group by Mentor</option>
                <option value="mentee">Group by Mentee</option>
              </select>
            )}
          </div>
          {/* Bookings Content */}
          {loadingBookings ? (
            <div className="mentor-management-loading">Loading bookings...</div>
          ) : bookingsError ? (
            <div className="mentor-management-error">{bookingsError}</div>
          ) : bookingsView === 'table' ? (
            <div style={{ minHeight: 200, background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 24 }}>
              <BookingsTable bookings={bookings} onView={booking => { setSelectedBooking(booking); setDetailsModalOpen(true); }} />
              <BookingDetailsModal booking={selectedBooking} open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} onDelete={handleDeleteBooking} onUpdateStatus={handleUpdateBookingStatus} />
              {actionLoading && <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ background: '#222', color: '#fff', padding: '2rem 3rem', borderRadius: 12, fontSize: 20 }}>Processing...</div></div>}
            </div>
          ) : (
            <div style={{ minHeight: 200, background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 24 }}>
              <BookingsGrouped bookings={bookings} groupBy={groupBy} onView={booking => { setSelectedBooking(booking); setDetailsModalOpen(true); }} />
              <BookingDetailsModal booking={selectedBooking} open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} onDelete={handleDeleteBooking} onUpdateStatus={handleUpdateBookingStatus} />
              {actionLoading && <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ background: '#222', color: '#fff', padding: '2rem 3rem', borderRadius: 12, fontSize: 20 }}>Processing...</div></div>}
            </div>
          )}
        </div>
      )}

      {/* AVAILABILITY TAB */}
      {tab === 'availability' && (
        <div>
          <div className="mentor-management-header">
            <h2>Mentor Availability Management</h2>
            <div className="mentor-management-controls">
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
                <input 
                  value={availabilitySearch} 
                  onChange={e => setAvailabilitySearch(e.target.value)} 
                  placeholder="Search mentor name or email..." 
                  style={{ padding: '6px 12px', borderRadius: 8, border: '1.5px solid #3a0a0a', background: '#181818', color: '#fff', fontSize: 15, minWidth: 180 }} 
                />
                <select 
                  value={availabilityStatusFilter} 
                  onChange={e => setAvailabilityStatusFilter(e.target.value as 'all' | 'available' | 'booked')} 
                  style={{ padding: '6px 12px', borderRadius: 8, background: '#222', color: '#fff', fontWeight: 600 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="booked">Booked</option>
                </select>
                <select 
                  value={availabilityTypeFilter} 
                  onChange={e => setAvailabilityTypeFilter(e.target.value as 'all' | 'recurring' | 'specific')} 
                  style={{ padding: '6px 12px', borderRadius: 8, background: '#222', color: '#fff', fontWeight: 600 }}
                >
                  <option value="all">All Types</option>
                  <option value="recurring">Recurring</option>
                  <option value="specific">One-off</option>
                </select>
                <button
                  className="refresh-button"
                  onClick={fetchAvailability}
                  disabled={loadingAvailability}
                >
                  <FaSync className={loadingAvailability ? 'spinning' : ''} /> Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Availability Stats */}
          <div className="mentor-management-stats">
            <div className="stat-card">
              <h3>Total Mentors with Availability</h3>
              <p>{filteredAvailability.length}</p>
            </div>
            <div className="stat-card">
              <h3>Internal Time Slots</h3>
              <p>{filteredAvailability.reduce((total, availability) => total + getTotalSlots(availability), 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Cal.com Time Slots</h3>
              <p>{filteredAvailability.reduce((total, availability) => total + getCalComTotalSlots(availability), 0)}</p>
            </div>
            <div className="stat-card">
              <h3>Cal.com Integration</h3>
              <p>{filteredAvailability.filter(availability => availability.hasCalComIntegration).length}</p>
            </div>
          </div>

          {/* Availability Content */}
          {loadingAvailability ? (
            <div className="mentor-management-loading">Loading availability data...</div>
          ) : availabilityError ? (
            <div className="mentor-management-error">{availabilityError}</div>
          ) : (
            <div style={{ minHeight: 200, background: 'rgba(40,0,0,0.25)', borderRadius: 12, padding: 24 }}>
              <table className="admin-bookings-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Mentor</th>
                    <th>Email</th>
                    <th>Internal Slots</th>
                    <th>Internal Available</th>
                    <th>Internal Booked</th>
                    <th>Cal.com Integration</th>
                    <th>Cal.com Slots</th>
                    <th>Cal.com Available</th>
                    <th>Cal.com Booked</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAvailability.map((availability) => (
                    <tr key={availability.mentorId} style={{ transition: 'background 0.18s', cursor: 'pointer' }}
                      onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,179,0,0.08)'; }}
                      onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                    >
                      <td>
                        <div className="user-info">
                          <span className="user-name">{getMentorName(availability)}</span>
                          {availability.mentorProfile?.profession && (
                            <span className="user-age">{availability.mentorProfile.profession}</span>
                          )}
                        </div>
                      </td>
                      <td>{getMentorEmail(availability)}</td>
                      <td>
                        <span style={{ background: '#ffb300', color: '#181818', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {getTotalSlots(availability)}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: '#00e676', color: '#181818', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {getAvailableSlots(availability)}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: '#ff4444', color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {getBookedSlots(availability)}
                        </span>
                      </td>
                      <td>
                        {availability.hasCalComIntegration ? (
                          <span style={{ background: '#00eaff', color: '#181818', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                            ✅ Connected
                          </span>
                        ) : (
                          <span style={{ background: '#666', color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                            ❌ Not Connected
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ background: '#00eaff', color: '#181818', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {getCalComTotalSlots(availability)}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: '#00e676', color: '#181818', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {getCalComAvailableSlots(availability)}
                        </span>
                      </td>
                      <td>
                        <span style={{ background: '#ff4444', color: '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>
                          {getCalComBookedSlots(availability)}
                        </span>
                      </td>
                      <td>
                        {(() => {
                          const val = availability.lastUpdated;
                          if (!val) return '-';
                          if (isFirestoreTimestamp(val)) {
                            return val.toDate().toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          }
                          if (val instanceof Date) {
                            return val.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          }
                          // Try to parse as string/number
                          const parsed = new Date(val);
                          if (!isNaN(parsed.getTime())) {
                            return parsed.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                          }
                          return '-';
                        })()}
                      </td>
                      <td>
                        <button 
                          onClick={() => {
                            setSelectedAvailability(availability);
                            setDetailsModalOpen(true);
                          }} 
                          style={{ background: '#ffb300', color: '#181818', border: 'none', borderRadius: 8, padding: '0.4rem 1rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAvailability.length === 0 && (
                <div style={{ marginTop: 24, color: '#ffb300', textAlign: 'center' }}>
                  {availabilitySearch || availabilityStatusFilter !== 'all' || availabilityTypeFilter !== 'all' 
                    ? 'No availability data matches your filters.' 
                    : 'No availability data found.'}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {detailsModalOpen && selectedAvailability && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.35)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#181818', color: '#fff', borderRadius: 12, padding: '2.5rem 2.5rem', minWidth: 420, maxWidth: 700, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', position: 'relative' }}>
            <button onClick={() => setDetailsModalOpen(false)} style={{ position: 'absolute', top: 12, right: 12, background: '#ff4444', color: '#fff', border: 'none', borderRadius: 8, padding: '0.3rem 1rem', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Close</button>
            <h2 style={{ marginBottom: 8 }}>Availability Details</h2>
            <div><b>Mentor:</b> {getMentorName(selectedAvailability)} ({getMentorEmail(selectedAvailability)})</div>
            <div style={{ margin: '1rem 0 1.5rem 0', color: '#ffb300' }}>
              <b>Internal Slots:</b> {getTotalSlots(selectedAvailability)} | <b>Available:</b> {getAvailableSlots(selectedAvailability)} | <b>Booked:</b> {getBookedSlots(selectedAvailability)}
            </div>
            {selectedAvailability.hasCalComIntegration && (
              <div style={{ margin: '0 0 1.5rem 0', color: '#00eaff' }}>
                <b>Cal.com Integration:</b> ✅ Connected | <b>Cal.com Slots:</b> {getCalComTotalSlots(selectedAvailability)} | <b>Available:</b> {getCalComAvailableSlots(selectedAvailability)} | <b>Booked:</b> {getCalComBookedSlots(selectedAvailability)}
              </div>
            )}
            <table style={{ width: '100%', background: 'rgba(24,24,24,0.95)', borderRadius: 8, marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Day</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {selectedAvailability.timeSlots.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No internal slots found.</td></tr>
                ) : selectedAvailability.timeSlots.map(slot => (
                  <tr key={slot.id} style={{ background: !slot.isAvailable ? 'rgba(255,68,68,0.07)' : undefined }}>
                    <td><span style={{ background: slot.type === 'recurring' ? '#00eaff' : '#ff6b35', color: '#181818', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>{slot.type === 'recurring' ? 'Recurring' : 'One-off'}</span></td>
                    <td>{slot.day || '-'}</td>
                    <td>{slot.date || '-'}</td>
                    <td>{slot.startTime} - {slot.endTime}</td>
                    <td><span style={{ background: slot.isAvailable ? '#00e676' : '#ff4444', color: slot.isAvailable ? '#181818' : '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>{slot.isAvailable ? 'Available' : 'Booked'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Cal.com Availability Section */}
            {selectedAvailability.hasCalComIntegration && selectedAvailability.calComAvailability && (
              <>
                <h3 style={{ marginTop: 24, marginBottom: 12, color: '#00eaff' }}>Cal.com Availability (Next 7 Days)</h3>
                <table style={{ width: '100%', background: 'rgba(0,234,255,0.05)', borderRadius: 8, border: '1px solid #00eaff' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Event Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAvailability.calComAvailability.length === 0 ? (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888', padding: 24 }}>No Cal.com availability found.</td></tr>
                    ) : selectedAvailability.calComAvailability.map(day => 
                      day.slots.map(slot => (
                        <tr key={`${day.date}-${slot.time}`} style={{ background: !slot.available ? 'rgba(255,68,68,0.07)' : undefined }}>
                          <td>{new Date(day.date).toLocaleDateString('en-GB')}</td>
                          <td>{slot.time}</td>
                          <td>{slot.eventTypeTitle || 'General'}</td>
                          <td><span style={{ background: slot.available ? '#00e676' : '#ff4444', color: slot.available ? '#181818' : '#fff', borderRadius: 6, padding: '2px 10px', fontWeight: 700, fontSize: '0.9rem' }}>{slot.available ? 'Available' : 'Booked'}</span></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div>
          {loadingBookings ? (
            <div className="mentor-management-loading">Loading analytics data...</div>
          ) : bookingsError ? (
            <div className="mentor-management-error">{bookingsError}</div>
          ) : (
            <BookingAnalytics bookings={bookings} />
          )}
        </div>
      )}
    </div>
  );
} 