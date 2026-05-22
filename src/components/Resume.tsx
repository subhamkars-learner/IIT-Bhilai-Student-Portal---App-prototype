import { useState, useEffect, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { FileEdit, Sparkles, Download, Copy, RefreshCw, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import Markdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface ResumeProps {
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

export default function Resume({ user, userData }: ResumeProps) {
  const [resume, setResume] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  const generateResume = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const targetUid = user.uid;
      let achievements: any[] = [];
      let dbResults: any[] = [];

      // 1. Try Firestore snapshot/query only if Firestore db and user credentials exist
      if (db && auth?.currentUser) {
        try {
          const [achievementsSnap, resultsSnap] = await Promise.all([
            getDocs(query(collection(db, 'achievements'), where('uid', '==', targetUid), orderBy('date', 'desc'))),
            getDocs(query(collection(db, 'results'), where('uid', '==', targetUid), orderBy('semester', 'asc')))
          ]);
          achievements = achievementsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          dbResults = resultsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (fsErr) {
          console.warn("Could not query Firestore achievements/results for resume (using database fallback next):", fsErr);
        }
      }

      // 2. Fall back to robust express endpoints if data was not fetched/failover is needed
      if (achievements.length === 0) {
        try {
          const res = await fetch(`/api/achievements?uid=${targetUid}`);
          if (res.ok) {
            achievements = await res.json();
          }
        } catch (err) {
          console.warn("Could not fetch achievements from REST database for resume:", err);
          const fallback = localStorage.getItem(`portal-achievements-${targetUid}`);
          if (fallback) {
            try { achievements = JSON.parse(fallback); } catch (_) {}
          }
        }
      }

      if (dbResults.length === 0) {
        try {
          const res = await fetch(`/api/results?uid=${targetUid}`);
          if (res.ok) {
            dbResults = await res.json();
          }
        } catch (err) {
          console.warn("Could not fetch results from REST database for resume:", err);
          const fallbackResults = localStorage.getItem(`portal-results-${targetUid}`);
          if (fallbackResults) {
            try { dbResults = JSON.parse(fallbackResults); } catch (_) {}
          }
        }
      }

      const combinedResults = [
        ...DEMO_RESULTS,
        ...dbResults.filter((r: any) => r.semester !== 1 && r.semester !== 2 && r.id !== 'demo_sem1' && r.id !== 'demo_sem2')
      ].sort((a: any, b: any) => a.semester - b.semester);

      // 3. Call AI API
      const res = await fetch('/api/ai/generate-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: userData,
          achievements,
          results: combinedResults
        })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "AI Resume building endpoint failed.");
      }

      const data = await res.json();
      setResume(data.resume);
    } catch (err: any) {
      console.error(err);
      alert("Failed to build resume: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(resume);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPdf = async () => {
    if (!resume) return;
    setDownloading(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      const marginX = 18;
      const maxWidth = 210 - (2 * marginX); // 174 mm
      let currentY = 15;
      const pageHeight = 297;
      const bottomMargin = 15;

      // Helper to handle page breaks
      const checkPageBreak = (neededHeight: number) => {
        if (currentY + neededHeight > pageHeight - bottomMargin) {
          doc.addPage();
          currentY = 15; // Reset to top margin
          return true;
        }
        return false;
      };

      // Helper to render wrapped text with **bold** support
      const renderFormattedBlock = (
        textStr: string,
        startX: number,
        isBullet: boolean = false
      ) => {
        const fontSize = 9.5;
        const lineHeight = 4.8;
        
        if (isBullet) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(fontSize);
          doc.setTextColor(67, 56, 202); // indigo-700
          doc.text("•", startX - 3.5, currentY);
        }

        // Tokenize into words and bold phrases
        const tokens: { text: string; isBold: boolean; hasSpace: boolean }[] = [];
        const wordRegex = /(\*\*.*?\*\*|\s+|[^\s\*]+)/g;
        const matches: string[] = textStr.match(wordRegex) || [];

        matches.forEach((match: string) => {
          if (match.startsWith("**") && match.endsWith("**")) {
            tokens.push({
              text: match.substring(2, match.length - 2),
              isBold: true,
              hasSpace: false
            });
          } else if (/^\s+$/.test(match)) {
            if (tokens.length > 0) {
              tokens[tokens.length - 1].hasSpace = true;
            }
          } else {
            tokens.push({
              text: match,
              isBold: false,
              hasSpace: false
            });
          }
        });

        let currentX = startX;
        let lineTokens: typeof tokens = [];

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          doc.setFont("helvetica", token.isBold ? "bold" : "normal");
          doc.setFontSize(fontSize);
          const wordWidth = doc.getTextWidth(token.text);
          const spaceWidth = token.hasSpace ? doc.getTextWidth(" ") : 0;
          const totalWidth = wordWidth + spaceWidth;

          if (currentX + wordWidth > marginX + maxWidth && lineTokens.length > 0) {
            checkPageBreak(lineHeight);
            
            let drawX = startX;
            lineTokens.forEach(t => {
              doc.setFont("helvetica", t.isBold ? "bold" : "normal");
              doc.setFontSize(fontSize);
              doc.setTextColor(51, 65, 85); // Slate 600
              doc.text(t.text, drawX, currentY);
              drawX += doc.getTextWidth(t.text);
              if (t.hasSpace) {
                drawX += doc.getTextWidth(" ");
              }
            });

            currentY += lineHeight;
            currentX = startX;
            lineTokens = [];
          }

          lineTokens.push(token);
          currentX += totalWidth;
        }

        if (lineTokens.length > 0) {
          checkPageBreak(lineHeight);
          let drawX = startX;
          lineTokens.forEach(t => {
            doc.setFont("helvetica", t.isBold ? "bold" : "normal");
            doc.setFontSize(fontSize);
            doc.setTextColor(51, 65, 85); // Slate 600
            doc.text(t.text, drawX, currentY);
            drawX += doc.getTextWidth(t.text);
            if (t.hasSpace) {
              drawX += doc.getTextWidth(" ");
            }
          });
          currentY += lineHeight;
        }
      };

      const rawLines = resume.split('\n');

      for (let i = 0; i < rawLines.length; i++) {
        let line = rawLines[i].trim();
        if (!line) {
          currentY += 2;
          continue;
        }

        // H1 header (Centered Name)
        if (line.startsWith('# ')) {
          const titleText = line.substring(2).trim();
          checkPageBreak(12);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(18);
          doc.setTextColor(15, 23, 42); // slate-900
          
          const textWidth = doc.getTextWidth(titleText);
          doc.text(titleText, (210 - textWidth) / 2, currentY);
          currentY += 8;
          continue;
        }

        // H2 Header (Underlined Section Title)
        if (line.startsWith('## ')) {
          const sectionText = line.substring(3).trim();
          checkPageBreak(18);
          currentY += 4;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(30, 58, 138); // Blue - 1e3a8a
          doc.text(sectionText.toUpperCase(), marginX, currentY);

          currentY += 1.5;
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.setLineWidth(0.4);
          doc.line(marginX, currentY, marginX + maxWidth, currentY);
          
          currentY += 5;
          continue;
        }

        // H3 Header (Subsection or Job Title)
        if (line.startsWith('### ')) {
          const subText = line.substring(4).trim();
          checkPageBreak(8);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          doc.setTextColor(15, 23, 42); // slate-900
          doc.text(subText, marginX, currentY);
          currentY += 4.5;
          continue;
        }

        // Horizontal line separator
        if (line === '---' || line === '***') {
          checkPageBreak(5);
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.4);
          doc.line(marginX, currentY, marginX + maxWidth, currentY);
          currentY += 3;
          continue;
        }

        // Bullet Point
        if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• ')) {
          const contentStr = line.substring(2).trim();
          renderFormattedBlock(contentStr, marginX + 4.5, true);
          continue;
        }

        // Center aligned metadata or pipe separated lines
        if (line.startsWith('**') || line.includes('|')) {
          checkPageBreak(6);
          const strippedLine = line.replace(/\*\*/g, '').trim();
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(71, 85, 105); // slate-500
          
          const textWidth = doc.getTextWidth(strippedLine);
          doc.text(strippedLine, (210 - textWidth) / 2, currentY);
          currentY += 4.5;
          continue;
        }

        // Normal prose paragraph
        renderFormattedBlock(line, marginX, false);
      }

      const safeFirstName = userData?.firstName ? userData.firstName.replace(/[^a-zA-Z0-9]/g, '_') : 'IIT_Bhilai';
      const safeLastName = userData?.lastName ? userData.lastName.replace(/[^a-zA-Z0-9]/g, '_') : 'Student';
      doc.save(`${safeFirstName}_${safeLastName}_Resume.pdf`);
    } catch (error: any) {
      console.error("Programmatic Vector PDF download error:", error);
      alert("Error generating PDF: " + (error.message || String(error)));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AI Resume Builder</h1>
          <p className="text-slate-500 mt-1 text-sm tracking-wide">Let Gemini transform your academic profile into an industry-ready resume.</p>
        </div>
        {!resume ? (
          <button 
            onClick={generateResume}
            disabled={loading}
            className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50 group"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Build My Resume
              </>
            )}
          </button>
        ) : (
          <div className="flex gap-3">
            <button 
              onClick={downloadPdf}
              disabled={downloading}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-600/15 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download PDF
                </>
              )}
            </button>
            <button 
              onClick={copyToClipboard}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all shadow-lg"
            >
              {copied ? 'Copied!' : <><Copy className="w-4 h-4" /> Copy Markdown</>}
            </button>
            <button 
              onClick={generateResume}
              disabled={loading}
              className="px-4 py-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-all shadow-lg"
            >
              {loading ? 'Thinking...' : 'Regenerate'}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white/5 backdrop-blur-md border border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col">
        {!resume && !loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-10 rounded-full animate-pulse" />
              <FileEdit className="w-20 h-20 text-slate-800 relative z-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-400 tracking-tight">Ready to boost your career?</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-sm italic">
              We'll aggregate your CGPA, semester results, and achievements to generate a professional resume using Google Gemini Pro.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden mb-6">
              <motion.div 
                animate={{ x: [-64, 64] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="w-1/2 h-full bg-indigo-500"
              />
            </div>
            <h3 className="text-lg font-bold text-white animate-pulse tracking-tight">Syncing achievements...</h3>
            <p className="text-slate-500 text-[10px] mt-2 uppercase tracking-[0.2em] font-black">Building your narrative with Gemini Pro</p>
          </div>
        )}

        {resume && !loading && (
          <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-black/20">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="prose prose-invert max-w-none prose-slate"
            >
              <div className="markdown-body">
                <Markdown>{resume}</Markdown>
              </div>
            </motion.div>
          </div>
        )}

        <div className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-md flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 text-slate-600">
            <Layers className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Markdown Export Ready</span>
          </div>
          <div className="h-4 w-px bg-white/5" />
          <p className="text-[10px] font-bold text-slate-600 italic">Resume content is AI-generated. Review before submission.</p>
        </div>
      </div>

      {/* Hidden container styled as standard white A4 page layout for high-quality light PDF export */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '794px', pointerEvents: 'none' }}>
        <div 
          ref={pdfTemplateRef}
          className="pdf-markdown-body bg-white p-16 w-[794px] text-slate-800"
        >
          {resume && <Markdown>{resume}</Markdown>}
        </div>
      </div>
    </div>
  );
}
