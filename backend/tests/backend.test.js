const request  = require("supertest");
const mongoose = require("mongoose");
const app      = require("../server");
const User        = require("../models/User");
const Appointment = require("../models/Appointment");
const ChatHistory = require("../models/ChatHistory");

beforeAll(async () => {
  const testUri =
    process.env.MONGODB_TEST_URI ||
    "mongodb://127.0.0.1:27017/medical-clinic-test";
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(testUri);
  }
});

afterAll(async () => {
  const testUsers = await User.find({ email: /@test\.com$/ }).select("_id").lean();
  const testUserIds = testUsers.map((u) => u._id);

  await Promise.all([
    User.deleteMany({ email: /@test\.com$/ }),
    Appointment.deleteMany({ doctorName: "Dr. Test Doctor" }),
    ChatHistory.deleteMany({ userId: { $in: testUserIds } }),
  ]);

  await mongoose.connection.close();
});

const futureDate = (daysAhead = 3, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

const registerAndLogin = async (payload) => {
  const reg = await request(app).post("/api/auth/register").send(payload);
  return reg.body.accessToken;
};

describe("POST /api/auth/register", () => {
  it("registers a new patient and returns access token", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Test Patient",
      email: "patient@test.com",
      password: "Test@123456",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe("patient");
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.refreshTokens).toBeUndefined();
  });

  it("rejects duplicate email with 409", async () => {
    const payload = {
      name: "Dup User",
      email: "duplicate@test.com",
      password: "Test@123456",
    };
    await request(app).post("/api/auth/register").send(payload);
    const res = await request(app).post("/api/auth/register").send(payload);
    expect(res.statusCode).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects weak password (no uppercase) with 422", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Weak Pass",
      email: "weak@test.com",
      password: "password123",
    });
    expect(res.statusCode).toBe(422);
    expect(res.body.details.validationErrors).toBeDefined();
  });

  it("rejects invalid email with 422", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Bad Email",
      email: "not-an-email",
      password: "Test@123456",
    });
    expect(res.statusCode).toBe(422);
  });

  it("ignores role field — always registers as patient", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Role Bypass",
      email: "rolebypas@test.com",
      password: "Test@123456",
      role: "admin",
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe("patient");
  });

  it("rejects short name with 422", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "A",
      email: "shortname@test.com",
      password: "Test@123456",
    });
    expect(res.statusCode).toBe(422);
  });
});

describe("POST /api/auth/login", () => {
  const creds = { email: "logintest@test.com", password: "Test@123456" };

  beforeAll(async () => {
    await User.deleteOne({ email: creds.email });
    await User.create({ name: "Login Test", ...creds, role: "patient" });
  });

  it("logs in with valid credentials", async () => {
    const res = await request(app).post("/api/auth/login").send(creds);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(creds.email);
  });

  it("rejects wrong password with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ ...creds, password: "WrongPassword1!" });
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("rejects non-existent email with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@test.com", password: "Test@123456" });
    expect(res.statusCode).toBe(401);
  });

  it("rejects missing password with 422", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: creds.email });
    expect(res.statusCode).toBe(422);
  });
});

describe("GET /api/auth/me", () => {
  let token;

  beforeAll(async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "logintest@test.com", password: "Test@123456" });
    token = res.body.accessToken;
  });

  it("returns user profile with valid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.email).toBe("logintest@test.com");
    expect(res.body.user.password).toBeUndefined();
  });

  it("returns 401 without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer totally.invalid.token");
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with malformed Authorization header", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "NotBearer something");
    expect(res.statusCode).toBe(401);
  });
});

describe("Appointment Endpoints", () => {
  let patientToken;
  let adminToken;
  let createdApptId;

  beforeAll(async () => {
    await User.deleteOne({ email: "apptpatient@test.com" });
    patientToken = await registerAndLogin({
      name: "Appt Patient",
      email: "apptpatient@test.com",
      password: "Test@123456",
    });

    await User.deleteOne({ email: "apptadmin@test.com" });
    await User.create({
      name: "Appt Admin",
      email: "apptadmin@test.com",
      password: "Test@123456",
      role: "admin",
    });
    const adminRes = await request(app).post("/api/auth/login").send({
      email: "apptadmin@test.com",
      password: "Test@123456",
    });
    adminToken = adminRes.body.accessToken;
  });

  it("creates appointment and returns 201", async () => {
    const res = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        doctorName: "Dr. Test Doctor",
        specialty: "General Practice",
        appointmentDate: futureDate(3),
        duration: 30,
        reason: "Routine checkup",
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.appointment.status).toBe("pending");
    createdApptId = res.body.appointment._id;
  });

  it("rejects appointment without authentication", async () => {
    const res = await request(app).post("/api/appointments").send({
      doctorName: "Dr. Test Doctor",
      specialty: "General Practice",
      appointmentDate: futureDate(5),
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects past appointment date with 422", async () => {
    const past = new Date();
    past.setDate(past.getDate() - 1);
    const res = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        doctorName: "Dr. Test Doctor",
        specialty: "General Practice",
        appointmentDate: past.toISOString(),
      });
    expect([400, 422]).toContain(res.statusCode);
  });

  it("rejects missing specialty with 422", async () => {
    const res = await request(app)
      .post("/api/appointments")
      .set("Authorization", `Bearer ${patientToken}`)
      .send({
        doctorName: "Dr. Test Doctor",
        appointmentDate: futureDate(4),
      });
    expect(res.statusCode).toBe(422);
  });

  it("patient can view their own appointment", async () => {
    const res = await request(app)
      .get(`/api/appointments/${createdApptId}`)
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.appointment._id).toBe(createdApptId);
  });

  it("admin can update appointment status to confirmed", async () => {
    const res = await request(app)
      .patch(`/api/appointments/${createdApptId}/status`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ status: "confirmed" });
    expect(res.statusCode).toBe(200);
    expect(res.body.appointment.status).toBe("confirmed");
  });

  it("patient cannot update appointment status (403)", async () => {
    const res = await request(app)
      .patch(`/api/appointments/${createdApptId}/status`)
      .set("Authorization", `Bearer ${patientToken}`)
      .send({ status: "completed" });
    expect(res.statusCode).toBe(403);
  });

  it("returns available slots for a doctor", async () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const res = await request(app)
      .get("/api/appointments/available-slots")
      .set("Authorization", `Bearer ${patientToken}`)
      .query({ doctorName: "Dr. Test Doctor", date: date.toISOString().split("T")[0] });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.slots)).toBe(true);
  });

  it("returns 400 for available-slots without required params", async () => {
    const res = await request(app)
      .get("/api/appointments/available-slots")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.statusCode).toBe(400);
  });
});

