const mongoose = require('mongoose');

const cursorSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  edad: {
    type: Number,
    required: [true, 'La edad es obligatoria'],
    min: [1, 'La edad mínima es 1']
  },
  ciudad: {
    type: String,
    required: [true, 'La ciudad es obligatoria'],
    trim: true
  },
  fechaCreacion: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt
});

const Cursor = mongoose.model('Cursor', cursorSchema);

module.exports = Cursor; 