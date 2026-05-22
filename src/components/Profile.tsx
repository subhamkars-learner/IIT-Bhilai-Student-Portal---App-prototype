import { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { User, Mail, Phone, GraduationCap, BookOpen, Layers, Camera, Save, X, UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';

interface ProfileProps {
  user: any;
  userData: any;
  onUpdate: (data: any) => void;
}

export default function Profile({ user, userData, onUpdate }: ProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editedData, setEditedData] = useState({ ...userData });

  const handleStartEditing = () => {
    setEditedData({ ...userData });
    setIsEditing(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate format (JPG/PNG)
    const ext = file.name.split('.').pop()?.toLowerCase();
    const validExts = ['png', 'jpg', 'jpeg'];
    const validMimes = ['image/png', 'image/jpeg', 'image/jpg'];
    
    if (!validExts.includes(ext || '') && !validMimes.includes(file.type)) {
      alert("Invalid format! Please upload either a JPG or PNG format photo.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large! Please upload a photo under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      const updatedData = { ...editedData, profilePic: base64String };
      setEditedData(updatedData);
      
      setLoading(true);
      try {
        localStorage.setItem('local-session-userdata', JSON.stringify(updatedData));
        
        try {
          await fetch('/api/auth/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: user.uid, editedData: updatedData })
          });
        } catch (err) {
          console.warn("Could not save profile photo to server disk:", err);
        }

        if (db) {
          try {
            await updateDoc(doc(db, 'users', user.uid), updatedData);
          } catch (dbErr) {
            console.warn("Firestore profile photo sync skipped:", dbErr);
          }
        }
        
        onUpdate(updatedData);
      } catch (err) {
        console.error("Failed to upload profile photo:", err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // 1. Save local state
      localStorage.setItem('local-session-userdata', JSON.stringify(editedData));
      
      // 2. Proactively update users.json server-side
      try {
        await fetch('/api/auth/update-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid, editedData })
        });
      } catch (err) {
        console.warn("Could not save profile change to server disk:", err);
      }

      // 3. Fallback to Firestore if database is present
      if (db) {
        try {
          await updateDoc(doc(db, 'users', user.uid), editedData);
        } catch (dbErr) {
          console.warn("Firestore profile sync skipped:", dbErr);
        }
      }
      
      onUpdate(editedData);
      setIsEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const infoItems = [
    { label: 'Roll Number', value: userData?.rollNo, icon: User, key: 'rollNo', editable: false },
    { label: 'Email Address', value: userData?.email, icon: Mail, key: 'email', editable: false },
    { label: 'Mobile Number', value: userData?.mobile, icon: Phone, key: 'mobile', editable: true },
    { label: 'Program', value: userData?.program, icon: GraduationCap, key: 'program', editable: true },
    { label: 'Branch / Discipline', value: userData?.branch, icon: BookOpen, key: 'branch', editable: true },
    { label: 'Batch', value: userData?.batch, icon: Layers, key: 'batch', editable: true },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white tracking-tight">Student Profile</h1>
        {!isEditing ? (
          <button 
            onClick={handleStartEditing}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl text-sm font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-all"
          >
            <Camera className="w-4 h-4" /> Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-transparent border border-white/10 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-300"
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-all"
            >
              {loading ? 'Saving...' : <><Save className="w-4 h-4" /> Save Changes</>}
            </button>
          </div>
        )}
      </div>

      {/* Profile Card */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl group">
        <div className="h-32 bg-gradient-to-r from-indigo-500/20 to-emerald-500/20" />
        <div className="px-8 pb-8">
          <div className="relative -top-12 flex flex-col md:flex-row items-end gap-6">
            <div 
              onClick={() => document.getElementById('profile-pic-uploader')?.click()}
              className="w-32 h-32 rounded-3xl bg-[#0f172a] border-4 border-[#0f172a] shadow-xl overflow-hidden relative cursor-pointer group/avatar shrink-0"
            >
              <img 
                src={editedData?.profilePic || userData?.profilePic || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData?.rollNo}`} 
                alt="Profile" 
                className="w-full h-full object-cover group-hover/avatar:scale-105 transition-transform"
              />
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white mb-1 animate-bounce" />
                <span className="text-[9px] font-black uppercase text-white tracking-widest text-center px-2">Upload Photo</span>
              </div>
            </div>
            <input 
              type="file"
              id="profile-pic-uploader"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="pb-2">
              <h2 className="text-3xl font-black text-white tracking-tighter">
                {userData?.firstName} {userData?.lastName}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                  {userData?.designation}
                </span>
                <span className="text-slate-500 text-xs font-medium tracking-wide">• Student Portal Member</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-wider flex items-center gap-1.5 opacity-90 bg-indigo-500/5 border border-indigo-500/10 py-1.5 px-3 rounded-xl w-fit">
                <UploadCloud className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                <span>Click photo to upload custom JPG/PNG</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 mt-4">
            {infoItems.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-500">
                  <item.icon className="w-3.5 h-3.5" />
                  <label className="text-[10px] font-black uppercase tracking-widest leading-none">{item.label}</label>
                </div>
                {isEditing && item.editable ? (
                  <input 
                    value={editedData[item.key] || ''}
                    onChange={(e) => setEditedData({ ...editedData, [item.key]: e.target.value })}
                    className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                ) : (
                  <p className="text-sm font-bold text-slate-200 pl-0.5">{item.value || 'Not provided'}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
          <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Account Stats</h4>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Status</span>
            <span className="text-xs font-bold text-emerald-400">Active</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-slate-400">Member Since</span>
            <span className="text-xs font-bold text-white">2026</span>
          </div>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
          <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Visibility</h4>
          <p className="text-[10px] text-slate-500 leading-relaxed italic">
            Your profile is visible to the faculty and Class Representatives of IIT Bhilai.
          </p>
        </div>
        <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
          <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4">Security</h4>
          <button className="text-xs font-bold text-indigo-400 hover:text-indigo-300 underline underline-offset-4">Reset Portal Password</button>
        </div>
      </div>
    </div>
  );
}
