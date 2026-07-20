
# MediCare Clinic

A full-stack web app for a medical clinic. Patients can describe their symptoms and get an AI-powered triage response, book appointments, and manage their profile — all from one place. Admins get a separate dashboard to manage appointments and users.

The project is split into three parts: a React frontend, a Node.js/Express backend, and a Python AI service that talks to HuggingFace's inference API. MongoDB handles all data storage.

<img width="1853" height="963" alt="Screenshot from 2026-03-04 23-58-29" src="https://github.com/user-attachments/assets/be976b0f-b250-49d5-9d03-77b7f6911782" />

*Landing page showcasing the AI-powered healthcare platform.*

<img width="1853" height="966" alt="Screenshot from 2026-03-05 00-10-50" src="https://github.com/user-attachments/assets/cc8d09b3-82c3-4a98-a63c-86d9b743318c" />

*Secure sign-in page for the patient portal.*

<img width="1860" height="897" alt="Screenshot from 2026-03-04 23-58-53" src="https://github.com/user-attachments/assets/4d796123-c586-42f8-81ee-f2ea1a1a93b9" />

*Platform features — AI health assistant, appointment booking, secure portal, and more.*

<img width="1855" height="861" alt="Screenshot from 2026-03-04 23-59-19" src="https://github.com/user-attachments/assets/8cad7747-d786-41a4-a57a-506aa85cec6d" />

*Specialist departments overview with a call-to-action to create an account.*

<img width="1856" height="356" alt="Screenshot from 2026-03-04 23-59-33" src="https://github.com/user-attachments/assets/ff04c1c7-66ee-4976-a345-e7fd4d90e4ca" />

*Footer with clinic contact details, quick links, and emergency notice.*

<img width="1851" height="953" alt="Screenshot from 2026-03-05 03-48-24" src="https://github.com/user-attachments/assets/e5b55240-94e2-4537-bdec-f300175409a8" />

*AI Assistant chat guiding a patient through symptom triage.*

<img width="1851" height="953" alt="Screenshot from 2026-03-05 03-46-54" src="https://github.com/user-attachments/assets/28dcf3cc-df95-438e-8769-c11033725c11" />

*Patient dashboard with appointment stats and quick actions.*

---

## What it does

- Patients register, log in, and chat with an AI about their symptoms
- The AI figures out intent (booking, symptom check, general question) and responds accordingly
- Appointments can be booked, viewed, and cancelled
- Admins can manage all appointments and user accounts
- JWT auth with refresh tokens, rate limiting, and input validation throughout

---

## Tech stack

- **Frontend** — React 18, Vite, Tailwind CSS (runs on port 5173)
- **Backend** — Node.js, Express, MongoDB/Mongoose (runs on port 5000)
- **AI Service** — Python, FastAPI, HuggingFace Inference API (runs on port 8000)

---

## Running locally with Docker (easiest)

```bash
git clone <your-repo-url>
cd medical-clinic

cp backend/.env.example backend/.env
cp ai-services/.env.example ai-services/.env

# Fill in backend/.env: MONGODB_URI, JWT_SECRET, JWT_REFRESH_SECRET, INTERNAL_API_KEY
# Fill in ai-services/.env: HF_TOKEN, INTERNAL_API_KEY (must match backend)

docker-compose up --build
```

App will be at http://localhost:5173

---

## Running manually

You need Node.js 20+, Python 3.11+, and MongoDB running locally.

**Backend**
```bash
cd backend
npm install
cp .env.example .env
# edit .env with your values
npm run dev
```

**AI Service**
```bash
cd ai-services
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env — HF_TOKEN is required (free at huggingface.co/settings/tokens)
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
npm run dev
```

Or run all three at once from the root:
```bash
npm install
npm run dev
```

---

## Environment variables

Copy the `.env.example` files in each folder and fill them in. The key ones:

**backend/.env**
```
MONGODB_URI=mongodb://localhost:27017/medical-clinic
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<different value, same command>
INTERNAL_API_KEY=<must match ai-services INTERNAL_API_KEY>
AI_SERVICE_URL=http://localhost:8000
```

**ai-services/.env**
```
HF_TOKEN=hf_...        # get free from huggingface.co/settings/tokens
INTERNAL_API_KEY=...   # must match backend
```

**frontend/.env**
```
VITE_API_URL=http://localhost:5000
```

---

## Seed demo data

```bash
cd backend && npm run seed
```

This creates two accounts for testing:
- Admin: admin@medicareclinic.com / Admin@123456
- Patient: john@example.com / Patient@123

---

## Tests

```bash
# Backend (Jest + Supertest)
cd backend && npm test

# AI service (pytest)
cd ai-services && pytest tests/ -v
```

---

## Deploying

The setup I used: MongoDB Atlas (free tier) for the database, Render for the backend and AI service, and Vercel for the frontend.

Deploy in this order: database first, then AI service, then backend (it needs the AI service URL), then frontend (it needs the backend URL).

`backend/render.yaml` has the Render config already set up. `frontend/vercel.json` handles SPA routing and security headers for Vercel.

---

## Notes

- This is not for real medical emergencies. Always call 911.
- HuggingFace free tier has rate limits — fine for development, not for production traffic.
- If you're handling real patient data, talk to a lawyer about HIPAA compliance before deploying.
# Medical_Website_With_Chatbot
