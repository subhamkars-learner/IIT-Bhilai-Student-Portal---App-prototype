import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // File-based user persistence helpers to persist credentials on the hard drive (surviving restarts)
  const USERS_FILE = path.join(process.cwd(), "users.json");

  function loadUsers() {
    try {
      if (fs.existsSync(USERS_FILE)) {
        const data = fs.readFileSync(USERS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error reading users.json from disk:", error);
    }
    return {};
  }

  function saveUsers(users: any) {
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
    } catch (error) {
      console.error("Error writing users.json to disk:", error);
    }
  }

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Local auth register route
  app.post("/api/auth/register", (req, res) => {
    try {
      const { rollNo, email, password, firstName, lastName, program, branch, batch, designation, mobile, isGoogleAuth } = req.body;
      
      if (!rollNo || !password) {
        return res.status(400).json({ error: "Roll No. and password are required." });
      }

      const users = loadUsers();
      const idKey = rollNo.toLowerCase().trim();
      const emailKey = email ? email.toLowerCase().trim() : '';
      const existingUser = users[idKey] || (emailKey ? users[emailKey] : null);

      if (existingUser) {
        const isGoogleBypass = isGoogleAuth || password === "google-auth-bypass-pass" || existingUser.password === "google-auth-bypass-pass";
        const passwordMatches = existingUser.password === password;

        if (isGoogleBypass || passwordMatches) {
          return res.json({ 
            success: true, 
            user: { uid: existingUser.userData.uid, email: existingUser.userData.email }, 
            userData: existingUser.userData 
          });
        }
        return res.status(400).json({ error: "This Roll No. / ID is already registered." });
      }

      const userUid = `local_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      const newUser = {
        password, // stored plain-text as requested for prototype simulation
        userData: {
          uid: userUid,
          rollNo,
          firstName: firstName || "",
          lastName: lastName || "",
          email: email || `${rollNo.toLowerCase()}@iitbhilai.ac.in`,
          mobile: mobile || "",
          program: program || "",
          branch: branch || "",
          batch: batch || "",
          designation: designation || "Normal Student",
          createdAt: new Date().toISOString()
        }
      };

      users[idKey] = newUser;
      
      // Also index by email if provided
      if (email) {
        users[email.toLowerCase().trim()] = newUser;
      }

      saveUsers(users);

      res.json({ 
        success: true, 
        user: { uid: userUid, email: newUser.userData.email }, 
        userData: newUser.userData 
      });
    } catch (error: any) {
      console.error("Local registration error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Local auth login route
  app.post("/api/auth/login", (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Roll No./Email and password are required." });
      }

      const users = loadUsers();
      const idKey = username.toLowerCase().trim();
      const foundUser = users[idKey];

      if (foundUser && foundUser.password === password) {
        res.json({ 
          success: true, 
          user: { uid: foundUser.userData.uid, email: foundUser.userData.email }, 
          userData: foundUser.userData 
        });
      } else {
        res.status(401).json({ error: "Invalid credentials. Please make sure Roll No./Email and password match." });
      }
    } catch (error: any) {
      console.error("Local login error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Local auth update profile data
  app.post("/api/auth/update-profile", (req, res) => {
    try {
      const { uid, editedData } = req.body;
      if (!uid || !editedData) {
        return res.status(400).json({ error: "UID and update data are required." });
      }

      const users = loadUsers();
      let isUpdated = false;

      // Update across all occurrences (since we indexed by both rollNo and email)
      Object.keys(users).forEach(key => {
        if (users[key]?.userData?.uid === uid) {
          users[key].userData = {
            ...users[key].userData,
            ...editedData
          };
          isUpdated = true;
        }
      });

      if (isUpdated) {
        saveUsers(users);
        res.json({ success: true, userData: editedData });
      } else {
        res.status(404).json({ error: "Local student session profile not found." });
      }
    } catch (error: any) {
      console.error("Local profile update error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Local auth forgot-password route to retrieve or reset password from database
  app.post("/api/auth/forgot-password", (req, res) => {
    try {
      const { username } = req.body;
      if (!username) {
        return res.status(400).json({ error: "Roll No. or Email is required." });
      }

      const users = loadUsers();
      const idKey = username.toLowerCase().trim();
      const foundUser = users[idKey];

      if (foundUser) {
        res.json({ 
          success: true, 
          password: foundUser.password,
          userData: foundUser.userData 
        });
      } else {
        res.status(404).json({ error: "No student registered with this Roll No. / Email in the portal database." });
      }
    } catch (error: any) {
      console.error("Password recovery error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Consolidated Backend JSON database engines
  const GOALS_FILE = path.join(process.cwd(), "goals.json");
  const ACHIEVEMENTS_FILE = path.join(process.cwd(), "achievements.json");
  const RESULTS_FILE = path.join(process.cwd(), "results.json");
  const TIMETABLE_FILE = path.join(process.cwd(), "timetable.json");
  const ACTIVITIES_FILE = path.join(process.cwd(), "activities.json");
  const RESOURCES_FILE = path.join(process.cwd(), "resources.json");
  const OVERRIDES_FILE = path.join(process.cwd(), "overrides.json");

  function readJsonFile(filePath: string, defaultVal: any = []) {
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data);
      }
    } catch (e) {
      console.error(`Error reading database file ${filePath}:`, e);
    }
    return defaultVal;
  }

  function writeJsonFile(filePath: string, data: any) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error(`Error writing database file ${filePath}:`, e);
    }
  }

  // Goals Backend Database Endpoints
  app.get("/api/goals", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const goals = readJsonFile(GOALS_FILE, []);
    const userGoals = goals.filter((g: any) => g.uid === uid);
    res.json(userGoals);
  });

  app.post("/api/goals", (req, res) => {
    const { uid, title, completed } = req.body;
    if (!uid || !title) return res.status(400).json({ error: "uid and title are required" });
    
    const goals = readJsonFile(GOALS_FILE, []);
    const newGoal = {
      id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      uid,
      title,
      completed: !!completed,
      createdAt: new Date().toISOString()
    };
    goals.push(newGoal);
    writeJsonFile(GOALS_FILE, goals);
    res.json(newGoal);
  });

  app.put("/api/goals/:id", (req, res) => {
    const { id } = req.params;
    const { completed } = req.body;
    const goals = readJsonFile(GOALS_FILE, []);
    const goalIndex = goals.findIndex((g: any) => g.id === id);
    if (goalIndex === -1) return res.status(404).json({ error: "Goal not found in database." });
    
    goals[goalIndex].completed = completed;
    writeJsonFile(GOALS_FILE, goals);
    res.json(goals[goalIndex]);
  });

  app.delete("/api/goals/:id", (req, res) => {
    const { id } = req.params;
    let goals = readJsonFile(GOALS_FILE, []);
    const initialLen = goals.length;
    goals = goals.filter((g: any) => g.id !== id);
    if (goals.length === initialLen) return res.status(404).json({ error: "Goal not found in database." });
    
    writeJsonFile(GOALS_FILE, goals);
    res.json({ success: true });
  });

  // Achievements Backend Database Endpoints
  app.get("/api/achievements", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const achievements = readJsonFile(ACHIEVEMENTS_FILE, []);
    const userAchievements = achievements.filter((a: any) => a.uid === uid);
    res.json(userAchievements);
  });

  app.post("/api/achievements", (req, res) => {
    const { uid, title, date, description, type, fileLink } = req.body;
    if (!uid || !title) return res.status(400).json({ error: "uid and title are required" });
    
    const achievements = readJsonFile(ACHIEVEMENTS_FILE, []);
    const newAchievement = {
      id: `a_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      uid,
      title,
      date: date || new Date().toISOString().split('T')[0],
      description: description || '',
      type: type || 'Academic',
      fileLink: fileLink || '',
      createdAt: new Date().toISOString()
    };
    achievements.push(newAchievement);
    writeJsonFile(ACHIEVEMENTS_FILE, achievements);
    res.json(newAchievement);
  });

  app.delete("/api/achievements/:id", (req, res) => {
    const { id } = req.params;
    let achievements = readJsonFile(ACHIEVEMENTS_FILE, []);
    const initialLen = achievements.length;
    achievements = achievements.filter((a: any) => a.id !== id);
    if (achievements.length === initialLen) return res.status(404).json({ error: "Achievement not found in database." });
    
    writeJsonFile(ACHIEVEMENTS_FILE, achievements);
    res.json({ success: true });
  });

  // Results Backend Database Endpoints
  app.get("/api/results", (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "uid is required" });
    const results = readJsonFile(RESULTS_FILE, []);
    const userResults = results.filter((r: any) => r.uid === uid);
    res.json(userResults);
  });

  app.post("/api/results", (req, res) => {
    const { uid, semester, sgpa, grades } = req.body;
    if (!uid || !semester || sgpa === undefined) return res.status(400).json({ error: "uid, semester, and sgpa are required" });
    
    let results = readJsonFile(RESULTS_FILE, []);
    results = results.filter((r: any) => !(r.uid === uid && r.semester === Number(semester)));
    
    const newResult = {
      id: `r_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      uid,
      semester: Number(semester),
      sgpa: Number(sgpa),
      grades: grades || [],
      uploadedAt: new Date().toISOString()
    };
    results.push(newResult);
    writeJsonFile(RESULTS_FILE, results);
    res.json(newResult);
  });

  // Activities Backend Database Endpoints
  app.get("/api/activities", (req, res) => {
    const { branch } = req.query;
    if (!branch) return res.status(400).json({ error: "branch is required" });
    let activities = readJsonFile(ACTIVITIES_FILE, []);
    
    // Seed default activities if file is empty
    const branchActs = activities.filter((a: any) => a.branch === branch);
    if (branchActs.length === 0 && activities.length === 0) {
      const defaultActs = [
        { id: 'act1', title: 'End Semester Exams Registration', date: '2026-05-25', description: 'Ensure all college dues are cleared.', type: 'academic', branch },
        { id: 'act2', title: 'Summer Placement Drive', date: '2026-06-01', description: 'Internship registry link open for tech discipline.', type: 'academic', branch }
      ];
      activities = [...activities, ...defaultActs];
      writeJsonFile(ACTIVITIES_FILE, activities);
      return res.json(defaultActs);
    }
    
    res.json(branchActs);
  });

  app.post("/api/activities", (req, res) => {
    const { title, date, description, type, branch } = req.body;
    if (!title || !type || !branch) {
      return res.status(400).json({ error: "title, type, and branch are required" });
    }
    
    const activities = readJsonFile(ACTIVITIES_FILE, []);
    const newActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      date: date || new Date().toISOString().split('T')[0],
      description: description || '',
      type,
      branch,
      createdAt: new Date().toISOString()
    };
    activities.push(newActivity);
    writeJsonFile(ACTIVITIES_FILE, activities);
    res.json(newActivity);
  });

  app.delete("/api/activities/:id", (req, res) => {
    const { id } = req.params;
    let activities = readJsonFile(ACTIVITIES_FILE, []);
    const initialLen = activities.length;
    activities = activities.filter((a: any) => a.id !== id);
    if (activities.length === initialLen) return res.status(404).json({ error: "Activity not found" });
    
    writeJsonFile(ACTIVITIES_FILE, activities);
    res.json({ success: true });
  });

  // Resources Backend Database Endpoints
  app.get("/api/resources", (req, res) => {
    const { branch } = req.query;
    if (!branch) return res.status(400).json({ error: "branch is required" });
    let resources = readJsonFile(RESOURCES_FILE, []);
    
    // Seed default resources if file is empty
    const branchRes = resources.filter((r: any) => r.branch === branch);
    if (branchRes.length === 0 && resources.length === 0) {
      const defaultRes = [
        { id: 'res1', title: 'IIT Bhilai Semester 1 PYQs', link: 'https://github.com', type: 'PDF', branch },
        { id: 'res2', title: 'Data Structures Lecture Notes', link: 'https://github.com', type: 'PDF', branch }
      ];
      resources = [...resources, ...defaultRes];
      writeJsonFile(RESOURCES_FILE, resources);
      return res.json(defaultRes);
    }
    
    res.json(branchRes);
  });

  app.post("/api/resources", (req, res) => {
    const { title, link, type, branch, createdBy } = req.body;
    if (!title || !link || !branch) {
      return res.status(400).json({ error: "title, link, and branch are required" });
    }
    
    const resources = readJsonFile(RESOURCES_FILE, []);
    const newResource = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      link,
      type: type || 'PDF',
      branch,
      createdBy: createdBy || 'unknown',
      createdAt: new Date().toISOString()
    };
    resources.push(newResource);
    writeJsonFile(RESOURCES_FILE, resources);
    res.json(newResource);
  });

  app.delete("/api/resources/:id", (req, res) => {
    const { id } = req.params;
    let resources = readJsonFile(RESOURCES_FILE, []);
    const initialLen = resources.length;
    resources = resources.filter((r: any) => r.id !== id);
    if (resources.length === initialLen) return res.status(404).json({ error: "Resource not found" });
    
    writeJsonFile(RESOURCES_FILE, resources);
    res.json({ success: true });
  });

  // Overrides for sample/permanent items (CR/DCR-managed deletion and editing)
  app.get("/api/overrides", (req, res) => {
    const data = readJsonFile(OVERRIDES_FILE, { deletedIds: [], editedItems: {} });
    res.json(data);
  });

  app.post("/api/overrides", (req, res) => {
    const { deletedIds, editedItems } = req.body;
    const current = readJsonFile(OVERRIDES_FILE, { deletedIds: [], editedItems: {} });
    if (deletedIds !== undefined) current.deletedIds = deletedIds;
    if (editedItems !== undefined) current.editedItems = editedItems;
    writeJsonFile(OVERRIDES_FILE, current);
    res.json(current);
  });

  // Timetable Backend Database Endpoints
  app.get("/api/timetable", (req, res) => {
    const { branch, batch } = req.query;
    if (!branch || !batch) return res.status(400).json({ error: "branch and batch are required" });
    const list = readJsonFile(TIMETABLE_FILE, []);
    const found = list.find((t: any) => t.branch === branch && t.batch === batch);
    res.json(found || { branch, batch, schedule: {} });
  });

  app.post("/api/timetable", (req, res) => {
    const { branch, batch, schedule } = req.body;
    if (!branch || !batch || !schedule) return res.status(400).json({ error: "branch, batch, and schedule are required" });
    
    let list = readJsonFile(TIMETABLE_FILE, []);
    list = list.filter((t: any) => !(t.branch === branch && t.batch === batch));
    
    const record = { branch, batch, schedule, updatedAt: new Date().toISOString() };
    list.push(record);
    writeJsonFile(TIMETABLE_FILE, list);
    res.json(record);
  });

  // AI Resume Generation
  app.post("/api/ai/generate-resume", async (req, res) => {
    try {
      const { profile, achievements, results } = req.body;
      
      // Default fallback profile structures if not provided
      const studentProfile = profile || {};
      const studentAchievements = Array.isArray(achievements) ? achievements : [];
      const studentResults = Array.isArray(results) ? results : [];

      const fullName = `${studentProfile.firstName || 'Student'} ${studentProfile.lastName || 'Portal User'}`.trim();
      const rollNo = studentProfile.rollNo || 'N/A';
      const email = studentProfile.email || 'N/A';
      const mobile = studentProfile.mobile || 'N/A';
      const program = studentProfile.program || 'B.Tech';
      const branch = studentProfile.branch || 'Computer Science and Engineering';
      const batch = studentProfile.batch || '2022-2026';

      // Parse courses and high grades
      const allCourses: any[] = [];
      studentResults.forEach((sem: any) => {
        if (sem && Array.isArray(sem.grades)) {
          sem.grades.forEach((g: any) => {
            allCourses.push({
              name: g.name,
              grade: g.grade,
              semester: sem.semester
            });
          });
        }
      });

      // Sort by semester then name
      allCourses.sort((a, b) => a.semester - b.semester);

      const highPerformingCourses = allCourses
        .filter(c => ['A', 'A-', 'O', 'S', 'A+'].includes(c.grade))
        .map(c => `${c.name} (${c.grade})`);

      const semestersSummary = studentResults
        .filter((r: any) => r && r.semester)
        .map((r: any) => `Semester ${r.semester}: SGPA ${Number(r.sgpa || 0).toFixed(2)}`)
        .join("\n- ");

      // Compute CGPA
      let cgpaText = "N/A";
      if (studentResults.length > 0) {
        const totalSgpa = studentResults.reduce((sum: number, r: any) => sum + Number(r.sgpa || 0), 0);
        const avg = totalSgpa / studentResults.length;
        cgpaText = avg.toFixed(2);
      }

      const prompt = `
        You are an expert tech recruiter and technical career coach. Generate a masterfully crafted, professional, and industry-ready resume in Markdown format for the following student:

        ---
        STUDENT METADATA:
        - Full Name: ${fullName}
        - Roll Number: ${rollNo}
        - Email Address: ${email}
        - Mobile Contact: ${mobile}
        - Institute: Indian Institute of Technology Bhilai (IIT Bhilai) (Location: Durg, Raipur)
        - Academic Program: ${program}
        - Branch/Specialization: ${branch}
        - Batch Year: Graduation/Class of ${batch}
        - Computed Approximate CGPA: ${cgpaText} / 10.00
        
        ACADEMIC RECORDS BY SEMESTER:
        - ${semestersSummary || 'None recorded yet'}

        EXCELLENT GRADES ACHIEVED (A/A- status):
        ${highPerformingCourses.length > 0 ? '- ' + highPerformingCourses.join('\n- ') : 'No specific highlights (emphasize general core engineering disciplines)'}

        PROFESSIONAL ACHIEVEMENTS & EXTRA-CURRICULARS:
        ${JSON.stringify(studentAchievements)}
        ---

        Please adhere strictly to the following resume composition requirements:
        1. STRUCTURE: Include clear headings with proper horizontal dividers:
           - Contact Details (Centered at top)
           - Professional/Academic Summary (A strong 3-4 sentence elevator pitch highlighting their research/tech focus based on specialization)
           - Education (Highlight IIT Bhilai degree, branch, batch, approximate CGPA, and list a neat Semester SGPA table. Ensure the location of IIT Bhilai is explicitly written as "Durg, Raipur" and NOT "GEC Raipur" or "Government Engineering College Raipur")
           - Key Core Courses & Expert Skills (Classified into programming languages, frameworks, developer tools, database engines, and theoretical subjects)
           - Achievements & Technical Projects (Make each achievement from the metadata stand out with 2 strong, action-oriented bullet points starting with powerful verbs like "Led", "Architected", "Engineered", "Optimized", "Spearheaded")
           - Co-curricular & Leadership Experience

        2. TONAL EXCELLENCE: Use an active, authoritative, yet elegant tone. Eliminate passive wording. Translate simple achievement descriptions into impressive corporate/academic bullet points.
        3. FORMAT: Output valid, neat, and highly readable Markdown. Use bullet points effectively. Ensure negative space with clean spacing.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash", // Use a model that doesn't require a paid key
        contents: prompt,
      });

      res.json({ resume: response.text });
    } catch (error: any) {
      console.error("Resume Generation Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Grade Parsing (SGPA Calculator)
  app.post("/api/ai/parse-grades", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      
      const prompt = `
        Analyze this image of a grade sheet/result.
        Extract the following information in JSON format:
        - semester (number)
        - sgpa (number)
        - courses (array of objects: { name, grade, credits })
        
        If you cannot find some info, leave it as null. Return ONLY the JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          { inlineData: { data: image, mimeType } },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      console.error("Grade Parsing Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // AI Timetable Normalization (JSON)
  app.post("/api/ai/normalize-timetable", async (req, res) => {
    try {
      const { jsonText } = req.body;
      
      const prompt = `
        You are a timetable parser. I will provide a JSON-like string which might have inconsistent formatting, non-standard day names, or minor syntax issues.
        
        Input: ${jsonText}
        
        Normalize this into a STRICT JSON format following this schema:
        {
          "Monday": [{ "time": "9:00 - 10:00", "subject": "Math", "room": "L1" }, ...],
          "Tuesday": [...],
          "Wednesday": [...],
          "Thursday": [...],
          "Friday": [...],
          "Saturday": [...],
          "Sunday": [...]
        }
        
        Rules:
        1. Only include days that have classes.
        2. Format time ranges as "HH:MM - HH:MM" if possible.
        3. Ensure day names are capitalize Title Case (e.g., "Monday").
        4. Fix any broken JSON syntax in the input.
        5. Return ONLY the valid JSON object.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      console.error("Timetable Normalization Error:", error);
      if (error.message?.includes("quota") || error.status === 429 || error.code === 429) {
        return res.status(429).json({ 
          error: "Gemini API Quota Exceeded. Please try again in a few minutes.",
          code: "QUOTA_EXCEEDED"
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Timetable PDF Parsing (Legacy/Fallback)
  app.post("/api/ai/parse-timetable", async (req, res) => {
    try {
      const { pdfData, mimeType } = req.body;
      
      const prompt = `
        Analyze this weekly timetable PDF.
        Extract the daily schedule for each day of the week (Monday to Friday).
        Format the output as a JSON object:
        {
          "Monday": [{ "time": "9:00 - 10:00", "subject": "Math", "room": "L1" }, ...],
          "Tuesday": [...],
          ...
        }
        Return ONLY the JSON.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [
          { inlineData: { data: pdfData, mimeType } },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(response.text || "{}");
      res.json(parsed);
    } catch (error: any) {
      console.error("Timetable Parsing Error:", error);
      if (error.message?.includes("quota") || error.status === 429 || error.code === 429) {
        return res.status(429).json({ 
          error: "Gemini API Quota Exceeded. Please try again in a few minutes.",
          code: "QUOTA_EXCEEDED"
        });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Motivational Quote
  app.get("/api/ai/quote", async (req, res) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: "Generate a short motivational quote for a college student about balancing academics and life. Return only the quote and author.",
      });
      res.json({ quote: response.text });
    } catch (error: any) {
      res.json({ quote: "Success is not final, failure is not fatal: it is the courage to continue that counts. - Winston Churchill" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
