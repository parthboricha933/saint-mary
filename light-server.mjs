import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PID_FILE = path.join(__dirname, 'server.pid');

const NO_CACHE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
  'Surrogate-Control': 'no-store'
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

let prisma = null;
async function getPrisma() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  return prisma;
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', ...NO_CACHE });
      res.end('<h1>404 - File Not Found</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType, ...NO_CACHE });
    res.end(data);
  });
}

function serveHtml(res, filePath) {
  serveFile(res, filePath);
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...NO_CACHE });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach(pair => {
    const [key, ...val] = pair.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function checkAdminAuth(req) {
  const cookies = parseCookies(req);
  const token = cookies.admin_token;
  if (!token) return false;
  const authConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'auth-config.json'), 'utf-8'));
  const { adminEmail, adminTokenHash } = authConfig;
  const hash = crypto.createHash('sha256').update(adminEmail + ':' + token).digest('hex');
  return hash === adminTokenHash;
}

async function checkUserAuth(req) {
  const cookies = parseCookies(req);
  const userId = cookies.user_token;
  if (!userId) return null;
  const p = await getPrisma();
  const user = await p.user.findUnique({ where: { id: userId } });
  return user;
}

// Check if user is admin OR approved principal
async function checkAdminOrPrincipal(req) {
  const isAdmin = await checkAdminAuth(req);
  if (isAdmin) return { role: 'admin' };
  const user = await checkUserAuth(req);
  if (user && user.role === 'principal' && user.status === 'approved') return user;
  return null;
}

// Check if user is admin, principal, or receptionist — for contact/inquiry access
async function checkOfficeAuth(req) {
  const isAdmin = await checkAdminAuth(req);
  if (isAdmin) return { role: 'admin' };
  const user = await checkUserAuth(req);
  if (user && user.role === 'principal' && user.status === 'approved') return user;
  if (user && user.role === 'receptionist' && user.status === 'approved') return user;
  return null;
}

const pageMap = {
  '/': 'index.html',
  '/login': 'login.html',
  '/admin': 'admin.html',
  '/dashboard': 'dashboard.html',
  '/office': 'office.html',
};

function setPageCookies(res, name, value) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

// ============ API ROUTES ============
const apiRoutes = {};

// --- AUTH ---
apiRoutes['POST /api/auth/admin-login'] = async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req));
    const { email, token } = body;
    if (!email || !token) return json(res, { error: 'Missing credentials' }, 400);
    const authConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'auth-config.json'), 'utf-8'));
    const hash = crypto.createHash('sha256').update(email + ':' + token).digest('hex');
    if (hash !== authConfig.adminTokenHash) return json(res, { error: 'Invalid admin credentials' }, 401);
    res.setHeader('Set-Cookie', setPageCookies(res, 'admin_token', token));
    json(res, { success: true, email });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/auth/user-login'] = async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req));
    const { email, password } = body;
    if (!email || !password) return json(res, { error: 'Missing credentials' }, 400);
    const p = await getPrisma();
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await p.user.findUnique({ where: { email } });
    if (!user) {
      console.log('[AUTH] Login failed - user not found:', email);
      return json(res, { error: 'Invalid email or password' }, 401);
    }
    if (user.password !== hash) {
      console.log('[AUTH] Login failed - password mismatch for:', email);
      return json(res, { error: 'Invalid email or password' }, 401);
    }
    if (user.status === 'pending') {
      console.log('[AUTH] Login blocked - account pending:', email);
      return json(res, { error: 'Your account is pending approval by the principal. Please contact the school admin.' }, 403);
    }
    if (user.status === 'rejected') {
      console.log('[AUTH] Login blocked - account rejected:', email);
      return json(res, { error: 'Your account has been rejected. Please contact the school admin.' }, 403);
    }
    console.log('[AUTH] Login success:', email, 'role:', user.role);
    res.setHeader('Set-Cookie', setPageCookies(res, 'user_token', user.id));
    json(res, { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, subject: user.subject, status: user.status } });
  } catch (e) {
    console.error('[AUTH] Login server error:', e);
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/auth/me'] = async (req, res) => {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (isAdmin) {
      const authConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'auth-config.json'), 'utf-8'));
      return json(res, { success: true, role: 'admin', user: { id: 'admin', name: 'Administrator', email: authConfig.adminEmail, role: 'admin' } });
    }
    const user = await checkUserAuth(req);
    if (user) return json(res, { success: true, role: user.role, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, subject: user.subject, status: user.status } });
    return json(res, { error: 'Not authenticated' }, 401);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/auth/logout'] = async (req, res) => {
  res.setHeader('Set-Cookie', [
    setPageCookies(res, 'admin_token', ''),
    setPageCookies(res, 'user_token', ''),
  ]);
  json(res, { success: true });
};

