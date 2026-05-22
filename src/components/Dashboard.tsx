import { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot, addDoc, updateDoc, doc, deleteDoc, orderBy, setDoc } from 'firebase/firestore';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Edit2, 
  TrendingUp, 
  Star, 
  BookOpen, 
  Coffee,
  CheckCircle2,
  Circle,
  FileUp,
  ChevronRight,
  User,
  Layers,
  X,
  Copy,
  Check,
  FileJson,
  UploadCloud,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import IITBhilaiLogo from './IITBhilaiLogo';

const isClassTimeActive = (timeStr: string, current: Date) => {
  if (!timeStr) return false;
  
  // Clean string and split by hyphen or 'to'
  const parts = timeStr.toLowerCase().split(/[-–—]|to/);
  if (parts.length < 2) return false;
  
  const parsePart = (part: string) => {
    part = part.trim();
    const hasPM = part.includes('pm') || part.includes('p.m.');
    const hasAM = part.includes('am') || part.includes('a.m.');
    
    // Remove non-digit and non-colon characters
    const cleanTime = part.replace(/[^0-9:]/g, '');
    const timeParts = cleanTime.split(':');
    if (timeParts.length === 0 || !timeParts[0]) return null;
    
    let hours = parseInt(timeParts[0], 10);
    let minutes = timeParts[1] ? parseInt(timeParts[1], 10) : 0;
    
    if (isNaN(hours)) return null;
    
    if (hasPM) {
      if (hours < 12) hours += 12;
    } else if (hasAM) {
      if (hours === 12) hours = 0;
    } else {
      // Heuristic: College classes/periods are standardly 8:00 AM to 6:00 PM.
      // E.g., times like 1:30, 4:30 are PM. Times like 8:30, 10:30 are AM.
      if (hours >= 1 && hours < 8) {
        hours += 12; // 1 to 7 are treated as PM
      }
    }
    
    return hours * 60 + minutes;
  };
  
  const startMins = parsePart(parts[0]);
  const endMins = parsePart(parts[1]);
  
  if (startMins === null || endMins === null) return false;
  
  let adjustedEndMins = endMins;
  // Adjust end time if parsed earlier than start (e.g., 11:30-12:30 without explicit am/pm)
  if (adjustedEndMins < startMins) {
    if (adjustedEndMins + 720 > startMins && (adjustedEndMins + 720) - startMins <= 240) {
      adjustedEndMins += 720;
    }
  }
  
  const currentMins = current.getHours() * 60 + current.getMinutes();
  
  return currentMins >= startMins && currentMins < adjustedEndMins;
};

const DEMO_RESULTS = [
  {
    id: 'demo_sem1',
    semester: 1,
    sgpa: 8.80,
    uploadedAt: '2024-12-15T12:00:00.000Z',
    grades: [
      { name: 'Computer Programming', grade: 'A' },
      { name: 'Mathematics I', grade: 'A-' },
      { name: 'Physics I', grade: 'B' },
      { name: 'Introduction to Engineering', grade: 'A' }
    ]
  },
  {
    id: 'demo_sem2',
    semester: 2,
    sgpa: 9.10,
    uploadedAt: '2025-05-15T12:00:00.000Z',
    grades: [
      { name: 'Data Structures and Algorithms', grade: 'A' },
      { name: 'Mathematics II', grade: 'A' },
      { name: 'Discrete Structures', grade: 'A-' },
      { name: 'Basic Electronics', grade: 'B+' }
    ]
  }
];

const PERMANENT_ACHIEVEMENTS = [
  {
    id: 'perm_ach1',
    title: 'Inter-IIT Tech Meet Gold',
    date: '2024-12-15',
    description: 'Indian Institute of Technology Bhilai secured Gold in the Inter-IIT Tech Meet competition.',
    type: 'Non-Academic',
    isPermanent: true,
    colorClass: 'bg-emerald-500 dark:bg-emerald-400'
  },
  {
    id: 'perm_ach2',
    title: "Dean's List 2024",
    date: '2024-05-15',
    description: 'Recognized on the Dean\'s List for exceptional academic performance throughout the year 2023-2024.',
    type: 'Academic',
    isPermanent: true,
    colorClass: 'bg-indigo-500 dark:bg-indigo-400'
  }
];

const PERMANENT_ACTIVITIES = [
  {
    id: 'perm_acad1',
    title: 'MAL101 End-Sem Solutions Live',
    date: '2026-05-22',
    description: 'Mathematics-II End-Semester Solutions are now live in Resources section.',
    type: 'academic',
    isPermanent: true
  },
  {
    id: 'perm_acad2',
    title: 'Autumn Course Registration',
    date: '2026-07-15',
    description: 'Core semester course registration and academic fee submission portals open for all batches.',
    type: 'academic',
    isPermanent: true
  },
  {
    id: 'perm_club1',
    title: 'IIT Bhilai Dev Hackathon',
    date: '2026-06-10',
    description: '24-hour coding sprint with premium rewards, hosted by Programming Club.',
    type: 'non-academic',
    isPermanent: true
  },
  {
    id: 'perm_club2',
    title: 'E-Cell Idea Pitch Contest',
    date: '2026-06-18',
    description: 'Present pitch decks to venture capitalists. Incubation and financial assistance for winners.',
    type: 'non-academic',
    isPermanent: true
  }
];

interface DashboardProps {
  user: any;
  userData: any;
  onNavigate?: (page: any) => void;
}

