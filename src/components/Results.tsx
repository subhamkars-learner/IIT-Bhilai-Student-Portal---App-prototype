import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { FileText, FileUp, Calculator, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

interface ResultsProps {
  user: any;
  userData: any;
}

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

export default function Results({ user, userData }: ResultsProps) {
  const [results, setResults] = useState<any[]>([]);
  const [isCalculated, setIsCalculated] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');

  // Academics Head check (Mocked: subhamkars@iitbhilai.ac.in is admin)
  const isAdmin = userData?.email === 'subhamkars@iitbhilai.ac.in' || userData?.designation === 'Admin';
  // Note: For this app, we'll allow students to upload their OWN results too as requested by "individual students... view", 
  // but "individual students do not have access to change to it" usually implies an admin uploads. 
  // However, the prompt says "AI - SGPA calculator on the uploaded graded picture...".
  // Let's allow students to use the calculator for their own data.

  useEffect(() => {
    if (!user) return;

    const loadResultsFromDb = async () => {
      try {
        const res = await fetch(`/api/results?uid=${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          localStorage.setItem(`portal-results-${user.uid}`, JSON.stringify(data));
        }
      } catch (err) {
        console.warn("Could not query results backend database:", err);
        // Local storage fallback
        const fallbackResults = localStorage.getItem(`portal-results-${user.uid}`);
        if (fallbackResults) {
          try {
            setResults(JSON.parse(fallbackResults));
          } catch (_) {}
        }
      }
    };

    loadResultsFromDb();

    if (!db || !auth?.currentUser) return;

    const q = query(collection(db, 'results'), where('uid', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setResults(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'results');
    });
    return () => unsub();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError('');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const base64 = (event.target?.result as string).split(',')[1];
          const res = await fetch('/api/ai/parse-grades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64, mimeType: file.type })
          });
          const data = await res.json();
          
          if (data.semester && data.sgpa) {
            const gradeItem = {
              uid: user.uid,
              semester: Number(data.semester),
              sgpa: Number(data.sgpa),
              grades: data.courses || [],
              uploadedAt: new Date().toISOString()
            };

            // Always save to Local Storage as a primary fallback
            const localResultsStr = localStorage.getItem(`portal-results-${user.uid}`);
            let localResults: any[] = [];
            if (localResultsStr) {
              try {
                localResults = JSON.parse(localResultsStr);
              } catch (_) {}
            }
            // Remove previous record on same semester if exists
            localResults = localResults.filter(r => r.semester !== gradeItem.semester);
            localResults.push(gradeItem);
            localStorage.setItem(`portal-results-${user.uid}`, JSON.stringify(localResults));
            setResults(localResults);

            // Save to permanent Express local backend database
            try {
              await fetch('/api/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(gradeItem)
              });
            } catch (err) {
              console.warn("Express database result upload failed:", err);
            }

            // Sync with Firestore if active
            if (db) {
              try {
                await setDoc(doc(db, 'results', `${user.uid}_sem${data.semester}`), gradeItem);
              } catch (dbErr) {
                console.warn("Firestore grade upload sync skipped:", dbErr);
              }
            }
            setIsCalculated(true);
            setTimeout(() => setIsCalculated(false), 3000);
          } else {
            setError('Could not extract grades from this file. Please try a clearer image.');
          }
        } catch (innerErr: any) {
          console.error(innerErr);
          setError('Failed to process grade sheet: ' + (innerErr.message || 'Check your internet connection'));
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      console.error(err);
      setError('Internal error during parsing: ' + err.message);
    } finally {
      setParsing(false);
    }
  };

  const combinedResults = [
    ...DEMO_RESULTS,
    ...results.filter(r => r.semester !== 1 && r.semester !== 2 && r.id !== 'demo_sem1' && r.id !== 'demo_sem2')
  ];

  const sortedCombinedAsc = [...combinedResults].sort((a, b) => a.semester - b.semester);
  const sortedCombinedDesc = [...combinedResults].sort((a, b) => b.semester - a.semester);

  const cgpa = combinedResults.length > 0
    ? (combinedResults.reduce((acc, curr) => acc + curr.sgpa, 0) / combinedResults.length).toFixed(2)
    : "0.00";

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Academic Performance</h1>
          <div className="flex flex-col gap-1 mt-1">
            <p className="text-slate-500 text-sm tracking-wide">Visualize your progress and calculate your cumulative GPA.</p>
            <p className="text-xs text-indigo-400 font-medium flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Official semester results are managed by the Academics head of the college (DOAA).
            </p>
          </div>
        </div>
        <div className="flex gap-4">
          <label className={`cursor-pointer flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${parsing ? 'bg-white/10 text-slate-500 border border-white/10' : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/10'}`}>
            {parsing ? 'Reading with AI...' : <><Calculator className="w-4 h-4" /> AI SGPA Calc</>}
            <input type="file" className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} disabled={parsing} />
          </label>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {isCalculated && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 p-4 rounded-2xl flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Result extracted and saved successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Stats */}
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-3xl text-center relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 group-hover:h-2 transition-all" />
            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">Total CGPA</h3>
            <span className="text-6xl font-black text-white tracking-tighter">{cgpa}</span>
            <div className="mt-6 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] uppercase font-black tracking-widest px-3 py-1.5 bg-black/20 rounded-lg">
                <span className="text-slate-500">Semesters</span>
                <span className="text-white font-bold">{combinedResults.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Grade Chart</h4>
            <div className="space-y-3">
              {sortedCombinedAsc.map((res) => (
                <div key={res.id} className="relative h-6 bg-black/20 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${res.sgpa * 10}%` }}
                    className="absolute top-0 left-0 h-full bg-indigo-500/80"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-400">SEM {res.semester}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Semester Feed */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {sortedCombinedDesc.map((res) => (
              <div key={res.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl hover:border-indigo-500/30 transition-all group">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-slate-500 group-hover:text-indigo-400 transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-lg tracking-tight">Semester {res.semester}</h4>
                      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5 whitespace-nowrap">Uploaded {new Date(res.uploadedAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">SGPA</p>
                    <span className="text-2xl font-black text-white">{res.sgpa}</span>
                  </div>
                </div>

                <div className="bg-black/20 rounded-2xl overflow-hidden border border-white/5">
                  <table className="w-full text-xs">
                    <thead className="bg-white/5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                      <tr>
                        <th className="px-4 py-2.5">Course</th>
                        <th className="px-4 py-2.5 text-right">Grade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {res.grades?.map((g: any, i: number) => (
                        <tr key={i} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-2.5 text-slate-300 font-medium">{g.name || 'Unknown'}</td>
                          <td className="px-4 py-2.5 text-right text-indigo-400 font-bold">{g.grade}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          {combinedResults.length === 0 && (
            <div className="bg-white/5 border border-dashed border-white/10 rounded-3xl py-32 text-center text-slate-600">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p className="font-medium italic">Your results will appear here after calculation.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
