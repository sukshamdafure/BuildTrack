const mongoose = require("mongoose");

const materialSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project is required"],
    },

    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true,
      maxlength: [100, "Material name cannot exceed 100 characters"],
    },

    unit: {
      type: String,
      required: [true, "Material unit is required"],
      trim: true,
    },

    initialQuantity: {
      type: Number,
      required: [true, "Initial quantity is required"],
      min: [0, "Initial quantity cannot be negative"],
    },

    usedQuantity: {
      type: Number,
      default: 0,
      min: [0, "Used quantity cannot be negative"],
    },

    remainingQuantity: {
      type: Number,
      default: 0,
      min: [0, "Remaining quantity cannot be negative"],
    },

    minimumStockLevel: {
      type: Number,
      required: [true, "Minimum stock level is required"],
      min: [0, "Minimum stock level cannot be negative"],
    },

    supplier: {
      type: String,
      trim: true,
      maxlength: [150, "Supplier name cannot exceed 150 characters"],
    },

    cost: {
      type: Number,
      required: [true, "Material cost is required"],
      min: [0, "Material cost cannot be negative"],
    },
  },

  {
    timestamps: true,
  },
);

/*
    Calculate remaining quantity before saving
*/

materialSchema.pre("save", async function () {
  this.remainingQuantity = this.initialQuantity - this.usedQuantity;

  if (this.remainingQuantity < 0) {
    throw new Error("Used quantity cannot exceed initial quantity");
  }
});

const Material = mongoose.model("Material", materialSchema);

module.exports = Material;
