---
name: course-system-redesign
description: Major redesign of AI_final-project from single-upload board to a course-based submission system
metadata:
  type: project
---

Redesign decided 2026-06-22. Turning the AI 專題排行榜 (single `ai_projects` board) into a course-based system.

**Flow:** Google login (gate, no anonymous) → fill student profile (學號/姓名/班級/年級) → enter course code to enroll → upload/edit project per course.

**Decisions locked by user (jim635241@gmail.com):**
1. **Admin = tiered, Google-account based.** Bootstrap first super-admin by entering password `minar7917` (verified server-side via a `config/admin` doc that Rules can read but clients cannot — so password never appears in F12). Stored in `admins/{uid}` with role super|admin.
   - **super**: course CRUD + add/remove normal admins directly (no approval).
   - **admin**: course CRUD only; cannot manage admin list.
   - **Becoming super requires approval**: only a normal admin may request promotion; an existing super approves; on approval the requester is ADDED as super (existing supers all kept — multiple supers coexist, NOT a demotion/transfer). Tracked in `adminRequests/{id}` {fromUid,fromEmail,type,status,resolvedBy,resolvedAt} for audit trail.
   - `admins` list is also directly editable in Firestore console as an ultimate override/rescue path (e.g. lost super account) — DB owner edits bypass Rules by design.
2. **File upload = Google Drive Picker/API (Option C).** Use scope `drive.file` (non-restricted, avoids Google's heavy verification). Upload to student's own Drive, store webViewLink.
3. **Keep** the 愛心投票/排行榜 feature, but scope it per-course.
4. **Use react-router-dom** (not yet installed). Stack: React 19, firebase ^12, lucide-react, Vite 8 beta. Hosted GitHub→Vercel, Firebase project `ai-final-project-a69b4`.

**Firestore model:** courses (name, code, ownerUid, fields{url,description,file}, deadline, allowLate), users (studentId,name,className,startAcademicYear,role), enrollments, projects (courseId,authorUid,title,description,url,fileUrl,isLate,likedBy).

**Grade auto-bump:** compute dynamically from `startAcademicYear` with 9/1 boundary — no cron. Editable.

Build is phased; Drive (C) blocked on user's GCP console setup. See [[course-system-gcp-setup]] if created.

**STATUS (2026-06-22): Phase 1-5 done on branch `feature/course-system`** (not yet committed/merged, not pushed). Build + lint pass; login page verified rendering in preview. New structure: src/firebase.js, src/lib/{grade,deadline}.js, src/context/{AuthProvider,ToastProvider}.jsx, src/components/{Layout,Modal,Spinner}.jsx, src/pages/{Login,SetupProfile,Home,Course,Admin}Page.jsx, App.jsx (router+gates), firestore.rules, vercel.json (SPA rewrite), SETUP.md. react-router-dom v7 added.
- BEFORE IT WORKS the user must (see SETUP.md): deploy firestore.rules, and manually create Firestore doc `config/admin` = { secret: "minar7917" }, then claim super at /admin.
- Login uses signInWithPopup (can be popup-blocked; possible future improvement: redirect fallback).
- Phase 6 (Drive Picker, scope drive.file) NOT started — needs user's GCP setup (OAuth client id + API key).
- File field currently accepts a Drive link (placeholder until Picker).
