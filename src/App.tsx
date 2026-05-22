/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Profile from './components/Profile';
import Resources from './components/Resources';
import Results from './components/Results';
import Achievements from './components/Achievements';
import Resume from './components/Resume';
import Settings from './components/Settings';
import { motion, AnimatePresence } from 'motion/react';

export type Page = 'dashboard' | 'profile' | 'resources' | 'results' | 'achievements' | 'resume' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('portal-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('portal-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // 1. Check local session storage first to run offline/local-first smoothly
    const localUserStr = localStorage.getItem('local-session-user');
    const localUserDataStr = localStorage.getItem('local-session-userdata');
    if (localUserStr && localUserDataStr) {
      try {
        setUser(JSON.parse(localUserStr));
        setUserData(JSON.parse(localUserDataStr));
        setLoading(false);
      } catch (err) {
        console.error("Failed to restore local session:", err);
      }
    }

    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        setUser(fbUser);
        if (db) {
          const docRef = doc(db, 'users', fbUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserData(docSnap.data());
          }
        }
      } else {
        const localUserExists = localStorage.getItem('local-session-user');
        if (!localUserExists) {
          setUser(null);
          setUserData(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className={`flex h-screen w-screen items-center justify-center transition-colors duration-500 ${theme === 'dark' ? 'bg-zinc-950 text-white' : 'bg-slate-50 text-slate-900'} font-sans`}>
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className={`${theme === 'dark' ? 'text-zinc-400' : 'text-slate-500'} font-medium tracking-widest text-xs uppercase text-center`}>Initializing Student Portal...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth 
        onAuthSuccess={(loginUser, loginUserData) => {
          if (loginUser) {
            setUser(loginUser);
            if (loginUserData) setUserData(loginUserData);
          }
        }} 
      />
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <Dashboard user={user} userData={userData} onNavigate={setCurrentPage} />;
      case 'profile': return <Profile user={user} userData={userData} onUpdate={setUserData} />;
      case 'resources': return <Resources user={user} userData={userData} />;
      case 'results': return <Results user={user} userData={userData} />;
      case 'achievements': return <Achievements user={user} userData={userData} />;
      case 'resume': return <Resume user={user} userData={userData} />;
      case 'settings': return <Settings user={user} userData={userData} theme={theme} setTheme={setTheme} />;
      default: return <Dashboard user={user} userData={userData} onNavigate={setCurrentPage} />;
    }
  };

  const handleLogout = async () => {
    if (auth) {
      try {
        await auth.signOut();
      } catch (err) {
        console.error("Firebase signOut failed:", err);
      }
    }
    localStorage.removeItem('local-session-user');
    localStorage.removeItem('local-session-userdata');
    setUser(null);
    setUserData(null);
    setCurrentPage('dashboard');
  };

  return (
    <div className={`flex h-screen transition-colors duration-500 ${theme === 'dark' ? 'bg-[#0f172a] text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans overflow-hidden relative`}>
      {/* Background Mesh Gradients - Only visible in dark mode or subtle in light */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] ${theme === 'dark' ? 'bg-indigo-600/20' : 'bg-indigo-600/5'} rounded-full blur-[120px] animate-blob`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-500/5'} rounded-full blur-[120px] animate-blob animation-delay-4000`}></div>
      <div className={`absolute top-[20%] right-[10%] w-[30%] h-[30%] ${theme === 'dark' ? 'bg-purple-600/10' : 'bg-purple-600/5'} rounded-full blur-[100px] animate-blob animation-delay-2000`}></div>

      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={setCurrentPage} 
        userData={userData}
        theme={theme}
        onLogout={handleLogout}
      />
      <main className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "circOut" }}
            className="h-full"
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
