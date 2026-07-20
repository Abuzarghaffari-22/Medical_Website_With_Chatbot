require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/User");
const Appointment = require("../models/Appointment");
const ChatHistory = require("../models/ChatHistory");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medical-clinic";

const adminUser = {
  name: "System Administrator",
  email: "admin@medicareclinic.com",
  password: "Admin@123456",
  role: "admin",
  isEmailVerified: true,
  isActive: true,
};

const patients = [
  {
    name: "John Smith",
    email: "john.smith@example.com",
    password: "Patient@123456",
    role: "patient",
    phone: "+1-555-0101",
    dateOfBirth: new Date("1985-06-15"),
    gender: "male",
    isEmailVerified: true,
  },
  {
    name: "Sarah Johnson",
    email: "sarah.johnson@example.com",
    password: "Patient@123456",
    role: "patient",
    phone: "+1-555-0102",
    dateOfBirth: new Date("1990-03-22"),
    gender: "female",
    isEmailVerified: true,
    medicalHistory: {
      allergies: ["Penicillin"],
      conditions: ["Hypertension"],
      bloodType: "A+",
    },
  },
  {
    name: "Robert Chen",
    email: "robert.chen@example.com",
    password: "Patient@123456",
    role: "patient",
    phone: "+1-555-0103",
    dateOfBirth: new Date("1978-11-08"),
    gender: "male",
    isEmailVerified: true,
  },
];

const DOCTORS = [
  { name: "Dr. Emily Watson", specialty: "General Practice" },
  { name: "Dr. James Miller", specialty: "Cardiology" },
  { name: "Dr. Lisa Park", specialty: "Dermatology" },
  { name: "Dr. Michael Brown", specialty: "Neurology" },
];

const createAppointments = (patientIds) => {
  const appointments = [];
  const now = new Date();

  patientIds.forEach((patientId, pIdx) => {
    DOCTORS.forEach((doc, dIdx) => {
      // Past completed appointment
      const pastDate = new Date(now);
      pastDate.setDate(pastDate.getDate() - (7 + dIdx * 3 + pIdx));
      pastDate.setHours(9 + dIdx, 0, 0, 0);
      appointments.push({
        patientId,
        doctorName: doc.name,
        specialty: doc.specialty,
        appointmentDate: pastDate,
        duration: 30,
        type: "in-person",
        status: "completed",
        reason: "Routine checkup",
        confirmedAt: pastDate,
        completedAt: pastDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Upcoming appointment (only first patient gets upcoming)
      if (pIdx === 0) {
        const futureDate = new Date(now);
        futureDate.setDate(futureDate.getDate() + 3 + dIdx * 2);
        futureDate.setHours(10 + dIdx, 0, 0, 0);
        appointments.push({
          patientId,
          doctorName: doc.name,
          specialty: doc.specialty,
          appointmentDate: futureDate,
          duration: 30,
          type: "in-person",
          status: dIdx % 2 === 0 ? "confirmed" : "pending",
          reason: `Follow-up consultation`,
          ...(dIdx % 2 === 0 && { confirmedAt: new Date() }),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    });
  });

  return appointments;
};

const seedData = async () => {
  try {
    console.log("🌱 Starting database seed...");
    console.log(`📡 Connecting to: ${MONGODB_URI.replace(/:\/\/[^@]+@/, "://****@")}`);

    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB");

    await Promise.all([
      User.deleteMany({ email: { $in: [adminUser.email, ...patients.map((p) => p.email)] } }),
      Appointment.deleteMany({ doctorName: { $in: DOCTORS.map((d) => d.name) } }),
    ]);

    const admin = await User.create(adminUser);
    console.log(`✅ Admin created: ${admin.email}`);

    const createdPatients = await User.create(patients);
    console.log(`✅ ${createdPatients.length} patients created`);

    const appts = createAppointments(createdPatients.map((p) => p._id));
    await Appointment.collection.insertMany(appts);
    console.log(`✅ ${appts.length} appointments created`);

    console.log("\n🎉 Seed complete!");
    console.log("─────────────────────────────────────");
    console.log(`Admin login: ${adminUser.email} / Admin@123456`);
    console.log(`Patient login: ${patients[0].email} / Patient@123456`);
    console.log("─────────────────────────────────────\n");

    process.exit(0);
  } catch (err) {
    console.error(`❌ Seeder error: ${err.message}`);
    process.exit(1);
  }
};

const destroyData = async () => {
  try {
    console.log("💣 Destroying seed data...");
    await mongoose.connect(MONGODB_URI);

    await Promise.all([
      User.deleteMany({ email: { $in: [adminUser.email, ...patients.map((p) => p.email)] } }),
      Appointment.deleteMany({ doctorName: { $in: DOCTORS.map((d) => d.name) } }),
    ]);

    console.log("✅ Seed data destroyed");
    process.exit(0);
  } catch (err) {
    console.error(`❌ Destroy error: ${err.message}`);
    process.exit(1);
  }
};

if (process.argv[2] === "--destroy") {
  destroyData();
} else {
  seedData();
}