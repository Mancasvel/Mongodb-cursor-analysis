const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cursorSchema = new Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  edad: {
    type: Number,
    required: [true, 'La edad es obligatoria'],
    min: [0, 'La edad debe ser mayor o igual a 0'],
    max: [120, 'La edad debe ser menor o igual a 120']
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

// Añadir índices para mejorar el rendimiento
// Índice en ciudad para mejorar filtros por ciudad
cursorSchema.index({ ciudad: 1 });

// Índice en edad para mejorar filtros por edad
cursorSchema.index({ edad: 1 });

// Índice en fechaCreacion para mejorar ordenamiento
cursorSchema.index({ fechaCreacion: -1 });

// Índice compuesto para consultas que filtran por ciudad y ordenan por fechaCreacion
cursorSchema.index({ ciudad: 1, fechaCreacion: -1 });

const Cursor = mongoose.model('Cursor', cursorSchema);

module.exports = Cursor; 