import { useState } from 'react';
import { Settings as SettingsIcon, Moon, Sun, Bell, Shield, Eye, HelpCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { deleteUser } from 'firebase/auth';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

interface SettingsProps {
  user: any;
  userData: any;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export default function Settings({ user, userData, theme, setTheme }: SettingsProps) {
  const [notifications, setNotifications] = useState(true);
  const [purging, setPurging] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePurge = async () => {
    setPurging(true);
    try {
      const uid = user?.uid;
      
      // 1. Clear local storage data
      localStorage.removeItem('local-session-user');
      localStorage.removeItem('local-session-userdata');
      if (uid) {
        localStorage.removeItem(`portal-goals-${uid}`);
        localStorage.removeItem(`portal-results-${uid}`);
        localStorage.removeItem(`portal-timetable-${userData?.branch || 'General'}_${userData?.batch || 'All'}`);
      }

      // 2. Clear Firestore data if Firebase is active
      if (auth?.currentUser && db) {
        const fUid = auth.currentUser.uid;
        
        // Delete all user related data
        const collectionsToClear = ['results', 'achievements', 'goals'];
        for (const colName of collectionsToClear) {
          const q = query(collection(db, colName), where('uid', '==', fUid));
          const snap = await getDocs(q);
          const deletes = snap.docs.map(d => deleteDoc(doc(db, colName, d.id)));
          await Promise.all(deletes);
        }

        // Delete user profile
        const userRef = doc(db, 'users', fUid);
        await deleteDoc(userRef);

        // Finally delete the auth user
        await deleteUser(auth.currentUser);
      }

      // Refresh the page to reset application state
      window.location.reload();
    } catch (err: any) {
      console.error('Purge failed:', err);
      if (err.code === 'auth/requires-recent-login') {
        alert('For security reasons, this action requires a recent login. Please sign out and sign in again before purging data.');
      } else {
        alert('Failed to purge data: ' + err.message);
      }
    } finally {
      setPurging(false);
      setShowConfirm(false);
    }
  };

  const sections = [
    {
      title: 'Appearance',
      items: [
        { label: 'Theme', description: 'Switch between light and dark mode.', icon: theme === 'dark' ? Moon : Sun, toggle: true, value: theme === 'dark', onChange: () => setTheme(theme === 'dark' ? 'light' : 'dark') },
        { label: 'Reduced Motion', description: 'Minimize the amount of animations.', icon: Eye, toggle: true, value: false, onChange: () => {} },
      ]
    },
    {
      title: 'Notifications',
      items: [
        { label: 'Assignment Deadlines', description: 'Get notified 24h before deadlines.', icon: Bell, toggle: true, value: notifications, onChange: () => setNotifications(!notifications) },
        { label: 'New Resources', description: 'Alert when CR shares new materials.', icon: Bell, toggle: true, value: true, onChange: () => {} },
      ]
    },
    {
      title: 'Privacy & Security',
      items: [
        { label: 'Search Visibility', description: 'Allow other students to find you.', icon: Shield, toggle: true, value: true, onChange: () => {} },
        { label: 'LDAP Integration', description: 'Last synced 2 days ago.', icon: HelpCircle, toggle: false, value: 'Connected' },
      ]
    }
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Portal Settings</h1>
        <p className="text-slate-500 mt-1 text-sm tracking-wide">Manage your account preferences and system configurations.</p>
      </div>

      <div className="space-y-12">
        {sections.map((section, idx) => (
          <section key={idx} className="space-y-4">
            <h3 className="text-[10px] font-black uppercase text-indigo-500 dark:text-indigo-400 tracking-[0.3em] ml-1">{section.title}</h3>
            <div className="glass-panel overflow-hidden shadow-xl dark:shadow-none">
              <div className="divide-y divide-slate-200 dark:divide-white/5">
                {section.items.map((item, iIdx) => (
                  <div key={iIdx} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="p-2.5 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/5 rounded-xl text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-white group-hover:border-indigo-200 dark:group-hover:border-white/20 transition-all">
                        <item.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white tracking-tight">{item.label}</h4>
                        <p className="text-xs text-slate-500 mt-0.5 italic">{item.description}</p>
                      </div>
                    </div>
                    {item.toggle ? (
                      <button 
                        onClick={item.onChange}
                        className={`w-12 h-6 rounded-full p-1 transition-colors relative ${item.value ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-black/40'}`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${item.value ? 'translate-x-6' : 'translate-x-0'}`} />
                      </button>
                    ) : (
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.value as string}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="pt-8 border-t border-slate-200 dark:border-white/5 flex items-center justify-between">
        <div className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">
          Version 1.1.0 • Build FROSTED
        </div>
        
        {showConfirm ? (
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> ARE YOU SURE? THIS IS IRREVERSIBLE.
            </span>
            <button 
              onClick={() => setShowConfirm(false)}
              className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest"
            >
              Cancel
            </button>
            <button 
              onClick={handlePurge}
              disabled={purging}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2"
            >
              {purging ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm Purge'}
            </button>
          </div>
        ) : (
          <button 
            onClick={() => setShowConfirm(true)}
            className="text-[10px] font-black text-red-400/70 hover:text-red-400 uppercase tracking-widest transition-colors"
          >
            Purge Portal Data
          </button>
        )}
      </div>
    </div>
  );
}
