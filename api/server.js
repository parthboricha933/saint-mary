const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

// Prisma singleton for serverless (prevents connection exhaustion)
const globalForPrisma = global;
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Admin credentials from environment variables
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_TOKEN_HASH = process.env.ADMIN_TOKEN_HASH || '';

// ── Helpers ────────────────────────────────────────────────────────
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  const cookies = {};
  cookieHeader.split(';').forEach(pair => {
    const [key, ...val] = pair.trim().split('=');
    if (key) cookies[key] = val.join('=');
  });
  return cookies;
}

function setCookie(name, value) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

async function checkAdminAuth(cookies) {
  const token = cookies.admin_token;
  if (!token || !ADMIN_EMAIL || !ADMIN_TOKEN_HASH) return false;
  const hash = crypto.createHash('sha256').update(ADMIN_EMAIL + ':' + token).digest('hex');
  return hash === ADMIN_TOKEN_HASH;
}

async function checkUserAuth(cookies) {
  const userId = cookies.user_token;
  if (!userId) return null;
  try {
    return await prisma.user.findUnique({ where: { id: userId } });
  } catch (e) {
    return null;
  }
}

async function checkAdminOrPrincipal(cookies) {
  const isAdmin = await checkAdminAuth(cookies);
  if (isAdmin) return { role: 'admin' };
  const user = await checkUserAuth(cookies);
  if (user && user.role === 'principal' && user.status === 'approved') return user;
  return null;
}

// Admin, Principal, or Receptionist — for contact-messages & admission-inquiries
async function checkOfficeAuth(cookies) {
  const isAdmin = await checkAdminAuth(cookies);
  if (isAdmin) return { role: 'admin' };
  const user = await checkUserAuth(cookies);
  if (user && user.role === 'principal' && user.status === 'approved') return user;
  if (user && user.role === 'receptionist' && user.status === 'approved') return user;
  return null;
}

// ── Route matching ────────────────────────────────────────────────
function matchRoute(method, urlPath) {
  const exactKey = method + ' ' + urlPath;
  if (apiRoutes[exactKey]) return { handler: apiRoutes[exactKey], params: {} };
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
        params[routeParts[i].slice(1, -1)] = urlParts[i];
      } else if (routeParts[i] !== urlParts[i]) {
        match = false;
        break;
      }
    }
    if (match) return { handler: apiRoutes[key], params };
  }
  return null;
}

// ── API Routes ────────────────────────────────────────────────────
const apiRoutes = {};

// --- AUTH ---
apiRoutes['POST /api/auth/admin-login'] = async (req, res) => {
  try {
    const { email, token } = req.body || {};
    if (!email || !token) return res.status(400).json({ error: 'Missing credentials' });
    const hash = crypto.createHash('sha256').update(email + ':' + token).digest('hex');
    if (hash !== ADMIN_TOKEN_HASH) return res.status(401).json({ error: 'Invalid admin credentials' });
    res.setHeader('Set-Cookie', setCookie('admin_token', token));
    return res.json({ success: true, email });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

apiRoutes['POST /api/auth/user-login'] = async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.password !== hash) return res.status(401).json({ error: 'Invalid email or password' });
    if (user.status === 'pending') return res.status(403).json({ error: 'Your account is pending approval by the principal. Please contact the school admin.' });
    if (user.status === 'rejected') return res.status(403).json({ error: 'Your account has been rejected. Please contact the school admin.' });
    res.setHeader('Set-Cookie', setCookie('user_token', user.id));
    return res.json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, subject: user.subject, status: user.status } });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

apiRoutes['GET /api/auth/me'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const isAdmin = await checkAdminAuth(cookies);
    if (isAdmin) return res.json({ success: true, role: 'admin', user: { id: 'admin', name: 'Administrator', email: ADMIN_EMAIL, role: 'admin' } });
    const user = await checkUserAuth(cookies);
    if (user) return res.json({ success: true, role: user.role, user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone, subject: user.subject, status: user.status } });
    return res.status(401).json({ error: 'Not authenticated' });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

apiRoutes['POST /api/auth/logout'] = async (req, res) => {
  res.setHeader('Set-Cookie', [setCookie('admin_token', ''), setCookie('user_token', '')]);
  return res.json({ success: true });
};

