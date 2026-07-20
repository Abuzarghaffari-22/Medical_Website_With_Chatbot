import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { appointmentsAPI } from '../api'
import { FormField, Spinner } from '../components/common'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'

const DOCTORS = [
  { name: 'Dr. Sarah Chen',       specialty: 'General Practice', emoji: '👩‍⚕️' },
  { name: 'Dr. James Wilson',     specialty: 'Cardiology',       emoji: '❤️' },
  { name: 'Dr. Amara Okonkwo',   specialty: 'Dermatology',      emoji: '🌿' },
  { name: 'Dr. Michael Torres',   specialty: 'Pediatrics',       emoji: '👶' },
  { name: 'Dr. Emily Park',       specialty: 'Neurology',        emoji: '🧠' },
  { name: 'Dr. Richard Lee',      specialty: 'Orthopedics',      emoji: '🦴' },
]

const STEP_LABELS = ['Doctor', 'Date & Time', 'Details', 'Confirm']

export default function BookAppointment() {
  const navigate = useNavigate()
  const [step, setStep]               = useState(0)
  const [loading, setLoading]         = useState(false)
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [availableSlots, setAvailableSlots] = useState([])

  const [form, setForm] = useState({
    doctorName:      '',
    specialty:       '',
    appointmentDate: '',
    selectedDate:    '',
    selectedSlot:    '',
    duration:        30,
    type:            'in-person',
    reason:          '',
    symptoms:        '',
  })
  const [errors, setErrors] = useState({})

  const set = (field, value) => {
    setForm(p => ({ ...p, [field]: value }))
    setErrors(p => ({ ...p, [field]: '' }))
  }

  const selectDoctor = (doc) => {
    setForm(p => ({ ...p, doctorName: doc.name, specialty: doc.specialty }))
    setErrors(p => ({ ...p, doctorName: '' }))
  }

  const fetchSlots = async (date) => {
    if (!form.doctorName || !date) return
    setSlotsLoading(true)
    try {
      const res = await appointmentsAPI.getAvailableSlots(form.doctorName, date)
      setAvailableSlots(res.data.slots || [])
    } catch {
      setAvailableSlots([])
    } finally {
      setSlotsLoading(false)
    }
  }

  const handleDateChange = (date) => {
    set('selectedDate', date)
    set('selectedSlot', '')
    set('appointmentDate', '')
    fetchSlots(date)
  }

  const selectSlot = (slot) => {
    set('selectedSlot', slot.time)
    set('appointmentDate', slot.time)
  }

  const validateStep = () => {
    const errs = {}
    if (step === 0 && !form.doctorName) errs.doctorName = 'Please select a doctor'
    if (step === 1) {
      if (!form.selectedDate)    errs.selectedDate = 'Please select a date'
      if (!form.appointmentDate) errs.selectedSlot = 'Please select a time slot'
    }
    if (step === 2 && !form.reason.trim()) errs.reason = 'Please describe the reason for your visit'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleNext = () => { if (validateStep()) setStep(s => s + 1) }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const symptoms = form.symptoms.split(',').map(s => s.trim()).filter(Boolean)
      await appointmentsAPI.create({
        doctorName:      form.doctorName,
        specialty:       form.specialty,
        appointmentDate: form.appointmentDate,
        duration:        form.duration,
        type:            form.type,
        reason:          form.reason,
        symptoms,
      })
      toast.success('Appointment booked successfully! 🎉')
      navigate('/appointments')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Next 14 weekdays
  const dateOptions = Array.from({ length: 21 }, (_, i) => {
    const d = addDays(new Date(), i + 1)
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE, MMM d'), isWeekend: [0, 6].includes(d.getDay()) }
  }).filter(d => !d.isWeekend).slice(0, 14)

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="section-title">Book an Appointment</h2>
        <p className="text-slate-500 text-sm mt-1">Schedule a visit with one of our specialist physicians.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex items-center gap-2 ${i < step ? 'text-primary-600' : i === step ? 'text-primary-700' : 'text-slate-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all duration-200
                ${i < step   ? 'bg-primary-600 border-primary-600 text-white'
                  : i === step ? 'border-primary-600 text-primary-600'
                  : 'border-slate-200 text-slate-400'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-sm font-medium hidden sm:block">{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full transition-colors duration-200 ${i < step ? 'bg-primary-600' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      <div className="card p-6">
        {/* Step 0: Choose Doctor */}
        {step === 0 && (
          <div className="animate-fade-in space-y-4">
            <h3 className="font-semibold text-slate-900">Choose your doctor</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOCTORS.map(doc => (
                <button key={doc.name} onClick={() => selectDoctor(doc)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150
                    ${form.doctorName === doc.name ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-primary-200 hover:bg-slate-50'}`}>
                  <span className="text-3xl">{doc.emoji}</span>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{doc.name}</p>
                    <p className="text-xs text-slate-500">{doc.specialty}</p>
                  </div>
                  {form.doctorName === doc.name && <span className="ml-auto text-primary-600">✓</span>}
                </button>
              ))}
            </div>
            {errors.doctorName && <p className="error-msg">{errors.doctorName}</p>}
          </div>
        )}

        {/* Step 1: Date & Time */}
        {step === 1 && (
          <div className="animate-fade-in space-y-5">
            <h3 className="font-semibold text-slate-900">Select date & time</h3>
            <FormField label="Available Dates (weekdays only)" error={errors.selectedDate}>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {dateOptions.map(d => (
                  <button key={d.value} onClick={() => handleDateChange(d.value)}
                    className={`p-2.5 rounded-xl text-center border-2 text-xs font-medium transition-all duration-150
                      ${form.selectedDate === d.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:border-primary-200 text-slate-700'}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </FormField>

            {form.selectedDate && (
              <FormField label="Available Time Slots" error={errors.selectedSlot}>
                {slotsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                    <Spinner size="sm" /> Loading slots...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">
                    No available slots on this day. Please choose another date.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {availableSlots.map(slot => (
                      <button key={slot.time} onClick={() => selectSlot(slot)}
                        className={`py-2 px-2 rounded-xl border-2 text-xs font-medium transition-all duration-150
                          ${form.selectedSlot === slot.time ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 hover:border-teal-200 text-slate-700'}`}>
                        {slot.label}
                      </button>
                    ))}
                  </div>
                )}
              </FormField>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Duration">
                <select className="input" value={form.duration} onChange={e => set('duration', Number(e.target.value))}>
                  {[15, 30, 45, 60].map(d => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </FormField>
              <FormField label="Visit Type">
                <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="in-person">In-person</option>
                  <option value="telemedicine">Telemedicine</option>
                  <option value="follow-up">Follow-up</option>
                </select>
              </FormField>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="animate-fade-in space-y-4">
            <h3 className="font-semibold text-slate-900">Visit details</h3>
            <FormField label="Reason for visit" error={errors.reason} required>
              <textarea
                className={`input resize-none ${errors.reason ? 'input-error' : ''}`}
                rows={3}
                placeholder="e.g., Annual checkup, follow-up for blood test results..."
                value={form.reason}
                onChange={e => set('reason', e.target.value)}
              />
            </FormField>
            <FormField label="Current symptoms (optional, comma-separated)">
              <input className="input"
                placeholder="e.g., headache, fever, fatigue"
                value={form.symptoms}
                onChange={e => set('symptoms', e.target.value)} />
              <p className="text-xs text-slate-400 mt-1">Sharing symptoms helps us prepare better for your visit.</p>
            </FormField>
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              ⚕️ <strong>Medical Advisory:</strong> This booking is not a substitute for emergency care. If you are experiencing a medical emergency, call 911 immediately.
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="animate-fade-in space-y-4">
            <h3 className="font-semibold text-slate-900">Confirm your appointment</h3>
            <div className="bg-slate-50 rounded-xl p-5 space-y-3">
              {[
                { label: 'Doctor',     value: form.doctorName },
                { label: 'Specialty',  value: form.specialty },
                { label: 'Date & Time', value: form.appointmentDate ? format(new Date(form.appointmentDate), 'EEEE, MMMM d yyyy @ h:mm a') : '—' },
                { label: 'Duration',   value: `${form.duration} minutes` },
                { label: 'Type',       value: form.type },
                { label: 'Reason',     value: form.reason },
                ...(form.symptoms ? [{ label: 'Symptoms', value: form.symptoms }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-3 text-sm">
                  <span className="text-slate-500 w-28 flex-shrink-0">{label}</span>
                  <span className="font-medium text-slate-800">{value}</span>
                </div>
              ))}
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
              ℹ️ You'll receive a confirmation. You can cancel up to 2 hours before the appointment.
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className={`flex mt-6 pt-5 border-t border-slate-100 ${step > 0 ? 'justify-between' : 'justify-end'}`}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="btn-md btn-secondary">← Back</button>
          )}
          {step < 3 ? (
            <button onClick={handleNext} className="btn-md btn-primary">Continue →</button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} className="btn-md btn-teal">
              {loading ? <Spinner size="sm" /> : '✓ Confirm Booking'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}