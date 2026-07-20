const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId, ref: "User",
      required: [true, "Patient ID is required"],
    },
    doctorName: {
      type: String, required: [true, "Doctor name is required"],
      trim: true, maxlength: [100, "Doctor name cannot exceed 100 characters"],
    },
    specialty: {
      type: String, required: [true, "Specialty is required"],
      enum: [
        "General Practice", "Cardiology", "Dermatology", "Endocrinology",
        "Gastroenterology", "Neurology", "Oncology", "Orthopedics",
        "Pediatrics", "Psychiatry", "Pulmonology", "Urology", "Other",
      ],
      default: "General Practice",
    },
    appointmentDate: {
      type: Date, required: [true, "Appointment date is required"],
      validate: {
        validator: function (date) { return date > new Date(); },
        message: "Appointment date must be in the future",
      },
    },
    duration:  { type: Number, default: 30, enum: [15, 30, 45, 60, 90] },
    type:      { type: String, enum: ["in-person", "telemedicine", "follow-up", "emergency"], default: "in-person" },
    status: {
      type: String,
      enum: { values: ["pending", "confirmed", "cancelled", "completed", "no-show"], message: "Invalid status" },
      default: "pending",
    },
    reason:      { type: String, trim: true, maxlength: [500, "Reason cannot exceed 500 characters"] },
    notes:       { type: String, trim: true, maxlength: [1000, "Notes cannot exceed 1000 characters"] },
    adminNotes:  { type: String, trim: true, maxlength: [1000, "Admin notes cannot exceed 1000 characters"], select: false },
    symptoms:    [{ type: String, trim: true, maxlength: 100 }],
    triageScore: { type: Number, min: 0, max: 10 },
    urgencyLevel: {
      type: String,
      enum: ["emergency", "urgent", "semi_urgent", "non_urgent", "self_care", "unknown"],
    },
    cancelledBy:         { type: String, enum: ["patient", "admin", "doctor", "system"] },
    cancellationReason:  { type: String, trim: true, maxlength: 500 },
    reminderSent:        { type: Boolean, default: false },
    confirmedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

appointmentSchema.index({ patientId: 1, appointmentDate: -1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });
appointmentSchema.index({ doctorName: 1, appointmentDate: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ createdAt: -1 });

appointmentSchema.virtual("endTime").get(function () {
  if (!this.appointmentDate) return null;
  const end = new Date(this.appointmentDate);
  end.setMinutes(end.getMinutes() + (this.duration || 30));
  return end;
});

appointmentSchema.virtual("isUpcoming").get(function () {
  return this.appointmentDate > new Date() && this.status !== "cancelled";
});

appointmentSchema.statics.checkConflict = async function (
  doctorName, appointmentDate, duration = 30, excludeId = null
) {
  const startTime = new Date(appointmentDate);
  const endTime   = new Date(appointmentDate);
  endTime.setMinutes(endTime.getMinutes() + duration);

  const query = {
    doctorName,
    status: { $in: ["pending", "confirmed"] },
    $or: [
      { appointmentDate: { $gte: startTime, $lt: endTime } },
      {
        $and: [
          { appointmentDate: { $lte: startTime } },
          {
            $expr: {
              $gt: [
                { $add: ["$appointmentDate", { $multiply: ["$duration", 60000] }] },
                startTime.getTime(),
              ],
            },
          },
        ],
      },
    ],
  };

  if (excludeId) query._id = { $ne: excludeId };
  return this.findOne(query);
};

appointmentSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    if (this.status === "confirmed" && !this.confirmedAt) this.confirmedAt = new Date();
    if (this.status === "completed" && !this.completedAt) this.completedAt = new Date();
    if (this.status === "cancelled" && !this.cancelledAt)  this.cancelledAt  = new Date();
  }
  next();
});

module.exports = mongoose.model("Appointment", appointmentSchema);