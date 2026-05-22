import { useState } from 'react';
import { auth, db } from '../lib/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Phone, Mail, IdCard, BookOpen, Users, Key } from 'lucide-react';
import IITBhilaiLogo from './IITBhilaiLogo';

interface AuthProps {
  onAuthSuccess: (user?: any, userData?: any) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    rollNo: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    program: '',
    branch: '',
    batch: '',
    designation: 'Normal Student',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleForgotPassword = async () => {
    const inputIdentifier = formData.rollNo || formData.email;
    if (!inputIdentifier) {
      setError('Please enter your Roll No. or Email to retrieve credentials.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // Step 1: Query the robust backend database to retrieve credentials
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inputIdentifier })
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess(`Database match found for Student ${data.userData.firstName} ${data.userData.lastName}! Your registered password is: "${data.password}".`);
      } else {
        // Fallback to Firebase configuration reset link if available
        const email = formData.email || (formData.rollNo.includes('@') ? formData.rollNo : `${formData.rollNo.toLowerCase()}@iitbhilai.ac.in`);
        if (auth) {
          await sendPasswordResetEmail(auth, email);
          setSuccess('Account not found in server database. A password reset link has been dispatched via Firebase Auth.');
        } else {
          const errData = await res.json();
          throw new Error(errData.error || "No student registered with this Roll No. in the portal database.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to retrieve or reset password: ' + (err.message || 'Check your entry'));
    } finally {
      setLoading(false);
    }
  };

  const getNiceErrorMessage = (err: any) => {
    if (!err) return 'Authentication failed';
    const message = err.message || String(err);
    const code = err.code || (message.includes('auth/') ? message.match(/\((auth\/[^)]+)\)/)?.[1] : null);

    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is disabled in Firebase Console. Please enable it under Auth > Sign-in Method.';
    }
    if (code === 'auth/email-already-in-use' || message.includes('email-already-in-use')) {
      return 'This email/Roll No. is already registered. If you forgot your password, use the "Forgot Password" link.';
    }
    if (
      code === 'auth/user-not-found' || 
      code === 'auth/wrong-password' || 
      code === 'auth/invalid-credential' || 
      message.includes('invalid-credential') || 
      message.includes('user-not-found')
    ) {
      return 'Invalid credentials. If you are a new student, please "Register" first. Otherwise, try "Forgot Password".';
    }
    if (code === 'auth/weak-password') {
      return 'Password is too weak. Please use at least 6 characters.';
    }
    if (message.includes('popup-closed-by-user')) {
      return 'Sign-in window was closed before completing. Please try again.';
    }
    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let localUser: any = null;
      let localUserData: any = null;
      let localErrorMsg = '';

