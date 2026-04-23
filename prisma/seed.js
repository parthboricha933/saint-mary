const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // --- USERS (Teachers & Principal) ---
  const principal = await prisma.user.upsert({
    where: { email: 'principal@saintmaryschool.com' },
    update: {},
    create: {
      name: 'Father Joseph',
      email: 'principal@saintmaryschool.com',
      password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
      role: 'principal',
      phone: '9876543210',
      status: 'approved'
    }
  });

  const teacher1 = await prisma.user.upsert({
    where: { email: 'teacher1@saintmaryschool.com' },
    update: {},
    create: {
      name: 'Anita Sharma',
      email: 'teacher1@saintmaryschool.com',
      password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
      role: 'teacher',
      phone: '9876543211',
      subject: 'Mathematics',
      status: 'approved'
    }
  });

  const teacher2 = await prisma.user.upsert({
    where: { email: 'teacher2@saintmaryschool.com' },
    update: {},
    create: {
      name: 'Rajesh Patel',
      email: 'teacher2@saintmaryschool.com',
      password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
      role: 'teacher',
      phone: '9876543212',
      subject: 'Science',
      status: 'approved'
    }
  });

  const teacher3 = await prisma.user.upsert({
    where: { email: 'teacher3@saintmaryschool.com' },
    update: {},
    create: {
      name: 'Priya Desai',
      email: 'teacher3@saintmaryschool.com',
      password: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
      role: 'teacher',
      phone: '9876543213',
      subject: 'English',
      status: 'approved'
    }
  });

  console.log('Created users:', principal.name, teacher1.name, teacher2.name, teacher3.name);

  const receptionist = await prisma.user.upsert({
    where: { email: 'receptionist@saintmaryschool.com' },
    update: {},
    create: {
      name: 'Meera Patel',
      email: 'receptionist@saintmaryschool.com',
      password: '5145dba3b6bda2d610d2c5c435a1c2481eefd3146b6a7e004ad73f794386e031', // reception123
      role: 'receptionist',
      phone: '9876543214',
      status: 'approved'
    }
  });
  console.log('Created receptionist:', receptionist.name);

  // --- EVENTS ---
  const events = [
    { title: 'Annual Day Celebration', description: 'Join us for the grand Annual Day celebration featuring cultural programs, dance performances, and prize distribution ceremony. All parents are warmly invited.', date: '2025-02-15', time: '10:00 AM', venue: 'School Auditorium', isPublished: true },
    { title: 'Republic Day', description: 'Flag hoisting ceremony and cultural program to celebrate Republic Day. Students will present patriotic songs and dances.', date: '2025-01-26', time: '8:00 AM', venue: 'School Ground', isPublished: true },
    { title: 'Parent-Teacher Meeting', description: 'Meet the teachers to discuss your child\'s academic progress and development. Report cards will be distributed.', date: '2025-03-10', time: '9:00 AM', venue: 'Respective Classrooms', isPublished: true },
    { title: 'Science Exhibition', description: 'Students will showcase innovative science projects and experiments. Awards for best projects will be given.', date: '2025-04-05', time: '10:00 AM', venue: 'Science Lab & Hall', isPublished: true },
    { title: 'Sports Day', description: 'Annual sports competition featuring track and field events, team sports, and fun games for all classes.', date: '2025-02-28', time: '8:30 AM', venue: 'School Sports Ground', isPublished: true },
    { title: 'Independence Day', description: 'Celebrating the spirit of freedom with flag hoisting, patriotic songs, and cultural performances by students.', date: '2025-08-15', time: '8:00 AM', venue: 'School Ground', isPublished: true },
    { title: 'Gandhi Jayanti', description: 'Remembering Mahatma Gandhi with a special assembly, cleanliness drive, and essay competition.', date: '2025-10-02', time: '8:00 AM', venue: 'School Assembly Hall', isPublished: true },
    { title: 'Christmas Celebration', description: 'Christmas tree decoration, carol singing, and gift exchange. A joyful celebration for all students.', date: '2025-12-25', time: '10:00 AM', venue: 'School Hall', isPublished: true },
  ];

  for (const e of events) {
    await prisma.event.upsert({
      where: { id: e.title.toLowerCase().replace(/\s+/g, '-') + '-evt' },
      update: {},
      create: { id: e.title.toLowerCase().replace(/\s+/g, '-') + '-evt', ...e }
    });
  }
  console.log('Created', events.length, 'events');

  // --- NOTIFICATIONS ---
  const notifications = [
    { title: 'Welcome to New Session 2025-26', content: 'We are pleased to welcome all students and parents to the new academic session 2025-26. Classes will commence from 1st April 2025. Please ensure all students arrive in proper uniform with completed textbooks and stationery.', category: 'academic', isImportant: true, isPublished: true },
    { title: 'Summer Vacation Notice', content: 'School will remain closed for summer vacation from 1st May to 31st May 2025. The school office will remain open during working hours for any queries. Students should complete their holiday homework assigned by respective teachers.', category: 'holiday', isImportant: true, isPublished: true },
    { title: 'Fee Payment Reminder', content: 'Parents are requested to clear the pending fees for the current quarter before the 15th of this month. Late fees will be applicable after the due date. Payment can be made through UPI, bank transfer, or at the school office.', category: 'fee', isImportant: false, isPublished: true },
    { title: 'Diwali Vacation', content: 'School will remain closed from 18th October to 25th October 2025 for Diwali vacation. May the festival of lights bring joy and prosperity to all. Happy Diwali!', category: 'holiday', isImportant: true, isPublished: true },
    { title: 'New Computer Lab Inauguration', content: 'We are happy to announce the inauguration of our new state-of-the-art computer lab equipped with modern systems and high-speed internet. Computer classes for all grades will begin next week.', category: 'infrastructure', isImportant: false, isPublished: true },
    { title: 'Winter Uniform Reminder', content: 'With the onset of winter, students are required to wear the winter uniform from 1st November. The winter uniform is available at the school bookshop. Please ensure your child is dressed appropriately for the weather.', category: 'general', isImportant: false, isPublished: true },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.title.toLowerCase().replace(/\s+/g, '-') + '-ntf' },
      update: {},
      create: { id: n.title.toLowerCase().replace(/\s+/g, '-') + '-ntf', ...n }
    });
  }
  console.log('Created', notifications.length, 'notifications');

  // --- SYLLABUS ---
  const subjects = ['Mathematics', 'English', 'Science', 'Social Studies', 'Hindi', 'Gujarati', 'Computer'];
  for (let cls = 1; cls <= 8; cls++) {
    for (const sub of subjects) {
      await prisma.syllabus.upsert({
        where: { id: `class-${cls}-${sub.toLowerCase().replace(/\s+/g, '-')}` },
        update: {},
        create: {
          id: `class-${cls}-${sub.toLowerCase().replace(/\s+/g, '-')}`,
          className: `Class ${cls}`,
          subject: sub,
          description: `Complete ${sub} syllabus for Class ${cls} as per Gujarat State Board curriculum. Includes textbook chapters, workbook exercises, and periodic assessments.`,
          academicYear: '2025-26',
          isPublished: true
        }
      });
    }
  }
  console.log('Created syllabus for classes 1-8');

  // --- FEE STRUCTURE ---
  const feeData = [
    { classRange: 'Class 1', tuitionFee: '12000', examFee: '2000', totalFee: '14000' },
    { classRange: 'Class 2', tuitionFee: '12000', examFee: '2000', totalFee: '14000' },
    { classRange: 'Class 3', tuitionFee: '15000', examFee: '2500', totalFee: '17500' },
    { classRange: 'Class 4', tuitionFee: '15000', examFee: '2500', totalFee: '17500' },
    { classRange: 'Class 5', tuitionFee: '18000', examFee: '3000', labFee: '1500', totalFee: '22500' },
    { classRange: 'Class 6', tuitionFee: '18000', examFee: '3000', labFee: '1500', totalFee: '22500' },
    { classRange: 'Class 7', tuitionFee: '20000', examFee: '3500', labFee: '2000', sportsFee: '1500', totalFee: '27000' },
    { classRange: 'Class 8', tuitionFee: '20000', examFee: '3500', labFee: '2000', sportsFee: '1500', totalFee: '27000' },
  ];

  for (const f of feeData) {
    await prisma.feeStructure.upsert({
      where: { id: f.classRange.toLowerCase().replace(/\s+/g, '-') + '-fee' },
      update: {},
      create: {
        id: f.classRange.toLowerCase().replace(/\s+/g, '-') + '-fee',
        ...f,
        transportFee: '6000',
        academicYear: '2025-26',
        isPublished: true
      }
    });
  }
  console.log('Created fee structure for classes 1-8');

  // --- GALLERY ---
  const galleryImages = [
    { title: 'Annual Day 2024', imageUrl: '/uploads/gallery/image1.png', category: 'events' },
    { title: 'Sports Day', imageUrl: '/uploads/gallery/image2.png', category: 'sports' },
    { title: 'Science Exhibition', imageUrl: '/uploads/gallery/image3.png', category: 'academic' },
    { title: 'Cultural Program', imageUrl: '/uploads/gallery/image4.png', category: 'events' },
  ];

  for (const g of galleryImages) {
    await prisma.galleryImage.upsert({
      where: { id: g.title.toLowerCase().replace(/\s+/g, '-') + '-img' },
      update: {},
      create: { id: g.title.toLowerCase().replace(/\s+/g, '-') + '-img', ...g, isPublished: true }
    });
  }
  console.log('Created', galleryImages.length, 'gallery images');

  // --- CONTACT MESSAGES ---
  const contactMessages = [
    { id: 'msg-001', name: 'Rakesh Shah', email: 'rakesh.shah@gmail.com', phone: '9898123456', subject: 'Fee Structure Query', message: 'I would like to know the complete fee structure for Class 5 for the academic year 2025-26. Could you please share the breakdown including transport fees?', isRead: false },
    { id: 'msg-002', name: 'Sunita Patel', email: 'sunita.p@yahoo.com', phone: '9876512345', subject: 'Admission Enquiry', message: 'We are planning to shift to Rajula. I want to admit my son in Class 3. What is the admission process and when can we visit the school for a campus tour?', isRead: false },
    { id: 'msg-003', name: 'Amit Joshi', email: 'amit.joshi@outlook.com', phone: '9427312345', subject: 'Bus Facility', message: 'Does the school provide bus transport from Bhavnagar road area? What are the pick-up and drop timings? Please share the transport route details.', isRead: true },
    { id: 'msg-004', name: 'Kavita Desai', email: 'kavita.desai@gmail.com', phone: '9685712345', subject: 'Sports Activities', message: 'My daughter is very interested in sports. What indoor and outdoor sports facilities does the school offer? Are there any special coaching classes after school hours?', isRead: false },
    { id: 'msg-005', name: 'Vikram Singh', email: 'vikram.singh@gmail.com', phone: '9925812345', subject: 'Library Facility', message: 'I wanted to know about the school library. Does the school have a well-stocked library? What are the library timings and can students borrow books home?', isRead: true },
  ];

  for (const m of contactMessages) {
    await prisma.contactMessage.upsert({
      where: { id: m.id },
      update: {},
      create: m
    });
  }
  console.log('Created', contactMessages.length, 'contact messages');

  // --- ADMISSION INQUIRIES ---
  const admissionInquiries = [
    { id: 'inq-001', studentName: 'Aarav Patel', parentName: 'Rajesh Patel', contactNumber: '9898123401', email: 'rajesh.patel@gmail.com', classApplied: 'Class 5', message: 'My son is currently studying in Class 4 at Delhi Public School, Rajula. We would like to transfer him to your school for the next academic year. He is good in Mathematics and Science.', status: 'pending' },
    { id: 'inq-002', studentName: 'Priya Sharma', parentName: 'Meena Sharma', contactNumber: '9876513402', email: 'meena.sharma@yahoo.com', classApplied: 'Class 3', message: 'We are new to Rajula and looking for a good school for our daughter. She has studied in an English medium school till now.', status: 'approved', adminReply: 'Welcome! Please visit the school office between 9 AM and 2 PM with the previous school TC and mark sheets. We will guide you through the admission process.' },
    { id: 'inq-003', studentName: 'Rohan Desai', parentName: 'Dinesh Desai', contactNumber: '9427313403', classApplied: 'Class 7', message: 'My son is studying in Class 6 in a Gujarati medium school. We want him to join English medium from Class 7. Will there be any special support for the language transition?', status: 'pending' },
    { id: 'inq-004', studentName: 'Ananya Joshi', parentName: 'Sunil Joshi', contactNumber: '9685713404', email: 'sunil.joshi@outlook.com', classApplied: 'Class 1', message: 'My daughter will be 6 years old in June. Is she eligible for Class 1 admission? What documents do we need to bring?', status: 'pending' },
    { id: 'inq-005', studentName: 'Karan Singh', parentName: 'Manoj Singh', contactNumber: '9925813405', classApplied: 'Class 8', message: 'We are relocating from Ahmedabad. My son is currently in Class 7. We need admission in Class 8 urgently. Please let us know the process.', status: 'rejected', adminReply: 'Thank you for your interest. Unfortunately, admissions for Class 8 are currently full for this academic year. We suggest you try again next year.' },
  ];

  for (const inq of admissionInquiries) {
    await prisma.admissionInquiry.upsert({
      where: { id: inq.id },
      update: {},
      create: inq
    });
  }
  console.log('Created', admissionInquiries.length, 'admission inquiries');

  // --- SITE SETTINGS ---
  const settings = {
    schoolName: 'Saint Mary School',
    schoolAddress: 'Rajula, Amreli, Gujarat, India',
    schoolPhone: '+91-9876543210',
    schoolEmail: 'info@saintmaryschool.com',
    schoolMotto: 'Knowledge, Discipline, Excellence'
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    });
  }
  console.log('Created site settings');

  console.log('\n✅ Database seeded successfully!');
  console.log('\nLogin credentials:');
  console.log('  Admin: Email = admin@saintmaryschool.com');
  console.log('  Principal: Email = principal@saintmaryschool.com, Password = admin123');
  console.log('  Teacher 1: Email = teacher1@saintmaryschool.com, Password = admin123');
  console.log('  Teacher 2: Email = teacher2@saintmaryschool.com, Password = admin123');
  console.log('  Teacher 3: Email = teacher3@saintmaryschool.com, Password = admin123');
  console.log('  Receptionist: Email = receptionist@saintmaryschool.com, Password = reception123');
}

main()
  .catch(e => { console.error('Seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