export default function Dashboard({ user, userData, onNavigate }: DashboardProps) {
  const [time, setTime] = useState(new Date());
  const [quote, setQuote] = useState("");
  const [activities, setActivities] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [timetable, setTimetable] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [newGoal, setNewGoal] = useState("");
  const [isUploadingTimetable, setIsUploadingTimetable] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // States for live class editing
  const [editingClassIdx, setEditingClassIdx] = useState<number | null>(null);
  const [isAddingClass, setIsAddingClass] = useState(false);
  const [classForm, setClassForm] = useState({ 
    time: '', 
    type: 'Lecture', 
    code: '', 
    name: '', 
    venue: '', 
    note: '' 
  });
  
  // States for live activity editing
  const [isAddingActivity, setIsAddingActivity] = useState(false);
  const [activityFormType, setActivityFormType] = useState<'academic' | 'non-academic'>('academic');
  const [activityForm, setActivityForm] = useState({
    title: '',
    date: '',
    description: ''
  });

  const [overrides, setOverrides] = useState<{ deletedIds: string[]; editedItems: Record<string, any> }>({
    deletedIds: [],
    editedItems: {}
  });
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [editActivityForm, setEditActivityForm] = useState({ title: '', date: '', description: '' });

  // Designation check
  const isCR = userData?.designation === 'CR' || userData?.designation === 'DCR';

  useEffect(() => {
    const fetchOverrides = async () => {
      try {
        const res = await fetch('/api/overrides');
        if (res.ok) {
          const data = await res.json();
          setOverrides({
            deletedIds: data.deletedIds || [],
            editedItems: data.editedItems || {}
          });
        }
      } catch (err) {
        console.warn("Could not get overrides:", err);
      }
    };
    fetchOverrides();

    if (db && auth?.currentUser) {
      const unsub = onSnapshot(doc(db, 'overrides', 'system'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          setOverrides({
            deletedIds: data.deletedIds || [],
            editedItems: data.editedItems || {}
          });
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'overrides/system');
      });
      return () => unsub();
    }
  }, [user]);

  const saveOverrides = async (newDeleted: string[], newEdited: Record<string, any>) => {
    setOverrides({ deletedIds: newDeleted, editedItems: newEdited });
    try {
      await fetch('/api/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deletedIds: newDeleted, editedItems: newEdited })
      });
    } catch (err) {
      console.warn("Could not save overrides:", err);
    }

    if (db) {
      try {
        await setDoc(doc(db, 'overrides', 'system'), {
          deletedIds: newDeleted,
          editedItems: newEdited
        });
      } catch (err) {
        console.warn("Could not save overrides to Firestore:", err);
      }
    }
  };

  const handlePermanentActivityDelete = async (id: string) => {
    const updatedDeleted = [...overrides.deletedIds, id];
    await saveOverrides(updatedDeleted, overrides.editedItems);
  };

  const startPermanentActivityEdit = (act: any) => {
    setEditingActivityId(act.id);
    setEditActivityForm({
      title: act.title,
      date: act.date || '',
      description: act.description
    });
  };

  const handlePermanentActivityEditSave = async (id: string) => {
    const updatedEdited = {
      ...overrides.editedItems,
      [id]: {
        title: editActivityForm.title,
        date: editActivityForm.date,
        description: editActivityForm.description
      }
    };
    await saveOverrides(overrides.deletedIds, updatedEdited);
    setEditingActivityId(null);
  };

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    fetchQuote();
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!userData) return;

    // Async loader to retrieve credentials/data from Express Backend Database
    const loadFromBackendDb = async () => {
      try {
        const goalsRes = await fetch(`/api/goals?uid=${user.uid}`);
        if (goalsRes.ok) {
          const goalsData = await goalsRes.json();
          setGoals(goalsData);
          localStorage.setItem(`portal-goals-${user.uid}`, JSON.stringify(goalsData));
        }

        const branchName = userData.branch || 'General';
        const batchName = userData.batch || 'All';
        const ttRes = await fetch(`/api/timetable?branch=${branchName}&batch=${batchName}`);
        if (ttRes.ok) {
          const ttData = await ttRes.json();
          setTimetable(ttData);
          localStorage.setItem(`portal-timetable-${branchName}_${batchName}`.replace(/\s+/g, '_'), JSON.stringify(ttData.schedule));
        }

        const resultsRes = await fetch(`/api/results?uid=${user.uid}`);
        if (resultsRes.ok) {
          const resData = await resultsRes.json();
          setResults(resData);
          localStorage.setItem(`portal-results-${user.uid}`, JSON.stringify(resData));
        }

        const achievementsRes = await fetch(`/api/achievements?uid=${user.uid}`);
        if (achievementsRes.ok) {
          const achievementsData = await achievementsRes.json();
          setAchievements(achievementsData);
          localStorage.setItem(`portal-achievements-${user.uid}`, JSON.stringify(achievementsData));
        }
      } catch (err) {
        console.warn("Could not query backend database, staying with custom local state caching:", err);
      }
    };

    // Trigger load from Express Database initially
    loadFromBackendDb();

    if (!db || !auth?.currentUser) {
      const loadLocalActivities = async () => {
        try {
          const branchName = userData.branch || 'General';
          const res = await fetch(`/api/activities?branch=${branchName}`);
          if (res.ok) {
            const data = await res.json();
            setActivities(data);
          } else {
            setActivities([
              { id: 'act1', title: 'End Semester Exams Registration', date: '2026-05-25', description: 'Ensure all college dues are cleared.', type: 'academic', branch: userData.branch },
              { id: 'act2', title: 'Summer Placement Drive', date: '2026-06-01', description: 'Internship registry link open for tech discipline.', type: 'academic', branch: userData.branch }
            ]);
          }
        } catch (e) {
          setActivities([
            { id: 'act1', title: 'End Semester Exams Registration', date: '2026-05-25', description: 'Ensure all college dues are cleared.', type: 'academic', branch: userData.branch },
            { id: 'act2', title: 'Summer Placement Drive', date: '2026-06-01', description: 'Internship registry link open for tech discipline.', type: 'academic', branch: userData.branch }
          ]);
        }
      };
      loadLocalActivities();

      // Handle local state achievements fallback
      const fallbackAchievements = localStorage.getItem(`portal-achievements-${user.uid}`);
      if (fallbackAchievements) {
        try {
          setAchievements(JSON.parse(fallbackAchievements));
        } catch (_) {}
      }

      return;
    }

    // Fetch Academic/Non-Academic Activities for the branch from Firestore
    const qActivities = query(
      collection(db, 'activities'), 
      where('branch', '==', userData.branch),
      orderBy('date', 'asc')
    );
    const unsubActivities = onSnapshot(qActivities, (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'activities');
    });

    // Fetch Personalized Goals from Firestore
    const qGoals = query(
      collection(db, 'goals'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubGoals = onSnapshot(qGoals, (snap) => {
      setGoals(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'goals');
    });

    // Fetch Achievements from Firestore
    const qAchievements = query(
      collection(db, 'achievements'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );
    const unsubAchievements = onSnapshot(qAchievements, (snap) => {
      setAchievements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'achievements');
    });

    // Fetch Timetable from Firestore
    const branch = userData.branch || 'General';
    const batch = userData.batch || 'All';
    const docId = `${branch}_${batch}`.replace(/\s+/g, '_');
    const ttRef = doc(db, 'timetables', docId);
    const unsubTT = onSnapshot(ttRef, (snap) => {
      if (snap.exists()) setTimetable(snap.data());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `timetables/${docId}`);
    });

    // Fetch Semester Results for GPA Panel from Firestore
    const qResults = query(
      collection(db, 'results'),
      where('uid', '==', auth.currentUser.uid),
      orderBy('semester', 'asc')
    );
    const unsubResults = onSnapshot(qResults, (snap) => {
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'results');
    });

    return () => {
      unsubActivities();
      unsubGoals();
      unsubAchievements();
      unsubTT();
      unsubResults();
    };
  }, [user, userData]);

  const fetchQuote = async () => {
    try {
      const res = await fetch('/api/ai/quote');
      const data = await res.json();
      setQuote(data.quote);
    } catch {
      setQuote("The beautiful thing about learning is that no one can take it away from you. - B.B. King");
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;

    const goalPayload = {
      uid: user.uid,
      title: newGoal,
      completed: false
    };

    // Optimistically update local view & storage first
    const tempId = `temp_${Date.now()}`;
    const newGoalItem = { id: tempId, ...goalPayload };
    const updatedGoals = [newGoalItem, ...goals];
    setGoals(updatedGoals);
    localStorage.setItem(`portal-goals-${user.uid}`, JSON.stringify(updatedGoals));
    setNewGoal("");

    // 1. Persist to our permanent Express local backend database
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalPayload)
      });
      if (res.ok) {
        const savedGoal = await res.json();
        // Replace temp ID with actual databases server-granted ID
        setGoals(prev => prev.map(g => g.id === tempId ? savedGoal : g));
      }
    } catch (err) {
      console.warn("Express database addGoal failed:", err);
    }

    // 2. Try Firestore if active
    if (db) {
      try {
        await addDoc(collection(db, 'goals'), {
          ...goalPayload,
          createdAt: new Date().toISOString()
        });
      } catch (fbErr) {
        console.warn("Firestore addGoal write bypassed:", fbErr);
      }
    }
  };

  const toggleGoal = async (goal: any) => {
    const updatedStatus = !goal.completed;

    // Optimistically update state
    const updatedGoals = goals.map(g => g.id === goal.id ? { ...g, completed: updatedStatus } : g);
    setGoals(updatedGoals);
    localStorage.setItem(`portal-goals-${user.uid}`, JSON.stringify(updatedGoals));

    // 1. Persist to Express local backend database
    try {
      await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: updatedStatus })
      });
    } catch (err) {
      console.warn("Express database toggleGoal failed:", err);
    }

    // 2. Try Firestore if active
    if (db) {
      try {
        await updateDoc(doc(db, 'goals', goal.id), {
          completed: updatedStatus
        });
      } catch (fbErr) {
        console.warn("Firestore toggleGoal write bypassed:", fbErr);
      }
    }
  };

  const deleteGoal = async (id: string) => {
    // Optimistically update state
    const updatedGoals = goals.filter(g => g.id !== id);
    setGoals(updatedGoals);
    localStorage.setItem(`portal-goals-${user.uid}`, JSON.stringify(updatedGoals));

    // 1. Persist to Express local backend database
    try {
      await fetch(`/api/goals/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Express database deleteGoal failed:", err);
    }

    // 2. Try Firestore if active
    if (db) {
      try {
        await deleteDoc(doc(db, 'goals', id));
      } catch (fbErr) {
        console.warn("Firestore deleteGoal write bypassed:", fbErr);
      }
    }
  };

  const handleAddActivitySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityForm.title.trim()) return;

    const payload = {
      title: activityForm.title.trim(),
      date: activityForm.date || new Date().toISOString().split('T')[0],
      description: activityForm.description.trim(),
      type: activityFormType,
      branch: userData?.branch || 'General'
    };

    const tempId = `temp_act_${Date.now()}`;
    const newActivity = { id: tempId, ...payload };
    const updatedActivities = [...activities, newActivity];
    setActivities(updatedActivities);

    // 1. Post to Express backend
    try {
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const saved = await res.json();
        setActivities(prev => prev.map(a => a.id === tempId ? saved : a));
      }
    } catch (err) {
      console.warn("Express database addActivity failed:", err);
    }

    // 2. Try Firestore if active
    if (db) {
      try {
        await addDoc(collection(db, 'activities'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      } catch (fbErr) {
        console.warn("Firestore addActivity failed:", fbErr);
      }
    }

    // Reset Form
    setActivityForm({ title: '', date: '', description: '' });
    setIsAddingActivity(false);
  };

  const handleDeleteActivity = async (id: string) => {
    // Optimistic Delete
    const updated = activities.filter(a => a.id !== id);
    setActivities(updated);

    // 1. Delete from Express backend
    try {
      await fetch(`/api/activities/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Express database deleteActivity failed:", err);
    }

    // 2. Try Firestore if active
    if (db) {
      try {
        await deleteDoc(doc(db, 'activities', id));
      } catch (fbErr) {
        console.warn("Firestore deleteActivity failed:", fbErr);
      }
    }
  };

  const saveTimetableSchedule = async (newSchedule: any) => {
    try {
      const branch = userData?.branch || 'General';
      const batch = userData?.batch || 'All';
      const docId = `${branch}_${batch}`.replace(/\s+/g, '_');

      // Optimistically update state
      setTimetable((prev: any) => ({
        ...prev,
        branch,
        batch,
        schedule: newSchedule,
        updatedAt: new Date().toISOString()
      }));

      // 1. Sync to Cloud Firestore if active
      if (db) {
        try {
          await setDoc(doc(db, 'timetables', docId), {
            branch,
            batch,
            schedule: newSchedule,
            updatedAt: new Date().toISOString()
          });
        } catch (fbErr) {
          console.warn("Firestore timetable save error (bypassed):", fbErr);
        }
      }

      // 2. Always sync to Express REST backend database
      try {
        await fetch('/api/timetable', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            branch,
            batch,
            schedule: newSchedule
          })
        });
      } catch (restErr) {
        console.warn("Express backend timetable save error (bypassed):", restErr);
      }

      // 3. LocalStorage backup
      localStorage.setItem(`portal-timetable-${branch}_${batch}`.replace(/\s+/g, '_'), JSON.stringify(newSchedule));

      setUploadError("✓ Schedule updated successfully!");
      setTimeout(() => setUploadError(null), 3000);
      return true;
    } catch (err: any) {
      console.error("Failed to save timetable schedule:", err);
      setUploadError(err.message || "Error saving schedule.");
      return false;
    }
  };

  const handleTimetableUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData) return;

    setIsUploadingTimetable(true);
    setUploadError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          let scheduleToSave: any = null;
          
          // Step 1: Try Local Parsing & Basic Structural Check
          try {
            const raw = JSON.parse(content);
            const daysMap: Record<string, string> = {
              'mon': 'Monday', 'monday': 'Monday',
              'tue': 'Tuesday', 'tuesday': 'Tuesday',
              'wed': 'Wednesday', 'wednesday': 'Wednesday',
              'thu': 'Thursday', 'thursday': 'Thursday',
              'fri': 'Friday', 'friday': 'Friday',
              'sat': 'Saturday', 'saturday': 'Saturday',
              'sun': 'Sunday', 'sunday': 'Sunday'
            };
            
            let normalized: any = {};
            let hasValidDays = false;

            // Handle cases where JSON is an object with day keys
            if (typeof raw === 'object' && !Array.isArray(raw)) {
              Object.keys(raw).forEach(key => {
                const lowKey = key.toLowerCase().trim();
                const standardDay = daysMap[lowKey];
                
                // If it's an array of objects, we assume it's correct
                if (standardDay && Array.isArray(raw[key])) {
                  normalized[standardDay] = raw[key];
                  hasValidDays = true;
                } 
                // If it's an object (e.g. "Monday": { "1": {...} }), convert to array
                else if (standardDay && typeof raw[key] === 'object' && raw[key] !== null) {
                  normalized[standardDay] = Object.values(raw[key]);
                  hasValidDays = true;
                }
              });
            }

            if (hasValidDays) {
              console.log("Local parse successful with normalization, skipping AI...");
              scheduleToSave = normalized;
            }
          } catch (e) {
            console.log("Local parse failed, might need AI normalization.");
          }

          // Step 2: Fallback to AI Normalization if local check failed
          if (!scheduleToSave) {
            console.log("Calling AI for normalization...");
            const aiRes = await fetch('/api/ai/normalize-timetable', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonText: content })
            });

            if (!aiRes.ok) {
              const errData = await aiRes.json();
              if (aiRes.status === 429) {
                throw new Error("AI capacity reached (Free Tier). Please format your JSON exactly like the 'Format Hint' above to bypass AI.");
              }
              throw new Error(errData.error || "AI normalization failed.");
            }
            scheduleToSave = await aiRes.json();
          }

          await saveTimetableSchedule(scheduleToSave);
          e.target.value = '';
          setIsUploadingTimetable(false);
        } catch (innerErr: any) {
          console.error("Timetable Upload Error:", innerErr);
          setUploadError(innerErr.message || "Failed to parse JSON.");
          setIsUploadingTimetable(false);
        }
      };
      reader.onerror = () => {
        setUploadError("Failed to read file.");
        setIsUploadingTimetable(false);
      };
      reader.readAsText(file);
    } catch (error: any) {
      console.error("Timetable Reader Error:", error);
      setUploadError(error.message || "Error starting upload.");
      setIsUploadingTimetable(false);
    }
  };

  const handleAddClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classForm.time.trim()) return;

    const currentSchedule = timetable?.schedule ? { ...timetable.schedule } : {};
    const dayClasses = [...(currentSchedule[dayName] || [])];

    const newClass: any = {
      time: classForm.time.trim(),
      type: classForm.type.trim()
    };

    if (classForm.note.trim()) {
      newClass.note = classForm.note.trim();
    } else {
      newClass.code = classForm.code.trim();
      newClass.name = classForm.name.trim();
      newClass.venue = classForm.venue.trim();
    }

    dayClasses.push(newClass);

    currentSchedule[dayName] = dayClasses;
    await saveTimetableSchedule(currentSchedule);

    // Reset state & form
    setClassForm({ time: '', type: 'Lecture', code: '', name: '', venue: '', note: '' });
    setIsAddingClass(false);
  };

  const handleEditClassClick = (idx: number, item: any) => {
    setEditingClassIdx(idx);
    setClassForm({
      time: item.time || '',
      type: item.type || 'Lecture',
      code: item.code || '',
      name: item.name || item.subject || '',
      venue: item.venue || item.room || '',
      note: item.note || ''
    });
    setIsAddingClass(false);
  };

  const handleEditClassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingClassIdx === null) return;
    if (!classForm.time.trim()) return;

    const currentSchedule = timetable?.schedule ? { ...timetable.schedule } : {};
    const dayClasses = [...(currentSchedule[dayName] || [])];

    if (dayClasses[editingClassIdx]) {
      const updatedClass: any = {
        time: classForm.time.trim(),
        type: classForm.type.trim()
      };

      if (classForm.note.trim()) {
        updatedClass.note = classForm.note.trim();
      } else {
        updatedClass.code = classForm.code.trim();
        updatedClass.name = classForm.name.trim();
        updatedClass.venue = classForm.venue.trim();
      }

      dayClasses[editingClassIdx] = updatedClass;
    }

    currentSchedule[dayName] = dayClasses;
    await saveTimetableSchedule(currentSchedule);

    // Reset Form
    setEditingClassIdx(null);
    setClassForm({ time: '', type: 'Lecture', code: '', name: '', venue: '', note: '' });
  };

  const handleDeleteClass = async (idxToDelete: number) => {
    if (!window.confirm("Are you sure you want to delete this class slot?")) return;

    const currentSchedule = timetable?.schedule ? { ...timetable.schedule } : {};
    const dayClasses = [...(currentSchedule[dayName] || [])];

    const filtered = dayClasses.filter((_, idx) => idx !== idxToDelete);
    currentSchedule[dayName] = filtered;

    await saveTimetableSchedule(currentSchedule);
  };

  const handleLogout = async () => {
    localStorage.removeItem('local-session-user');
    localStorage.removeItem('local-session-userdata');
    if (!auth) {
      window.location.reload();
      return;
    }
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const getCombinedActivities = () => {
    const perm = PERMANENT_ACTIVITIES
      .map(act => {
        const oVal = overrides.editedItems?.[act.id];
        return oVal ? { ...act, ...oVal } : act;
      })
      .filter(act => !overrides.deletedIds?.includes(act.id));
    return [...perm, ...activities];
  };

  const getCombinedAchievements = () => {
    const perm = PERMANENT_ACHIEVEMENTS
      .map(ach => {
        const oVal = overrides.editedItems?.[ach.id];
        return oVal ? { ...ach, ...oVal } : ach;
      })
      .filter(ach => !overrides.deletedIds?.includes(ach.id));
    return [...perm, ...achievements];
  };

  const dayName = time.toLocaleDateString('en-US', { weekday: 'long' });
  const todayClasses = timetable?.schedule?.[dayName] || [];

  const combinedResults = [
    ...DEMO_RESULTS,
    ...results.filter(r => r.semester !== 1 && r.semester !== 2 && r.id !== 'demo_sem1' && r.id !== 'demo_sem2')
  ].sort((a, b) => a.semester - b.semester);

  const cgpa = combinedResults.length > 0 
    ? (combinedResults.reduce((acc, curr) => acc + curr.sgpa, 0) / combinedResults.length).toFixed(2)
    : "0.00";

  return (
    <div className="p-8 space-y-8 pb-12">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-4"
        >
          <div className="p-2 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm dark:shadow-none flex items-center justify-center">
            <IITBhilaiLogo size={44} variant="colored" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Hello, {userData?.firstName}! 👋
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 italic text-sm">"{quote}"</p>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-6"
        >
          <div className="text-right">
            <p className="text-2xl font-light text-indigo-300">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-slate-400 text-sm">
              {time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

        </motion.div>
      </header>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Column: Schedule & Activities */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          
          {/* Today's Schedule */}
          <section className="glass-panel p-6 shadow-xl dark:shadow-none">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
                <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                Today's Schedule
                {uploadError && (
                  <span className={`text-[10px] px-2 py-1 rounded border ml-2 animate-pulse font-bold ${
                    uploadError.includes('successfully') 
                      ? 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' 
                      : 'text-red-500 bg-red-500/10 border-red-500/20'
                  }`}>
                    {uploadError}
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2 md:gap-3">
                <div className="group relative">
                  <span className="text-[10px] text-slate-500 cursor-help border-b border-dotted border-slate-500 pb-0.5 font-medium">Format Hint</span>
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 p-3 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <p className="text-[9px] text-slate-400 font-mono whitespace-pre-wrap leading-relaxed">
{`{
  "Monday": [
    { "time": "8:30-9:30", "type": "Lecture", "code": "BML101", "name": "Biology for Engineers", "venue": "L-209" }
  ]
}`}
                    </p>
                  </div>
                </div>
                
                <button 
                  onClick={() => {
                    setIsAddingClass(prev => !prev);
                    setEditingClassIdx(null);
                    setClassForm({ time: '', type: 'Lecture', code: '', name: '', venue: '', note: '' });
                  }}
                  className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 hover:bg-emerald-500/20 transition-all font-semibold"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Class
                </button>

                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all font-semibold"
                >
                  Import JSON Timetable
                </button>
              </div>
            </div>

            {/* Adding or Editing Class Inline Form */}
            {(isAddingClass || editingClassIdx !== null) && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/25 border border-indigo-200/50 dark:border-indigo-500/20 shadow-xl shadow-indigo-500/5"
              >
                <form onSubmit={editingClassIdx !== null ? handleEditClassSubmit : handleAddClassSubmit} className="space-y-4">
                  <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    {editingClassIdx !== null ? "Edit Class Slot" : "Add New Class Slot"}
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 block mb-1 tracking-wider">Time (e.g., 8:30-9:30)</label>
                      <input 
                        type="text" 
                        value={classForm.time} 
                        onChange={e => setClassForm({ ...classForm, time: e.target.value })}
                        placeholder="8:30-9:30" 
                        className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                        required
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 block mb-1 tracking-wider">Slot Type</label>
                      <select 
                        value={classForm.type} 
                        onChange={e => setClassForm({ ...classForm, type: e.target.value })}
                        className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white cursor-pointer"
                      >
                        <option value="Lecture">Lecture</option>
                        <option value="Tutorial">Tutorial</option>
                        <option value="Lab">Lab</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[10px] uppercase font-black text-slate-500 block mb-1 tracking-wider">Custom Note (Optional)</label>
                      <input 
                        type="text" 
                        value={classForm.note} 
                        onChange={e => setClassForm({ ...classForm, note: e.target.value })}
                        placeholder="e.g. No Lab scheduled" 
                        className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {!classForm.note.trim() && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1"
                    >
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 block mb-1 tracking-wider">Subject Code</label>
                        <input 
                          type="text" 
                          value={classForm.code} 
                          onChange={e => setClassForm({ ...classForm, code: e.target.value })}
                          placeholder="e.g., BML101" 
                          className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                          required={!classForm.note.trim()}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 block mb-1 tracking-wider">Subject Name</label>
                        <input 
                          type="text" 
                          value={classForm.name} 
                          onChange={e => setClassForm({ ...classForm, name: e.target.value })}
                          placeholder="e.g., Biology for Engineers" 
                          className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                          required={!classForm.note.trim()}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-slate-500 block mb-1 tracking-wider">Venue</label>
                        <input 
                          type="text" 
                          value={classForm.venue} 
                          onChange={e => setClassForm({ ...classForm, venue: e.target.value })}
                          placeholder="e.g., L-209/LH300" 
                          className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
                          required={!classForm.note.trim()}
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="flex gap-2 justify-end pt-2 border-t border-slate-100 dark:border-white/5">
                    <button 
                      type="button" 
                      onClick={() => {
                        setIsAddingClass(false);
                        setEditingClassIdx(null);
                        setClassForm({ time: '', type: 'Lecture', code: '', name: '', venue: '', note: '' });
                      }}
                      className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-[10px] uppercase font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="px-5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] uppercase font-bold transition-all shadow-md active:scale-95"
                    >
                      {editingClassIdx !== null ? "Save Changes" : "Save Class Slot"}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {todayClasses.length > 0 ? (
                todayClasses.map((item: any, idx: number) => {
                  const isCurrent = isClassTimeActive(item.time, time);
                  return (
                    <motion.div 
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      className={`p-3 rounded-2xl border transition-all relative group ${isCurrent ? 'bg-indigo-50 dark:bg-white/10 border-indigo-200 dark:border-white/20 ring-1 ring-indigo-100 dark:ring-white/10' : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/5'}`}
                    >
                      {/* Action buttons on hover */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity bg-white/90 dark:bg-slate-900/90 px-1 p-0.5 rounded-lg backdrop-blur-sm shadow border border-slate-100 dark:border-white/10 z-20">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleEditClassClick(idx, item); }}
                          className="p-1 text-slate-500 hover:text-indigo-500 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          title="Edit Class Slot"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteClass(idx); }}
                          className="p-1 text-slate-500 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                          title="Delete Class Slot"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="flex justify-between items-start gap-1 mb-1">
                        <p className={`text-[10px] uppercase font-bold ${isCurrent ? 'text-emerald-600 dark:text-emerald-400 italic font-black' : 'text-indigo-600 dark:text-indigo-400'}`}>
                          {item.time} {isCurrent && '• Active'}
                        </p>
                        {item.type && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                            item.type === 'Lab' ? 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/20' :
                            item.type === 'Tutorial' ? 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/20' :
                            'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/20'
                          }`}>
                            {item.type}
                          </span>
                        )}
                      </div>

                      {item.note ? (
                        <p className="text-xs text-slate-500 italic mt-2 py-1 pr-6">{item.note}</p>
                      ) : (
                        <>
                          <div className="mt-1">
                            {item.code && (
                              <span className="text-[9px] uppercase font-mono font-bold text-slate-400 block tracking-tight">
                                {item.code}
                              </span>
                            )}
                            <p className="text-sm font-semibold text-slate-800 dark:text-white pr-8 truncate" title={item.name || item.subject}>
                              {item.name || item.subject}
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1.5 font-medium flex items-center gap-1">
                            <span className="opacity-60">Venue:</span> {item.venue || item.room}
                          </p>
                        </>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <div className="md:col-span-4 py-8 text-center text-slate-500 text-sm italic">
                  No classes scheduled for {dayName}.
                </div>
              )}
            </div>
          </section>

          {/* Academic & Non-Academic Row */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-indigo-500/5 rounded-2xl border border-indigo-500/10 text-[10px] uppercase font-bold tracking-wider text-indigo-600 dark:text-indigo-400 mb-4 shadow-sm">
            <ShieldAlert className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>Academic Activities and Club Activities are managed by CR or DCR only</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="glass-panel p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Academic Activities</h4>
                <div className="flex items-center gap-2">
                  {isCR && (
                    <button
                      onClick={() => {
                        setActivityFormType('academic');
                        setIsAddingActivity(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[9px] px-2 py-1 rounded-lg flex items-center gap-1 shadow transition-all active:scale-95"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add
                    </button>
                  )}
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 uppercase font-black tracking-widest">Branch Events</span>
                </div>
              </div>
              <ul className="space-y-3">
                {getCombinedActivities().filter(a => a.type === 'academic').map((activity, idx) => (
                  <li key={idx} className="flex flex-col justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative border border-slate-100 dark:border-white/5">
                    {editingActivityId === activity.id ? (
                      <div className="w-full space-y-2.5">
                        <div>
                          <label className="text-[9px] uppercase font-black text-slate-500">Title</label>
                          <input
                            value={editActivityForm.title}
                            onChange={e => setEditActivityForm({ ...editActivityForm, title: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg py-1 px-2 text-xs text-slate-900 dark:text-white mt-1 h-8 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-black text-slate-500">Date</label>
                          <input
                            type="date"
                            value={editActivityForm.date}
                            onChange={e => setEditActivityForm({ ...editActivityForm, date: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg py-1 px-2 text-xs text-slate-900 dark:text-white mt-1 h-8 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-black text-slate-500">Description</label>
                          <textarea
                            value={editActivityForm.description}
                            onChange={e => setEditActivityForm({ ...editActivityForm, description: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg py-1 px-2 text-xs text-slate-900 dark:text-white mt-1 h-14 focus:outline-none focus:border-indigo-500 resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingActivityId(null)}
                            className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentActivityEditSave(activity.id)}
                            className="p-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold border border-orange-500/20 group-hover:scale-110 transition-transform shrink-0">
                            {activity.title.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activity.title}</p>
                            <p className="text-[10px] text-slate-500 leading-relaxed pr-2">
                              {activity.description}
                              {activity.date && <span className="text-[9px] text-indigo-500/80 dark:text-indigo-400/80 font-bold block mt-0.5">{activity.date}</span>}
                            </p>
                          </div>
                        </div>
                        {isCR && (
                          <div className="flex items-center gap-1 shrink-0 z-10 self-center">
                            {activity.isPermanent && (
                              <button
                                type="button"
                                onClick={() => startPermanentActivityEdit(activity)}
                                className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-md transition-all"
                                title="Edit Sample"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => activity.isPermanent ? handlePermanentActivityDelete(activity.id) : handleDeleteActivity(activity.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-all"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
                {getCombinedActivities().filter(a => a.type === 'academic').length === 0 && (
                  <p className="text-center text-slate-400 text-[10px] py-4 uppercase tracking-widest font-black">All Clear</p>
                )}
              </ul>
            </section>

            <section className="glass-panel p-6">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">Club Activities</h4>
                <div className="flex items-center gap-2">
                  {isCR && (
                    <button
                      onClick={() => {
                        setActivityFormType('non-academic');
                        setIsAddingActivity(true);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[9px] px-2 py-1 rounded-lg flex items-center gap-1 shadow transition-all active:scale-95"
                    >
                      <Plus className="w-2.5 h-2.5" /> Add
                    </button>
                  )}
                  <span className="text-[10px] text-indigo-500 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 uppercase font-black tracking-widest">Global Events</span>
                </div>
              </div>
              <ul className="space-y-3">
                {getCombinedActivities().filter(a => a.type === 'non-academic').map((activity, idx) => (
                  <li key={idx} className="flex flex-col justify-between gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group relative border border-slate-100 dark:border-white/5">
                    {editingActivityId === activity.id ? (
                      <div className="w-full space-y-2.5">
                        <div>
                          <label className="text-[9px] uppercase font-black text-slate-500">Title</label>
                          <input
                            value={editActivityForm.title}
                            onChange={e => setEditActivityForm({ ...editActivityForm, title: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg py-1 px-2 text-xs text-slate-900 dark:text-white mt-1 h-8 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-black text-slate-500">Date</label>
                          <input
                            type="date"
                            value={editActivityForm.date}
                            onChange={e => setEditActivityForm({ ...editActivityForm, date: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg py-1 px-2 text-xs text-slate-900 dark:text-white mt-1 h-8 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase font-black text-slate-500">Description</label>
                          <textarea
                            value={editActivityForm.description}
                            onChange={e => setEditActivityForm({ ...editActivityForm, description: e.target.value })}
                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg py-1 px-2 text-xs text-slate-900 dark:text-white mt-1 h-14 focus:outline-none focus:border-indigo-500 resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingActivityId(null)}
                            className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-[10px] font-bold"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePermanentActivityEditSave(activity.id)}
                            className="p-1 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 text-xs font-bold border border-indigo-500/20 group-hover:scale-110 transition-transform shrink-0">
                            {activity.title.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{activity.title}</p>
                            <p className="text-[10px] text-slate-500 leading-relaxed pr-2">
                              {activity.description}
                              {activity.date && <span className="text-[9px] text-indigo-500/80 dark:text-indigo-400/80 font-bold block mt-0.5">{activity.date}</span>}
                            </p>
                          </div>
                        </div>
                        {isCR && (
                          <div className="flex items-center gap-1 shrink-0 z-10 self-center">
                            {activity.isPermanent && (
                              <button
                                type="button"
                                onClick={() => startPermanentActivityEdit(activity)}
                                className="p-1 text-slate-400 hover:text-indigo-500 hover:bg-indigo-500/10 rounded-md transition-all"
                                title="Edit Sample"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => activity.isPermanent ? handlePermanentActivityDelete(activity.id) : handleDeleteActivity(activity.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-all"
                              title="Delete Event"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
                {getCombinedActivities().filter(a => a.type === 'non-academic').length === 0 && (
                  <p className="text-center text-slate-400 text-[10px] py-4 uppercase tracking-widest font-black">No Events</p>
                )}
              </ul>
            </section>
          </div>

          {/* Goals Section */}
          <section className="glass-panel p-6">
            <h3 className="font-bold mb-4 text-sm flex items-center gap-2 text-slate-900 dark:text-white">
              <Star className="w-4 h-4 text-yellow-500" />
              Personalized Goals
            </h3>
            <div className="flex flex-wrap gap-3">
              <AnimatePresence>
                {goals.map((goal) => (
                  <motion.div 
                    key={goal.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`flex items-center justify-between gap-3 px-4 py-2 rounded-2xl cursor-pointer transition-all border group/goal ${goal.completed ? 'bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/5' : 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30'}`}
                  >
                    <div className="flex items-center gap-3 flex-1" onClick={() => toggleGoal(goal)}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${goal.completed ? 'border-slate-400 dark:border-slate-600' : 'border-indigo-500'}`}>
                        {goal.completed && <div className="w-2 h-2 bg-slate-400 dark:bg-slate-600 rounded-sm"></div>}
                        {!goal.completed && <div className="w-2 h-2 bg-indigo-500 rounded-sm"></div>}
                      </div>
                      <span className={`text-sm font-medium ${goal.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{goal.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteGoal(goal.id);
                      }}
                      className="opacity-0 group-hover/goal:opacity-100 p-0.5 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-all shrink-0 ml-1"
                      title="Delete Goal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              <form onSubmit={handleAddGoal} className="flex gap-2 items-center w-full mt-2">
                <input 
                  type="text"
                  placeholder="Type a new goal..."
                  value={newGoal} 
                  onChange={(e) => setNewGoal(e.target.value)}
                  className="bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl px-4 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500/50 flex-1 h-10" 
                />
                <button 
                  type="submit"
                  className="w-10 h-10 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center transition-all shadow-md active:scale-95 shrink-0"
                  title="Add Goal"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Right Column: Stats & Profile */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* GPA Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-purple-600 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-24 h-24 text-white" />
            </div>
            <p className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Academic Standing</p>
            <div className="flex items-baseline gap-2 mb-6">
               <h2 className="text-5xl font-black text-white tracking-tighter">{cgpa}</h2>
               <span className="text-indigo-100 text-lg font-bold">CGPA</span>
            </div>
            
            <div className="space-y-4">
               <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70">Recent Semester</span>
                  <span className="font-bold text-white">{combinedResults[combinedResults.length-1]?.sgpa || '0.00'} SGPA</span>
               </div>
               <div className="w-full bg-black/20 h-2 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(parseFloat(cgpa)/10)*100}%` }}
                    className="bg-white h-full"
                  />
               </div>
               <button 
                 onClick={() => onNavigate?.('results')}
                 className="w-full py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-[10px] uppercase font-black tracking-widest text-white transition-all border border-white/10"
               >
                 Detailed Analytics
               </button>
            </div>
          </div>

          {/* Academic Profile Snapshot */}
          <div className="glass-panel p-6 flex-1 shadow-lg dark:shadow-none">
            <h3 className="text-sm font-bold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
              <Layers className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              Academic Profile
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                 <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Roll No.</p>
                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{userData?.rollNo}</p>
              </div>
              <div className="flex justify-between items-center">
                 <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Branch</p>
                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{userData?.branch}</p>
              </div>
              <div className="flex justify-between items-center">
                 <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Program</p>
                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{userData?.program}</p>
              </div>
              <div className="flex justify-between items-center">
                 <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Batch</p>
                 <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{userData?.batch}</p>
              </div>
              <div className="pt-6 border-t border-slate-200 dark:border-white/5">
                 <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-4">Recent Achievements</p>
                 <div className="space-y-3">
                   {getCombinedAchievements().map(ach => (
                     <div key={ach.id} className="flex items-center gap-3 group cursor-default">
                       <div className={`w-1.5 h-1.5 rounded-full ${ach.type === 'Academic' ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-indigo-500 dark:bg-indigo-400'}`} />
                       <p className="text-xs text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{ach.title}</p>
                     </div>
                   ))}
                   {getCombinedAchievements().length === 0 && (
                     <p className="text-[10px] text-slate-400 italic">No recent achievements</p>
                   )}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Helper Modal for Timetable Import process */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 text-white shadow-2xl z-10 scrollbar-thin"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/35">
                  <FileJson className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white tracking-tight uppercase">Import JSON Timetable</h3>
                  <p className="text-xs text-slate-400">Transform your university PDF timetable into structured schedule data using AI</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                    1
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                    Open <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 font-bold">Google AI Studio <ChevronRight className="w-3 h-3 inline font-bold" /></a>
                  </p>
                </div>

                {/* Step 2 */}
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                    2
                  </div>
                  <div className="space-y-3 flex-1 pt-0.5" id="timetable-step2-content">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Make sure it is open in playground, then in the writing bar, write the following prompt -
                    </p>

                    <div className="relative group bg-slate-900 border border-slate-800/80 rounded-2xl p-4 font-mono text-[10px] text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">
                      <button 
                        type="button"
                        onClick={() => {
                          const promptText = `Act as a data engineer. I am providing an image of a university timetable that includes a course metadata table and a weekly schedule.
Please perform the following tasks:
Extract all data into a structured format.
Map course codes to their full titles and instructor names from the metadata table.
Filter the schedule specifically for [Batch 2].
Structure the final output as a single valid JSON file grouped by Day of the week.
Combine both the general lectures/tutorials and the specific lab slots for that batch into the chronological order for each day.
Include fields for: time, type (Lecture/Tutorial/Lab), code, name and venue.
Return only the raw JSON code block in the following format only -
{
"Monday": [
{ "time": "8:30-9:30", "type": "Lecture", "code": "BML101", "name": "Biology for Engineers", "venue": "L-209/LH300" },
{ "time": "9:30-10:30", "type": "Lecture", "code": "ECL101", "name": "Basic Electronics Engineering", "venue": "L-209/LH300" },
{ "time": "10:30-11:30", "type": "Lecture", "code": "MAL101", "name": "Mathematics-II", "venue": "L-209/LH300" },
{ "time": "12:30-1:30", "type": "Tutorial", "code": "MAL101-TUT", "name": "Mathematics-II Tutorial", "venue": "L-201 to L-206" },
{ "time": "4:30-5:30", "type": "Lab", "code": "ECL101", "name": "Basic Electronics Engineering Lab", "venue": "OWQSU" }
]
}`;
                          navigator.clipboard.writeText(promptText);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-slate-800 hover:bg-indigo-500 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 font-sans font-bold text-[9px] text-slate-30 shadow-md"
                        title="Copy Prompt"
                      >
                        {copied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-450" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy Prompt
                          </>
                        )}
                      </button>
{`Act as a data engineer. I am providing an image of a university timetable that includes a course metadata table and a weekly schedule.
Please perform the following tasks:
Extract all data into a structured format.
Map course codes to their full titles and instructor names from the metadata table.
Filter the schedule specifically for [Batch 2].
Structure the final output as a single valid JSON file grouped by Day of the week.
Combine both the general lectures/tutorials and the specific lab slots for that batch into the chronological order for each day.
Include fields for: time, type (Lecture/Tutorial/Lab), code, name and venue.
Return only the raw JSON code block in the following format only -
{
"Monday": [
{ "time": "8:30-9:30", "type": "Lecture", "code": "BML101", "name": "Biology for Engineers", "venue": "L-209/LH300" },
{ "time": "9:30-10:30", "type": "Lecture", "code": "ECL101", "name": "Basic Electronics Engineering", "venue": "L-209/LH300" },
{ "time": "10:30-11:30", "type": "Lecture", "code": "MAL101", "name": "Mathematics-II", "venue": "L-209/LH300" },
{ "time": "12:30-1:30", "type": "Tutorial", "code": "MAL101-TUT", "name": "Mathematics-II Tutorial", "venue": "L-201 to L-206" },
{ "time": "4:30-5:30", "type": "Lab", "code": "ECL101", "name": "Basic Electronics Engineering Lab", "venue": "OWQSU" }
]
}`}
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      then upload the timetable got from the university in pdf format.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                    3
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                    save the given json code in form of json format (e.g. <span className="font-mono text-indigo-400 font-bold">timetable.json</span>)
                  </p>
                </div>

                {/* Step 4 */}
                <div className="flex gap-3 font-semibold">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400 shrink-0">
                    4
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pt-0.5">
                    then upload this json file in upload section below.
                  </p>
                </div>
              </div>

              {/* Upload Action with Icon Button */}
              <div className="mt-8 pt-6 border-t border-slate-800" id="timetable-upload-section">
                <input 
                  type="file" 
                  id="modal-timetable-upload-input"
                  className="hidden" 
                  accept="application/json" 
                  onChange={(e) => {
                    handleTimetableUpload(e);
                    setIsImportModalOpen(false);
                  }} 
                  disabled={isUploadingTimetable} 
                />
                
                <div className="flex flex-col items-center justify-center p-6 bg-slate-900 border-2 border-dashed border-slate-850 hover:border-indigo-500/45 rounded-2xl transition-all group">
                  <label 
                    htmlFor="modal-timetable-upload-input"
                    className="cursor-pointer flex flex-col items-center gap-3 select-none"
                    id="modal-upload-label"
                  >
                    <div className="w-14 h-14 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-all shadow-lg border border-indigo-500/10">
                      <UploadCloud className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-300 group-hover:text-indigo-400 transition-colors">
                        Choose timetable.json File
                      </span>
                      <p className="text-[10px] text-[#64748b] mt-1 font-medium">Click to select only JSON formatted schedule files</p>
                    </div>
                  </label>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Activity Add Modal */}
      <AnimatePresence>
        {isAddingActivity && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingActivity(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-slate-900 dark:text-white shadow-2xl z-10"
            >
              {/* Close Button */}
              <button 
                onClick={() => setIsAddingActivity(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="p-2 bg-indigo-500/15 rounded-xl border border-indigo-500/35">
                  <Plus className="w-5 h-5 text-indigo-500" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight uppercase">Add {activityFormType === 'academic' ? 'Academic' : 'Club'} Event</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Broadcast a new schedule item to branch students</p>
                </div>
              </div>

              <form onSubmit={handleAddActivitySubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Event Title *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. End Sem Registration / Technical Workshop"
                    value={activityForm.title}
                    onChange={e => setActivityForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Date / Time (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2026-05-25 or Friday 4 PM"
                    value={activityForm.date}
                    onChange={e => setActivityForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Description / Instructions</label>
                  <textarea 
                    placeholder="Enter registration details, venue, expectations..."
                    value={activityForm.description}
                    rows={3}
                    onChange={e => setActivityForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button 
                    type="button"
                    onClick={() => setIsAddingActivity(false)}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-wider text-[11px] px-5 py-2 rounded-xl shadow-md transition-all shrink-0"
                  >
                    Post Event
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
