import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, orderBy, setDoc } from 'firebase/firestore';
import { Trophy, Plus, Trash2, Calendar, Award, Star, ExternalLink, Image as ImageIcon, Pencil, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PERMANENT_ACHIEVEMENTS = [
  {
    id: 'perm_ach1',
    title: 'Inter-IIT Tech Meet Gold',
    date: '2024-12-15',
    description: 'Indian Institute of Technology Bhilai secured Gold in the Inter-IIT Tech Meet competition.',
    type: 'Non-Academic',
    isPermanent: true
  },
  {
    id: 'perm_ach2',
    title: "Dean's List 2024",
    date: '2024-05-15',
    description: 'Recognized on the Dean\'s List for exceptional academic performance throughout the year 2023-2024.',
    type: 'Academic',
    isPermanent: true
  }
];

interface AchievementsProps {
  user: any;
  userData: any;
}

export default function Achievements({ user, userData }: AchievementsProps) {
  const [achievements, setAchievements] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    type: 'Academic',
    fileLink: ''
  });

  const [overrides, setOverrides] = useState<{ deletedIds: string[]; editedItems: Record<string, any> }>({
    deletedIds: [],
    editedItems: {}
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', date: '', description: '', type: 'Academic' });

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

  const handlePermanentDelete = async (id: string) => {
    const updatedDeleted = [...overrides.deletedIds, id];
    await saveOverrides(updatedDeleted, overrides.editedItems);
  };

  const startPermanentEdit = (ach: any) => {
    setEditingId(ach.id);
    setEditForm({
      title: ach.title,
      date: ach.date,
      description: ach.description,
      type: ach.type
    });
  };

  const handlePermanentEditSave = async (id: string) => {
    const updatedEdited = {
      ...overrides.editedItems,
      [id]: {
        title: editForm.title,
        date: editForm.date,
        description: editForm.description,
        type: editForm.type
      }
    };
    await saveOverrides(overrides.deletedIds, updatedEdited);
    setEditingId(null);
  };

  useEffect(() => {
    if (!user) return;

    // Load from Express backend database
    const loadAchievementsFromDb = async () => {
      try {
        const res = await fetch(`/api/achievements?uid=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setAchievements(data);
          localStorage.setItem(`portal-achievements-${user.uid}`, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Could not query achievements backend database:", err);
        // Local storage fallback
        const fallback = localStorage.getItem(`portal-achievements-${user.uid}`);
        if (fallback) {
          try {
            setAchievements(JSON.parse(fallback));
          } catch (_) {}
        }
      }
    };

    loadAchievementsFromDb();

    if (!db || !auth?.currentUser) return;

    const q = query(
      collection(db, 'achievements'), 
      where('uid', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setAchievements(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'achievements');
    });
    return () => unsub();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...formData,
      uid: user.uid
    };

    // Optimistically update local state & local storage
    const tempId = `temp_${Date.now()}`;
    const newAchievement = { id: tempId, ...payload };
    const updatedAchievements = [newAchievement, ...achievements];
    setAchievements(updatedAchievements);
    localStorage.setItem(`portal-achievements-${user.uid}`, JSON.stringify(updatedAchievements));

    try {
      // 1. Write to permanent backend database
      const res = await fetch('/api/achievements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const saved = await res.json();
        setAchievements(prev => prev.map(a => a.id === tempId ? saved : a));
      }
    } catch (err) {
      console.warn("Express database achievements write failed:", err);
    }

    // 2. Dual write to Firestore if active
    if (db) {
      try {
        await addDoc(collection(db, 'achievements'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      } catch (fbErr) {
        console.warn("Firestore achievements write bypassed:", fbErr);
      }
    }

    setFormData({ 
      title: '', 
      date: new Date().toISOString().split('T')[0], 
      description: '', 
      type: 'Academic',
      fileLink: ''
    });
    setShowAdd(false);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    // Optimistic delete
    const updatedAchievements = achievements.filter(a => a.id !== id);
    setAchievements(updatedAchievements);
    localStorage.setItem(`portal-achievements-${user.uid}`, JSON.stringify(updatedAchievements));

    // 1. Delete from backend database
    try {
      await fetch(`/api/achievements/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Express database achievements delete failed:", err);
    }

    // 2. Dual delete from Firestore if active
    if (db) {
      try {
        await deleteDoc(doc(db, 'achievements', id));
      } catch (fbErr) {
        console.warn("Firestore achievements delete bypassed:", fbErr);
      }
    }
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

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Wall of Fame</h1>
          <p className="text-slate-500 mt-1 text-sm tracking-wide">Keep track of your academic and extracurricular milestones.</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/10"
        >
          <Plus className="w-4 h-4" /> Log Achievement
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Title / Milestone</label>
                  <input 
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="e.g. Winner of Inter-College Hackathon"
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors placeholder:text-slate-600"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Category</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors appearance-none"
                  >
                    <option value="Academic">Academic Achievement</option>
                    <option value="Non-Academic">Non-Academic Achievement</option>
                    <option value="Certification">Professional Certification</option>
                    <option value="Other">Other Milestone</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Date Achieved</label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Verification Link / Media (Optional)</label>
                  <div className="relative">
                    <ImageIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                    <input 
                      value={formData.fileLink}
                      onChange={(e) => setFormData({ ...formData, fileLink: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Description</label>
                <textarea 
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Tell us more about this achievement..."
                  rows={3}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors resize-none placeholder:text-slate-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-300">Discard</button>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all opacity-100 disabled:opacity-50"
                >
                   {loading ? 'Adding...' : 'Post Achievement'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="columns-1 md:columns-2 xl:columns-3 gap-8 space-y-8">
        {getCombinedAchievements().map((ach) => (
          <motion.div 
            layout
            key={ach.id}
            className="break-inside-avoid mb-6 bg-white/5 backdrop-blur-sm border border-white/10 p-6 rounded-3xl hover:border-indigo-500/30 transition-all group relative"
          >
            {editingId === ach.id ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase font-black text-slate-500">Title</label>
                  <input
                    value={editForm.title}
                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black text-slate-500">Date</label>
                  <input
                    type="date"
                    value={editForm.date}
                    onChange={e => setEditForm({ ...editForm, date: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black text-slate-500">Category</label>
                  <select
                    value={editForm.type}
                    onChange={e => setEditForm({ ...editForm, type: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500 appearance-none"
                  >
                    <option value="Academic">Academic Achievement</option>
                    <option value="Non-Academic">Non-Academic Achievement</option>
                    <option value="Certification">Professional Certification</option>
                    <option value="Other">Other Milestone</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] uppercase font-black text-slate-500">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white mt-1 focus:outline-none focus:border-indigo-500 h-24 resize-none"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePermanentEditSave(ach.id)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold shadow-md"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl border flex items-center justify-center ${ach.type === 'Academic' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : 'bg-indigo-500/5 border-indigo-500/20 text-indigo-400'}`}>
                    {ach.type === 'Academic' ? <Award className="w-5 h-5" /> : <Star className="w-5 h-5" />}
                  </div>
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isCR && ach.isPermanent && (
                      <button 
                        onClick={() => startPermanentEdit(ach)}
                        className="p-1 px-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-indigo-500/30 text-indigo-400 rounded-lg transition-all"
                        title="Edit Sample"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button 
                      onClick={() => ach.isPermanent ? handlePermanentDelete(ach.id) : handleDelete(ach.id)}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors leading-tight tracking-tight">{ach.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{ach.type}</span>
                  <span className="text-slate-700">•</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(ach.date).toLocaleDateString()}</span>
                </div>
                <p className="mt-4 text-xs text-slate-400 leading-relaxed italic line-clamp-4">{ach.description}</p>
                
                {ach.fileLink && (
                  <a 
                    href={ach.fileLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="mt-6 inline-flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] hover:underline decoration-indigo-400/50 underline-offset-4"
                  >
                    View Evidence <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </>
            )}
          </motion.div>
        ))}
      </div>

      {getCombinedAchievements().length === 0 && (
        <div className="py-32 text-center">
          <div className="w-20 h-20 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Trophy className="w-10 h-10 text-slate-700" />
          </div>
          <h4 className="text-slate-400 font-bold tracking-tight text-lg">No achievements logged yet</h4>
          <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto italic">Don\'t be shy! Your milestones inspire you and help the AI build a better resume.</p>
        </div>
      )}
    </div>
  );
}
