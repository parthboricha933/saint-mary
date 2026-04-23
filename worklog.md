---
Task ID: 1
Agent: Main Agent
Task: Fix staff/teacher login 401 Unauthorized error

Work Log:
- Investigated the login flow: login.html → POST /api/auth/user-login → light-server.mjs → dashboard.html
- Checked database: 2 users exist (teacher: parthboricha933@gmail.com, principal: a@gmail.com), both approved, password hash = SHA-256 of "admin123"
- Identified that the 401 error occurs because the submitted password doesn't match the stored hash
- Fixed login.html: Added `setLoading(false)` at the start of both `.then()` and `.catch()` handlers to ensure loading spinner always stops
- Fixed login.html: Simplified error JSON parsing (removed nested try/catch that could cause confusion)
- Updated light-server.mjs login endpoint: Added detailed console logging for each failure case (user not found, password mismatch, pending, rejected)
- Updated light-server.mjs: Improved error messages for pending/rejected accounts
- Tested full flow via curl: wrong password returns 401 with "Invalid email or password", correct password returns 200 with user data
- Tested auth/me with user_token cookie - returns correct teacher user info
- Tested dashboard page load - returns 200
- Tested principal login - works correctly
- Daemonized the server using detached spawn to prevent it from dying when shell session ends

Stage Summary:
- The 401 error was caused by wrong password credentials (correct password: admin123)
- Login form error handling improved to always stop loading spinner
- Server login endpoint now has proper logging and clear error messages
- Server properly daemonized and running on port 3000 (Caddy proxy on port 81)
- Teacher credentials: parthboricha933@gmail.com / admin123
- Principal credentials: a@gmail.com / admin123