apiRoutes['POST /api/auth/register'] = async (req, res) => {
  try {
    const { name, email, password, role, phone, subject } = req.body || {};
    if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing required fields' });
    if (!['teacher', 'principal', 'receptionist'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already exists' });
    if (role === 'principal') {
      const approvedPrincipal = await prisma.user.findFirst({ where: { role: 'principal', status: 'approved' } });
      if (approvedPrincipal) return res.status(403).json({ error: 'A principal already exists' });
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    const user = await prisma.user.create({ data: { name, email, password: hash, role, phone, subject, status: 'pending' } });
    return res.status(201).json({ success: true, user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status } });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
};

// --- USERS ---
apiRoutes['GET /api/users'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const isAdmin = await checkAdminAuth(cookies);
    const user = await checkUserAuth(cookies);
    if (!isAdmin && (!user || (user.role !== 'principal' || user.status !== 'approved')))
      return res.status(401).json({ error: 'Unauthorized' });
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, users });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['GET /api/users/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const user = await prisma.user.findUnique({ where: { id: params.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, user });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/users/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    const user = await prisma.user.update({ where: { id: params.id }, data: body });
    return res.json({ success: true, user });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/users/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.user.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- EVENTS ---
apiRoutes['GET /api/events'] = async (req, res) => {
  try {
    const events = await prisma.event.findMany({ where: { isPublished: true }, orderBy: { date: 'desc' } });
    return res.json({ success: true, events });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/events'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const event = await prisma.event.create({ data: req.body || {} });
    return res.status(201).json({ success: true, event });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['GET /api/events/{id}'] = async (req, res, params) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: params.id } });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    return res.json({ success: true, event });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/events/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const event = await prisma.event.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, event });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/events/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.event.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- NOTIFICATIONS ---
apiRoutes['GET /api/notifications'] = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, notifications });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/notifications'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const notification = await prisma.notification.create({ data: req.body || {} });
    return res.status(201).json({ success: true, notification });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['GET /api/notifications/{id}'] = async (req, res, params) => {
  try {
    const n = await prisma.notification.findUnique({ where: { id: params.id } });
    if (!n) return res.status(404).json({ error: 'Notification not found' });
    return res.json({ success: true, notification: n });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/notifications/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const n = await prisma.notification.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, notification: n });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/notifications/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.notification.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- SYLLABUS ---