describe("Admin Routes", () => {
  let adminToken;
  let patientToken;

  beforeAll(async () => {
    await User.deleteOne({ email: "superadmin@test.com" });
    await User.create({
      name: "Super Admin",
      email: "superadmin@test.com",
      password: "Admin@123456",
      role: "admin",
    });
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "superadmin@test.com", password: "Admin@123456" });
    adminToken = adminRes.body.accessToken;

    await User.deleteOne({ email: "admintest@test.com" });
    patientToken = await registerAndLogin({
      name: "Admin Test Patient",
      email: "admintest@test.com",
      password: "Test@123456",
    });
  });

  it("admin can access dashboard with stats", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.appointments).toBeDefined();
    expect(res.body.stats.users).toBeDefined();
  });

  it("patient cannot access admin dashboard (403)", async () => {
    const res = await request(app)
      .get("/api/admin/dashboard")
      .set("Authorization", `Bearer ${patientToken}`);
    expect(res.statusCode).toBe(403);
  });

  it("unauthenticated cannot access admin dashboard (401)", async () => {
    const res = await request(app).get("/api/admin/dashboard");
    expect(res.statusCode).toBe(401);
  });

  it("admin can list all users with pagination", async () => {
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    if (res.body.users.length > 0) {
      expect(res.body.users[0].password).toBeUndefined();
      expect(res.body.users[0].refreshTokens).toBeUndefined();
    }
  });

  it("admin can list all appointments", async () => {
    const res = await request(app)
      .get("/api/admin/appointments")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.appointments)).toBe(true);
  });

  it("admin can search users by name", async () => {
    const res = await request(app)
      .get("/api/admin/users?search=Admin")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

describe("GET /health", () => {
  it("returns healthy status with database info", async () => {
    const res = await request(app).get("/health");
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.database).toBe("connected");
    expect(res.body.environment).toBeDefined();
  });
});

describe("404 Handler", () => {
  it("returns 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nonexistent-endpoint");
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 for unknown HTTP methods", async () => {
    const res = await request(app).delete("/api/auth/login");
    expect(res.statusCode).toBe(404);
  });
});

describe("Input Sanitization", () => {
  it("strips MongoDB operators from JSON body", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email: { $gt: "" },
      password: "anything",
    });
    expect(res.statusCode).not.toBe(200);
  });
});

describe("Account Lockout", () => {
  const lockEmail = "lockout@test.com";
  const lockPass  = "Correct@123456";

  beforeAll(async () => {
    await User.deleteOne({ email: lockEmail });
    await User.create({ name: "Lockout User", email: lockEmail, password: lockPass, role: "patient" });
  });

  it("locks account after 5 failed attempts and returns 423", async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post("/api/auth/login").send({ email: lockEmail, password: "Wrong@999" });
    }
    const res = await request(app).post("/api/auth/login").send({ email: lockEmail, password: lockPass });
    expect(res.statusCode).toBe(423);
    expect(res.body.message).toMatch(/locked/i);
  });
});

describe("Refresh Token Reuse", () => {
  it("revokes all sessions on refresh token reuse and returns 401", async () => {
    const reg = await request(app).post("/api/auth/register").send({
      name: "Reuse Test",
      email: "reusetest@test.com",
      password: "Test@123456",
    });
    const cookie = reg.headers["set-cookie"];

    const first = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie);
    expect(first.statusCode).toBe(200);

    const reuse = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", cookie);
    expect(reuse.statusCode).toBe(401);
  });
});

describe("Concurrent Booking Conflict", () => {
  it("rejects double-booking the same slot with 409", async () => {
    const token = await registerAndLogin({
      name: "Conflict Patient",
      email: "conflictpatient@test.com",
      password: "Test@123456",
    });

    const slot = futureDate(7, 14);
    const payload = {
      doctorName: "Dr. Conflict Doctor",
      specialty:  "General Practice",
      appointmentDate: slot,
      duration: 30,
      reason: "Test",
    };

    const [r1, r2] = await Promise.all([
      request(app).post("/api/appointments").set("Authorization", `Bearer ${token}`).send(payload),
      request(app).post("/api/appointments").set("Authorization", `Bearer ${token}`).send(payload),
    ]);

    const statuses = [r1.statusCode, r2.statusCode].sort();
    expect(statuses).toContain(201);
    expect(statuses).toContain(409);
  });
});