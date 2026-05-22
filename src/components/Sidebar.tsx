import { Page } from '../App';
import { 
  LayoutDashboard, 
  User, 
  Library, 
  FileText, 
  Trophy, 
  FileEdit, 
  Settings, 
  LogOut,
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import IITBhilaiLogo from './IITBhilaiLogo';

interface SidebarProps {
  currentPage: Page;
  setCurrentPage: (page: Page) => void;
  userData: any;
  theme: 'light' | 'dark';
  onLogout: () => void;
}

export default function Sidebar({ currentPage, setCurrentPage, userData, theme, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'resources', label: 'Resources', icon: Library },
    { id: 'results', label: 'Semester Results', icon: FileText },
    { id: 'achievements', label: 'Achievements', icon: Trophy },
    { id: 'resume', label: 'AI Resume Builder', icon: FileEdit },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleLogout = () => {
    onLogout();
  };

  const isDark = theme === 'dark';

  return (
    <aside className={`w-64 transition-colors duration-500 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-200 border-slate-300'} backdrop-blur-xl border-r flex flex-col h-full z-20`}>
      {/* Brand */}
      <div className="p-6 flex items-center gap-3">
        <IITBhilaiLogo size={42} variant="colored" />
        <div>
          <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-slate-800'} tracking-tight leading-tight`}>IIT Bhilai<span className="text-indigo-500 dark:text-indigo-400"><br />Student Portal</span></h2>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id as Page)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
              currentPage === item.id 
                ? (isDark ? 'bg-white/10 text-white' : 'bg-indigo-500 text-white shadow-md shadow-indigo-500/20') 
                : (isDark ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:text-indigo-600 hover:bg-indigo-50')
            }`}
          >
            {currentPage === item.id && isDark && (
              <motion.div 
                layoutId="active-nav"
                className="absolute left-0 w-1 h-6 bg-indigo-500 rounded-r-full"
              />
            )}
            <item.icon className={`w-5 h-5 transition-transform duration-200 ${currentPage === item.id ? 'scale-110' : 'group-hover:scale-110'}`} />
            <span className="text-sm font-medium tracking-wide">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4">
        <div className={`${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm'} rounded-2xl p-4 border mb-4 group hover:shadow-md transition-all`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${isDark ? 'bg-slate-500/20 border-white/10' : 'bg-slate-100 border-slate-200'} overflow-hidden border`}>
              {userData?.profilePic ? (
                <img src={userData.profilePic} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex items-center justify-center text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-400'}`}>
                  {userData?.firstName?.[0]}{userData?.lastName?.[0]}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {userData?.designation}
              </p>
              <h3 className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-slate-700'}`}>
                {userData?.firstName} {userData?.lastName}
              </h3>
            </div>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${isDark ? 'text-slate-400 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-600 hover:text-red-500 hover:bg-red-50'}`}
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