      if (isLogin) {
        // Step 1: Login against users.json database on server hard drive
        const localRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: formData.rollNo,
            password: formData.password
          })
        });

        if (localRes.ok) {
          const authData = await localRes.json();
          localUser = authData.user;
          localUserData = authData.userData;
        } else {
          // If local login failed, check if Firebase can be tried instead
          const errData = await localRes.json();
          localErrorMsg = errData.error || "Login credentials do not match.";
          if (!auth) {
            throw new Error(localErrorMsg);
          }
        }
      } else {
        // Step 1: Register and write to users.json on server hard drive
        const localRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (localRes.ok) {
          const regData = await localRes.json();
          localUser = regData.user;
          localUserData = regData.userData;
          setSuccess('Account created and registered successfully!');
        } else {
          const errData = await localRes.json();
          throw new Error(errData.error || "Registration failed.");
        }
      }

      // Step 2: Try Firebase Auth if configured
      if (auth && db) {
        try {
          if (isLogin) {
            const email = formData.rollNo.includes('@') ? formData.rollNo : `${formData.rollNo.toLowerCase()}@iitbhilai.ac.in`;
            await signInWithEmailAndPassword(auth, email, formData.password);
          } else {
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;
            
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              rollNo: formData.rollNo,
              firstName: formData.firstName,
              lastName: formData.lastName,
              email: formData.email,
              mobile: formData.mobile,
              program: formData.program,
              branch: formData.branch,
              batch: formData.batch,
              designation: formData.designation,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (fbErr: any) {
          console.warn("Firebase Auth bypassed or offline. Proceeding with local configuration.", fbErr.message);
          // If we have local user session, we can proceed safely bypass Firebase error
          if (!localUser) {
            throw fbErr;
          }
        }
      }

      // Step 3: Set local storage session details to stay logged in across page refreshes
      if (localUser && localUserData) {
        localStorage.setItem('local-session-user', JSON.stringify(localUser));
        localStorage.setItem('local-session-userdata', JSON.stringify(localUserData));
      }

      onAuthSuccess(localUser, localUserData);
    } catch (err: any) {
      console.error(err);
      setError(getNiceErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!auth || !db) return;
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      
      const user = result.user;
      const rollNo = user.email ? user.email.split('@')[0] : `google_${user.uid}`;
      const [firstName, lastName] = (user.displayName || "Google Student").split(' ');
      
      const sessionUser = { uid: user.uid, email: user.email };
      const sessionUserData = {
        uid: user.uid,
        rollNo: rollNo,
        firstName: firstName || "Google",
        lastName: lastName || "Student",
        email: user.email || "",
        mobile: "",
        program: "B.Tech",
        branch: "CSE",
        batch: "2024",
        designation: "Normal Student",
        createdAt: new Date().toISOString()
      };

      let resolvedUser = sessionUser;
      let resolvedUserData = sessionUserData;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rollNo: rollNo,
            password: "google-auth-bypass-pass",
            firstName: sessionUserData.firstName,
            lastName: sessionUserData.lastName,
            email: sessionUserData.email,
            program: sessionUserData.program,
            branch: sessionUserData.branch,
            batch: sessionUserData.batch,
            designation: sessionUserData.designation,
            isGoogleAuth: true
          })
        });

        if (res.ok) {
          const regData = await res.json();
          resolvedUser = regData.user;
          resolvedUserData = regData.userData;
        }
      } catch (err) {
        console.warn("Local google registration bypass:", err);
      }

      localStorage.setItem('local-session-user', JSON.stringify(resolvedUser));
      localStorage.setItem('local-session-userdata', JSON.stringify(resolvedUserData));

      onAuthSuccess(resolvedUser, resolvedUserData);
    } catch (err: any) {
      console.error(err);
      setError(getNiceErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] p-4 font-sans relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/20 rounded-full blur-[120px] animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/10 rounded-full blur-[120px] animate-blob animation-delay-4000"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md z-10"
      >
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl mb-4 shadow-2xl">
            <IITBhilaiLogo size={52} variant="colored" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">IIT Bhilai <span className="text-indigo-400">Student Portal</span></h1>
          <p className="text-slate-400 mt-2 font-medium">Your personalized academic companion</p>
        </div>

        <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
          <div className="flex bg-black/20 p-1.5 rounded-2xl mb-8 border border-white/5">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${isLogin ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LogIn className="w-4 h-4" /> Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${!isLogin ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <UserPlus className="w-4 h-4" /> Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center">
                {success}
              </div>
            )}

            {isLogin ? (
              <>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black ml-1">Roll No. / ID</label>
                  <div className="relative">
                    <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      name="rollNo"
                      value={formData.rollNo}
                      onChange={handleChange}
                      placeholder="e.g. 12240123"
                      className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Password</label>
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[9px] uppercase tracking-widest text-indigo-400 font-black hover:text-indigo-300 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <input 
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full bg-black/20 border border-white/10 rounded-2xl py-3.5 px-5 text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                    required
                  />
                  <p className="text-[10px] text-slate-600 mt-1 italic pl-1 text-center">
                    New student? Click "Register" above to create your portal account.
                  </p>
                </div>
              </>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">First Name</label>
                    <input name="firstName" value={formData.firstName} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500/50" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Last Name</label>
                    <input name="lastName" value={formData.lastName} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500/50" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Roll No. / ID</label>
                  <input name="rollNo" value={formData.rollNo} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none" required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">IIT Bhilai Email ID</label>
                  <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="name@iitbhilai.ac.in" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Program</label>
                    <input name="program" value={formData.program} onChange={handleChange} placeholder="B.Tech" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none" required />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Branch</label>
                    <input name="branch" value={formData.branch} onChange={handleChange} placeholder="CSE" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Batch (Year of Entry)</label>
                  <input name="batch" value={formData.batch} onChange={handleChange} placeholder="e.g. 2022" className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none" required />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Designation</label>
                  <div className="relative">
                    <select 
                      name="designation" 
                      value={formData.designation} 
                      onChange={handleChange} 
                      className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none appearance-none cursor-pointer"
                      required
                    >
                      <option value="Normal Student" className="bg-[#1e293b] text-white">Normal Student</option>
                      <option value="CR" className="bg-[#1e293b] text-white">Class Representative (CR)</option>
                      <option value="DCR" className="bg-[#1e293b] text-white">Deputy Class Representative (DCR)</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-slate-500 font-black ml-1">Create Password</label>
                  <input name="password" type="password" value={formData.password} onChange={handleChange} className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none" required />
                </div>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-900 text-white font-black uppercase tracking-[0.2em] py-4 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center gap-3 mt-6"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  <span>{isLogin ? 'Sign In to Portal' : 'Create Account'}</span>
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
              <span className="bg-[#1e293b] px-4 text-slate-500">Or continue with</span>
            </div>
          </div>

          <button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-3"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span>Sign In with Institutional Google ID</span>
          </button>
        </div>

        <p className="text-center text-slate-600 text-[10px] font-bold uppercase tracking-widest mt-8">
          Authorized IIT Bhilai Students Only
        </p>
      </motion.div>
    </div>
  );
}
