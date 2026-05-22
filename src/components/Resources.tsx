import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { Library, Plus, Trash2, ExternalLink, FileText, Globe, Code, Layers, ShieldAlert, Award, Pencil, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const PERMANENT_RESOURCES = [
  {
    id: 'perm_math2',
    title: 'MAL101: Mathematics-II End-Sem Hints & Marking Scheme',
    link: '/resources/mal101_endsem_solutions.pdf',
    type: 'PDF',
    isPermanent: true,
    branch: 'All',
    batch: 'All',
    createdBy: 'Department of Mathematics'
  },
  {
    id: 'perm_machines',
    title: 'Electric Machines and Transformers Reference Guide',
    link: '/resources/electric_machines_transformers.pdf',
    type: 'PDF',
    isPermanent: true,
    branch: 'All',
    batch: 'All',
    createdBy: 'Department of Electrical Engineering'
  }
];

interface ResourcesProps {
  user: any;
  userData: any;
}

export default function Resources({ user, userData }: ResourcesProps) {
  const [resources, setResources] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newResource, setNewResource] = useState({ title: '', link: '', type: 'PDF' });
  const [loading, setLoading] = useState(false);

  const [overrides, setOverrides] = useState<{ deletedIds: string[]; editedItems: Record<string, any> }>({
    deletedIds: [],
    editedItems: {}
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: '', link: '', createdBy: '' });

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

  const startPermanentEdit = (res: any) => {
    setEditingId(res.id);
    setEditForm({
      title: res.title,
      link: res.link,
      createdBy: res.createdBy
    });
  };

  const handlePermanentEditSave = async (id: string) => {
    const updatedEdited = {
      ...overrides.editedItems,
      [id]: {
        title: editForm.title,
        link: editForm.link,
        createdBy: editForm.createdBy
      }
    };
    await saveOverrides(overrides.deletedIds, updatedEdited);
    setEditingId(null);
  };

  useEffect(() => {
    if (!userData) return;
    
    if (!db || !auth?.currentUser) {
      const fetchLocalResources = async () => {
        try {
          const branchName = userData.branch || 'General';
          const res = await fetch(`/api/resources?branch=${branchName}`);
          if (res.ok) {
            const data = await res.json();
            setResources(data);
          }
        } catch (err) {
          console.warn("Could not load local resources:", err);
        }
      };
      fetchLocalResources();
      return;
    }

    const q = query(collection(db, 'resources'), where('branch', '==', userData.branch));
    const unsub = onSnapshot(q, (snap) => {
      setResources(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'resources');
    });
    return () => unsub();
  }, [user, userData]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResource.title || !newResource.link) return;
    setLoading(true);

    const payload = {
      ...newResource,
      branch: userData?.branch || 'General',
      createdBy: user?.uid || 'anonymous'
    };

    const tempId = `temp_res_${Date.now()}`;
    const newResItem = { id: tempId, ...payload, createdAt: new Date().toISOString() };
    
    if (!db) {
      setResources(prev => [newResItem, ...prev]);
    }

    // 1. Post to Express
    try {
      const res = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok && !db) {
        const saved = await res.json();
        setResources(prev => prev.map(r => r.id === tempId ? saved : r));
      }
    } catch (err) {
      console.warn("Express addResource failed:", err);
    }

    // 2. Post to Firestore
    if (db) {
      try {
        await addDoc(collection(db, 'resources'), {
          ...payload,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("Firestore addResource failed:", err);
      }
    }

    setNewResource({ title: '', link: '', type: 'PDF' });
    setShowAdd(false);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    setResources(prev => prev.filter(r => r.id !== id));

    // 1. Delete from Express
    try {
      await fetch(`/api/resources/${id}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.warn("Express deleteResource failed:", err);
    }

    // 2. Delete from Firestore
    if (db) {
      try {
        await deleteDoc(doc(db, 'resources', id));
      } catch (err) {
        console.error("Firestore deleteResource failed:", err);
      }
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'PDF': return <FileText className="w-5 h-5 text-red-500" />;
      case 'Web': return <Globe className="w-5 h-5 text-blue-500" />;
      case 'Code': return <Code className="w-5 h-5 text-emerald-500" />;
      default: return <Layers className="w-5 h-5 text-zinc-500" />;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Handpicked Resources</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-500 text-sm tracking-wide">Curated study materials for {userData?.branch} {userData?.batch}.</p>
          </div>
        </div>
        {isCR && (
          <button 
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/10"
          >
            <Plus className="w-4 h-4" /> Share Resource
          </button>
        )}
      </div>

      {/* Access & Management Notice banner */}
      <div className="flex items-start gap-3 p-4 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl border border-indigo-500/15 text-xs text-indigo-700 dark:text-indigo-400 shadow-sm animate-fade-in">
        <ShieldAlert className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5 animate-pulse" />
        <div className="space-y-1">
          <p className="font-bold uppercase tracking-wider text-[10px] text-indigo-600 dark:text-indigo-400">Access & Management Notice</p>
          <p className="leading-relaxed opacity-90">
            Resources are managed by the <strong>Class Representative (CR)</strong> and <strong>Deputy Class Representative (DCR)</strong> only. 
            They will post relevant study materials and preparation resources for exams, such as <strong>Previous Years' Papers (PYQs)</strong>, <strong>Class Notes</strong>, cheat sheets, reference links, and reference books.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAdd}
            className="glass-panel p-6 overflow-hidden shadow-xl"
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Resource Title</label>
                <input 
                  value={newResource.title}
                  onChange={(e) => setNewResource({ ...newResource, title: e.target.value })}
                  placeholder="e.g. OS Lecture Notes"
                  className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 mt-1.5"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Type</label>
                <select 
                  value={newResource.type}
                  onChange={(e) => setNewResource({ ...newResource, type: e.target.value })}
                  className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 mt-1.5 appearance-none"
                >
                  <option value="PDF" className="bg-white dark:bg-slate-900">PDF / Document</option>
                  <option value="Web" className="bg-white dark:bg-slate-900">Website / Article</option>
                  <option value="Code" className="bg-white dark:bg-slate-900">Source Code / Repo</option>
                  <option value="Other" className="bg-white dark:bg-slate-900">Other</option>
                </select>
              </div>
              <div className="flex items-end">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full h-11 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all"
                >
                  {loading ? 'Sharing...' : 'Confirm Post'}
                </button>
              </div>
              <div className="md:col-span-4 mt-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">URL / Link</label>
                <input 
                  value={newResource.link}
                  onChange={(e) => setNewResource({ ...newResource, link: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500/50 mt-1.5"
                  required
                />
              </div>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* 🏛️ Permanent Institute Resources Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-indigo-500 animate-pulse" />
          <h2 className="text-[10px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400">🏛️ Permanent Institute Resources (Available to All)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PERMANENT_RESOURCES
            .map(res => {
              const oVal = overrides.editedItems?.[res.id];
              return oVal ? { ...res, ...oVal } : res;
            })
            .filter(res => !overrides.deletedIds?.includes(res.id))
            .map((res) => (
              <motion.div 
                layout
                key={res.id}
                className="glass-panel p-5 rounded-3xl bg-indigo-500/5 dark:bg-indigo-500/5 group border-2 border-indigo-500/25 hover:border-indigo-500/50 transition-all hover:bg-white dark:hover:bg-slate-900/40 relative overflow-hidden shadow-sm"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
                <div className="flex items-start justify-between">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 group-hover:text-white group-hover:bg-indigo-500 rounded-2xl transition-all">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/20 px-2 py-0.5 rounded-full tracking-widest">
                      Verified Courseware
                    </span>
                    {isCR && editingId !== res.id && (
                      <div className="flex items-center gap-1 z-10 ml-2">
                        <button 
                          onClick={() => startPermanentEdit(res)}
                          className="p-1 px-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg transition-all"
                          title="Edit Sample"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button 
                          onClick={() => handlePermanentDelete(res.id)}
                          className="p-1 px-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 rounded-lg transition-all"
                          title="Delete Sample"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {editingId === res.id ? (
                  <div className="mt-4 space-y-3 z-10 relative">
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Title</label>
                      <input
                        value={editForm.title}
                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-1.5 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-500 tracking-wider">URL / Link</label>
                      <input
                        value={editForm.link}
                        onChange={e => setEditForm({ ...editForm, link: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-1.5 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mt-1"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-black text-slate-500 tracking-wider">Publisher</label>
                      <input
                        value={editForm.createdBy}
                        onChange={e => setEditForm({ ...editForm, createdBy: e.target.value })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl py-1.5 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 mt-1"
                        required
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                      <button 
                        onClick={() => handlePermanentEditSave(res.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold shadow-md"
                      >
                        <Check className="w-3 h-3" /> Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mt-4">
                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white transition-colors truncate tracking-tight">{res.title}</h3>
                      <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mt-1">Publisher: {res.createdBy}</p>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <a 
                        href={res.link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md active:scale-[0.98]"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> View PDF
                      </a>
                      <a 
                        href={res.link} 
                        download={`${res.id === 'perm_math2' ? 'mal101_endsem_solutions' : 'electric_machines_transformers'}.pdf`}
                        className="flex items-center justify-center gap-1.5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold transition-all active:scale-[0.98]"
                      >
                        <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download
                      </a>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-800/80 my-4 pt-4">
        <h2 className="text-[10px] uppercase font-black tracking-wider text-slate-500 dark:text-slate-400 mb-4">📚 Curated Shared Materials ({userData?.branch || 'Branch'}-focused)</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {resources.map((res) => (
          <motion.div 
            layout
            key={res.id}
            className="glass-panel p-5 rounded-3xl group hover:border-indigo-500/30 transition-all hover:bg-white dark:hover:bg-white/10 relative"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 glass-card text-slate-500 group-hover:text-indigo-400 dark:group-hover:text-white transition-colors">
                {getIcon(res.type)}
              </div>
              {isCR && (
                <button 
                  onClick={() => handleDelete(res.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="mt-4">
              <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate tracking-tight">{res.title}</h3>
              <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">{res.type}</p>
            </div>
            <a 
              href={res.link} 
              target="_blank" 
              rel="noreferrer"
              className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-slate-50 dark:bg-white/5 hover:bg-indigo-500 text-slate-500 dark:text-slate-400 hover:text-white rounded-2xl text-xs font-bold transition-all border border-slate-200 dark:border-white/5 group-hover:border-transparent"
            >
               Open Resource <ExternalLink className="w-3 h-3" />
            </a>
          </motion.div>
        ))}
        {resources.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 py-32 text-center">
            <Library className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-500 font-medium italic">No resources shared yet for your branch.</p>
          </div>
        )}
      </div>
    </div>
  );
}