apiRoutes['GET /api/syllabus'] = async (req, res) => {
  try {
    const syllabus = await prisma.syllabus.findMany({ where: { isPublished: true }, orderBy: [{ className: 'asc' }, { subject: 'asc' }] });
    return res.json({ success: true, syllabus });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/syllabus'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const item = await prisma.syllabus.create({ data: req.body || {} });
    return res.status(201).json({ success: true, syllabus: item });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['GET /api/syllabus/{id}'] = async (req, res, params) => {
  try {
    const item = await prisma.syllabus.findUnique({ where: { id: params.id } });
    if (!item) return res.status(404).json({ error: 'Syllabus not found' });
    return res.json({ success: true, syllabus: item });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/syllabus/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const item = await prisma.syllabus.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, syllabus: item });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/syllabus/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.syllabus.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- FEE STRUCTURE ---
apiRoutes['GET /api/fee-structure'] = async (req, res) => {
  try {
    const fees = await prisma.feeStructure.findMany({ where: { isPublished: true }, orderBy: { classRange: 'asc' } });
    return res.json({ success: true, fees });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/fee-structure'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const fee = await prisma.feeStructure.create({ data: req.body || {} });
    return res.status(201).json({ success: true, fee });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['GET /api/fee-structure/{id}'] = async (req, res, params) => {
  try {
    const fee = await prisma.feeStructure.findUnique({ where: { id: params.id } });
    if (!fee) return res.status(404).json({ error: 'Fee structure not found' });
    return res.json({ success: true, fee });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/fee-structure/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const fee = await prisma.feeStructure.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, fee });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/fee-structure/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.feeStructure.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- GALLERY ---
apiRoutes['GET /api/gallery'] = async (req, res) => {
  try {
    const images = await prisma.galleryImage.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, images });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/gallery'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const image = await prisma.galleryImage.create({ data: req.body || {} });
    return res.status(201).json({ success: true, image });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['GET /api/gallery/{id}'] = async (req, res, params) => {
  try {
    const image = await prisma.galleryImage.findUnique({ where: { id: params.id } });
    if (!image) return res.status(404).json({ error: 'Image not found' });
    return res.json({ success: true, image });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/gallery/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const image = await prisma.galleryImage.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, image });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/gallery/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.galleryImage.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- UPLOAD (stores base64 data URL on Vercel, no filesystem) ---
apiRoutes['POST /api/upload'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminOrPrincipal(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const { imageData, folder } = req.body || {};
    if (!imageData) return res.status(400).json({ error: 'No image data provided' });
    // On Vercel serverless, filesystem is read-only; return the base64 data URL directly
    return res.status(201).json({ success: true, url: imageData });
  } catch (e) {
    console.error('Upload error:', e);
    return res.status(500).json({ error: 'Upload failed' });
  }
};

// --- ADMISSION INQUIRIES ---
apiRoutes['GET /api/admission-inquiries'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const inquiries = await prisma.admissionInquiry.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, inquiries });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/admission-inquiries'] = async (req, res) => {
  try {
    const body = req.body || {};
    const { studentName, parentName, contactNumber, classApplied } = body;
    if (!studentName || !parentName || !contactNumber || !classApplied)
      return res.status(400).json({ error: 'Missing required fields' });
    // Only pass known fields to Prisma to avoid unknown field errors
    const inquiry = await prisma.admissionInquiry.create({
      data: {
        studentName: String(body.studentName),
        parentName: String(body.parentName),
        contactNumber: String(body.contactNumber),
        email: body.email ? String(body.email) : null,
        classApplied: String(body.classApplied),
        message: body.message ? String(body.message) : null,
      }
    });
    return res.status(201).json({ success: true, inquiry });
  } catch (e) {
    console.error('Admission inquiry create error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

apiRoutes['GET /api/admission-inquiries/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const inquiry = await prisma.admissionInquiry.findUnique({ where: { id: params.id } });
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    return res.json({ success: true, inquiry });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['PUT /api/admission-inquiries/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const inquiry = await prisma.admissionInquiry.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, inquiry });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/admission-inquiries/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.admissionInquiry.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- CONTACT ---
apiRoutes['GET /api/contact-messages'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, messages });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/contact'] = async (req, res) => {
  try {
    const body = req.body || {};
    const { name, email, subject, message } = body;
    if (!name || !email || !subject || !message) return res.status(400).json({ error: 'Missing required fields' });
    // Only pass known fields to Prisma
    await prisma.contactMessage.create({
      data: {
        name: String(body.name),
        email: String(body.email),
        phone: body.phone ? String(body.phone) : null,
        subject: String(body.subject),
        message: String(body.message),
      }
    });
    return res.status(201).json({ success: true, message: 'Your message has been sent successfully!' });
  } catch (e) {
    console.error('Contact message create error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};

apiRoutes['POST /api/contact-messages'] = async (req, res) => {
  return apiRoutes['POST /api/contact'](req, res);
};

apiRoutes['PUT /api/contact-messages/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const msg = await prisma.contactMessage.update({ where: { id: params.id }, data: req.body || {} });
    return res.json({ success: true, message: msg });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['DELETE /api/contact-messages/{id}'] = async (req, res, params) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkOfficeAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    await prisma.contactMessage.delete({ where: { id: params.id } });
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// --- SETTINGS ---
apiRoutes['GET /api/settings'] = async (req, res) => {
  try {
    const settings = await prisma.siteSettings.findMany();
    const result = {};
    settings.forEach(s => { result[s.key] = s.value; });
    return res.json({ success: true, settings: result });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

apiRoutes['POST /api/settings'] = async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    if (!(await checkAdminAuth(cookies))) return res.status(401).json({ error: 'Unauthorized' });
    const body = req.body || {};
    for (const [key, value] of Object.entries(body)) {
      await prisma.siteSettings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) }
      });
    }
    return res.json({ success: true });
  } catch (e) { return res.status(500).json({ error: 'Server error' }); }
};

// ── Body Parser for Vercel Serverless ───────────────────────────
function parseBody(req) {
  // Vercel auto-parses JSON bodies, but rewrites may deliver raw string/Buffer
  if (req.body && typeof req.body === 'object') return req.body;
  try {
    if (typeof req.body === 'string') return JSON.parse(req.body);
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8'));
  } catch (e) { /* ignore parse errors, fall through */ }
  return {};
}

// ── Vercel Serverless Handler (CommonJS export) ───────────────────
module.exports = async function handler(req, res) {
  // Use req.url since req.query.path may be empty in some Vercel configs
  const urlPath = (req.url || '').split('?')[0];
  const method = req.method;

  // Ensure req.body is a parsed object for POST/PUT/PATCH
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    req.body = parseBody(req);
  }

  // Enable CORS for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  const matched = matchRoute(method, urlPath);
  if (matched) {
    try {
      return await matched.handler(req, res, matched.params);
    } catch (e) {
      console.error('Route handler error:', e);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  res.status(404).json({ error: 'API endpoint not found' });
};
