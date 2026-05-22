# Security Specification - IITB Connect

## Data Invariants
1. A user's profile (`users/{userId}`) can only be read and written by that specific user.
2. Timetables (`timetables/{ttId}`) can be read by any student in that branch/batch, but only valid CR/DCRs for that branch can update it.
3. Activities (`activities/{actId}`) can be viewed by students in the same branch. CR/DCRs can create/update/delete.
4. Resources (`resources/{resId}`) can be viewed by branch students. CR/DCRs can manage.
5. Results (`results/{resId}`) contain PII (grades). They must be restricted to the owner (`resource.data.uid == request.auth.uid`) or Admins.
6. Achievements and Goals are private to the student who created them.

## The Dirty Dozen (Attacks to Block)
1. User A tries to read User B's profile.
2. User A tries to update User B's roll number.
3. A normal student tries to delete a Resource.
4. A student from Branch X tries to read Resources from Branch Y.
5. A normal student tries to upload/update a Timetable for the whole branch.
6. User A tries to read User B's Semester Results.
7. User A tries to add a Goal to User B's list.
8. User A tries to change the SGPA in another user's result document.
9. Injection of a massive string (1MB) into a Goal title.
10. Spoofing `uid` in an Achievement document during creation.
11. Modifying the `designation` from "Student" to "Admin" in one's own profile.
12. Deleting a Timetable by a normal student.

## Validation Helpers
- `isValidId(id)`
- `isValidUser(data)`
- `isValidGoal(data)`
...