apiRoutes['POST /api/auth/register'] = async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req));
    const { name, email, password, role, phone, subject } = body;
    if (!name || !email || !password || !role) return json(res, { error: 'Missing required fields' }, 400);
    if (!['teacher', 'principal', 'receptionist'].includes(role)) return json(res, { error: 'Invalid role' }, 400);
    const p = await getPrisma();
    const existing = await p.user.findUnique({ where: { email } });
    if (existing) return json(res, { error: 'Email already exists' }, 409);
    if (role === 'principal') {
      const approvedPrincipal = await p.user.findFirst({ where: { role: 'principal', status: 'approved' } });
      if (approvedPrincipal) return json(res, { error: 'A principal already exists' }, 403);
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await p.user.create({ data: { name, email, password: hash, role, phone, subject, status: 'pending' } });
    json(res, { success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- USERS ---
apiRoutes['GET /api/users'] = async (req, res) => {
  try {
    const isAdmin = await checkAdminAuth(req);
    const user = await checkUserAuth(req);
    if (!isAdmin && (!user || (user.role !== 'principal' || user.status !== 'approved'))) {
      return json(res, { error: 'Unauthorized' }, 401);
    }
    const p = await getPrisma();
    const users = await p.user.findMany({ orderBy: { createdAt: 'desc' } });
    json(res, { success: true, users });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/users/{id}'] = async (req, res, params) => {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    const user = await p.user.findUnique({ where: { id: params.id } });
    if (!user) return json(res, { error: 'User not found' }, 404);
    json(res, { success: true, user });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/users/{id}'] = async (req, res, params) => {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const user = await p.user.update({ where: { id: params.id }, data: body });
    json(res, { success: true, user });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/users/{id}'] = async (req, res, params) => {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.user.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- EVENTS ---
apiRoutes['GET /api/events'] = async (req, res) => {
  try {
    const p = await getPrisma();
    const events = await p.event.findMany({ where: { isPublished: true }, orderBy: { date: 'desc' } });
    json(res, { success: true, events });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/events'] = async (req, res) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const event = await p.event.create({ data: body });
    json(res, { success: true, event }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/events/{id}'] = async (req, res, params) => {
  try {
    const p = await getPrisma();
    const event = await p.event.findUnique({ where: { id: params.id } });
    if (!event) return json(res, { error: 'Event not found' }, 404);
    json(res, { success: true, event });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/events/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const event = await p.event.update({ where: { id: params.id }, data: body });
    json(res, { success: true, event });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/events/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.event.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- NOTIFICATIONS ---
apiRoutes['GET /api/notifications'] = async (req, res) => {
  try {
    const p = await getPrisma();
    const notifications = await p.notification.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' } });
    json(res, { success: true, notifications });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/notifications'] = async (req, res) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const notification = await p.notification.create({ data: body });
    json(res, { success: true, notification }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/notifications/{id}'] = async (req, res, params) => {
  try {
    const p = await getPrisma();
    const notification = await p.notification.findUnique({ where: { id: params.id } });
    if (!notification) return json(res, { error: 'Notification not found' }, 404);
    json(res, { success: true, notification });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/notifications/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const notification = await p.notification.update({ where: { id: params.id }, data: body });
    json(res, { success: true, notification });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/notifications/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.notification.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- SYLLABUS ---
apiRoutes['GET /api/syllabus'] = async (req, res) => {
  try {
    const p = await getPrisma();
    const syllabus = await p.syllabus.findMany({ where: { isPublished: true }, orderBy: [{ className: 'asc' }, { subject: 'asc' }] });
    json(res, { success: true, syllabus });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/syllabus'] = async (req, res) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const item = await p.syllabus.create({ data: body });
    json(res, { success: true, syllabus: item }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/syllabus/{id}'] = async (req, res, params) => {
  try {
    const p = await getPrisma();
    const item = await p.syllabus.findUnique({ where: { id: params.id } });
    if (!item) return json(res, { error: 'Syllabus not found' }, 404);
    json(res, { success: true, syllabus: item });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/syllabus/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const item = await p.syllabus.update({ where: { id: params.id }, data: body });
    json(res, { success: true, syllabus: item });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/syllabus/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.syllabus.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- FEE STRUCTURE ---
apiRoutes['GET /api/fee-structure'] = async (req, res) => {
  try {
    const p = await getPrisma();
    const fees = await p.feeStructure.findMany({ where: { isPublished: true }, orderBy: { classRange: 'asc' } });
    json(res, { success: true, fees });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/fee-structure'] = async (req, res) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const fee = await p.feeStructure.create({ data: body });
    json(res, { success: true, fee }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/fee-structure/{id}'] = async (req, res, params) => {
  try {
    const p = await getPrisma();
    const fee = await p.feeStructure.findUnique({ where: { id: params.id } });
    if (!fee) return json(res, { error: 'Fee structure not found' }, 404);
    json(res, { success: true, fee });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/fee-structure/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const fee = await p.feeStructure.update({ where: { id: params.id }, data: body });
    json(res, { success: true, fee });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/fee-structure/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.feeStructure.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- GALLERY ---
apiRoutes['GET /api/gallery'] = async (req, res) => {
  try {
    const p = await getPrisma();
    const images = await p.galleryImage.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' } });
    json(res, { success: true, images });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/gallery'] = async (req, res) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const image = await p.galleryImage.create({ data: body });
    json(res, { success: true, image }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/gallery/{id}'] = async (req, res, params) => {
  try {
    const p = await getPrisma();
    const image = await p.galleryImage.findUnique({ where: { id: params.id } });
    if (!image) return json(res, { error: 'Image not found' }, 404);
    json(res, { success: true, image });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/gallery/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const image = await p.galleryImage.update({ where: { id: params.id }, data: body });
    json(res, { success: true, image });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/gallery/{id}'] = async (req, res, params) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.galleryImage.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- ADMISSION INQUIRIES ---
apiRoutes['GET /api/admission-inquiries'] = async (req, res) => {
  try {
    if (!(await checkOfficeAuth(req))) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    const inquiries = await p.admissionInquiry.findMany({ orderBy: { createdAt: 'desc' } });
    json(res, { success: true, inquiries });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/admission-inquiries'] = async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req));
    const { studentName, parentName, contactNumber, classApplied } = body;
    if (!studentName || !parentName || !contactNumber || !classApplied) {
      return json(res, { error: 'Missing required fields' }, 400);
    }
    const p = await getPrisma();
    const inquiry = await p.admissionInquiry.create({ data: body });
    json(res, { success: true, inquiry }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['GET /api/admission-inquiries/{id}'] = async (req, res, params) => {
  try {
    if (!(await checkOfficeAuth(req))) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    const inquiry = await p.admissionInquiry.findUnique({ where: { id: params.id } });
    if (!inquiry) return json(res, { error: 'Inquiry not found' }, 404);
    json(res, { success: true, inquiry });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['PUT /api/admission-inquiries/{id}'] = async (req, res, params) => {
  try {
    if (!(await checkOfficeAuth(req))) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    const inquiry = await p.admissionInquiry.update({ where: { id: params.id }, data: body });
    json(res, { success: true, inquiry });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['DELETE /api/admission-inquiries/{id}'] = async (req, res, params) => {
  try {
    if (!(await checkOfficeAuth(req))) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    await p.admissionInquiry.delete({ where: { id: params.id } });
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// --- CONTACT MESSAGES ---
apiRoutes['GET /api/contact-messages'] = async (req, res) => {
  try {
    if (!(await checkOfficeAuth(req))) return json(res, { error: 'Unauthorized' }, 401);
    const p = await getPrisma();
    const messages = await p.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    json(res, { success: true, messages });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/contact'] = async (req, res) => {
  try {
    const body = JSON.parse(await readBody(req));
    const { name, email, subject, message } = body;
    if (!name || !email || !subject || !message) return json(res, { error: 'Missing required fields' }, 400);
    const p = await getPrisma();
    const msg = await p.contactMessage.create({ data: body });
    json(res, { success: true, message: 'Your message has been sent successfully!' }, 201);
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/contact-messages'] = async (req, res) => {
  return apiRoutes['POST /api/contact'](req, res);
};

// --- SETTINGS ---
apiRoutes['GET /api/settings'] = async (req, res) => {
  try {
    const p = await getPrisma();
    const settings = await p.siteSettings.findMany();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    json(res, { success: true, settings: result });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

apiRoutes['POST /api/settings'] = async (req, res) => {
  try {
    const isAdmin = await checkAdminAuth(req);
    if (!isAdmin) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const p = await getPrisma();
    for (const [key, value] of Object.entries(body)) {
      await p.siteSettings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }
    json(res, { success: true });
  } catch (e) {
    json(res, { error: 'Server error' }, 500);
  }
};

// ============ ROUTE MATCHING ============
function matchApiRoute(method, url) {
  const urlPath = url.split('?')[0];
  // Exact match first
  const exactKey = method + ' ' + urlPath;
  if (apiRoutes[exactKey]) return { handler: apiRoutes[exactKey], params: {} };
  // Pattern match with {id}
  for (const key of Object.keys(apiRoutes)) {
    const spaceIdx = key.indexOf(' ');
    const routeMethod = key.substring(0, spaceIdx);
    const routePath = key.substring(spaceIdx + 1);
    if (routeMethod !== method) continue;
    const routeParts = routePath.split('/').filter(Boolean);
    const urlParts = urlPath.split('/').filter(Boolean);
    if (urlParts.length !== routeParts.length) continue;
    const params = {};
    let match = true;
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith('{') && routeParts[i].endsWith('}')) {
        const paramName = routeParts[i].slice(1, -1);
        params[paramName] = urlParts[i];
      } else if (routeParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler: apiRoutes[key], params };
  }
  return null;
}

// ============ HTTP SERVER ============
// --- IMAGE UPLOAD (base64) ---
apiRoutes['POST /api/upload'] = async (req, res) => {
  try {
    const auth = await checkAdminOrPrincipal(req);
    if (!auth) return json(res, { error: 'Unauthorized' }, 401);
    const body = JSON.parse(await readBody(req));
    const { imageData, folder } = body;
    if (!imageData) return json(res, { error: 'No image data provided' }, 400);
    
    // Parse base64
    const matches = imageData.match(/^data:(.+?);base64,(.+)$/);
    if (!matches) return json(res, { error: 'Invalid image data format' }, 400);
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const extMap = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif', 'image/webp': '.webp' };
    const ext = extMap[mimeType] || '.jpg';
    
    const uploadDir = path.join(__dirname, 'public', 'uploads', folder || 'gallery');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    const filename = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + ext;
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    
    const urlPath = '/uploads/' + (folder || 'gallery') + '/' + filename;
    json(res, { success: true, url: urlPath, filename }, 201);
  } catch (e) {
    console.error('Upload error:', e);
    json(res, { error: 'Upload failed' }, 500);
  }
};

const publicDir = path.join(__dirname, 'public');

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = req.url.split('?')[0];
    const method = req.method;

    // API routes
    if (urlPath.startsWith('/api/')) {
      const matched = matchApiRoute(method, urlPath);
      if (matched) {
        return await matched.handler(req, res, matched.params);
      }
      res.writeHead(404, { 'Content-Type': 'application/json', ...NO_CACHE });
      return res.end(JSON.stringify({ error: 'API endpoint not found' }));
    }

    // Static files (has extension)
    const ext = path.extname(urlPath);
    if (ext) {
      const filePath = path.join(publicDir, urlPath);
      return serveFile(res, filePath);
    }

    // Page routes with trailing slash normalization
    let normalizedPath = urlPath;
    if (normalizedPath.endsWith('/') && normalizedPath.length > 1) {
      normalizedPath = normalizedPath.slice(0, -1);
    }
    if (pageMap[normalizedPath]) {
      const filePath = path.join(publicDir, pageMap[normalizedPath]);
      return serveHtml(res, filePath);
    }

    // SPA fallback to index.html
    serveHtml(res, path.join(publicDir, 'index.html'));
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json', ...NO_CACHE });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

// ============ STARTUP & SHUTDOWN ============
function writePid() {
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function shutdown(signal) {
  console.log(`Received ${signal}, shutting down gracefully...`);
  if (prisma) prisma.$disconnect().catch(() => {});
  try { fs.unlinkSync(PID_FILE); } catch (e) {}
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Ignore SIGHUP (shell session close) — only SIGTERM/SIGINT should shut down
process.on('SIGHUP', () => {});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

server.listen(PORT, () => {
  writePid();
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`PID: ${process.pid}`);
});
