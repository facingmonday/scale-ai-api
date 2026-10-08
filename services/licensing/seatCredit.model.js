const mongoose = require("mongoose");
const baseSchema = require("../../lib/baseSchema");

const seatCreditSchema = new mongoose.Schema({
  source: { type: String, enum: ["clerk", "stripe"], required: true },
  referenceId: { type: String, required: true },
  quantity: {
    type: Number,
    required: true,
    validate: (value) => Number.isSafeInteger(value) && value > 0,
  },
  seatPoolId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SeatPool",
    required: true,
  },
}).add(baseSchema);

seatCreditSchema.index(
  { organization: 1, source: 1, referenceId: 1 },
  { unique: true, name: "unique_organization_seat_credit" },
);

module.exports = mongoose.model("SeatCredit", seatCreditSchema);
