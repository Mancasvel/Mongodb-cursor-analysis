const express = require('express');
const router = express.Router();
const Cursor = require('../models/Cursor');

// Listar todos los cursores (con paginación)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Elementos por página
    const skip = (page - 1) * limit;
    
    const totalCursores = await Cursor.countDocuments();
    const totalPages = Math.ceil(totalCursores / limit);
    
    const cursores = await Cursor.find()
      .sort({ fechaCreacion: -1 })
      .skip(skip)
      .limit(limit);
    
    res.render('cursores/index', { 
      cursores, 
      currentPage: page, 
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: 'Error al obtener los cursores',
      error
    });
  }
});

// Formulario para crear un nuevo cursor
router.get('/nuevo', (req, res) => {
  res.render('cursores/nuevo');
});

// Crear un nuevo cursor
router.post('/', async (req, res) => {
  try {
    const { nombre, edad, ciudad } = req.body;
    const nuevoCursor = new Cursor({
      nombre,
      edad,
      ciudad
    });
    await nuevoCursor.save();
    res.redirect('/cursores');
  } catch (error) {
    console.error(error);
    res.status(400).render('cursores/nuevo', { 
      error: 'Error al crear el cursor',
      cursor: req.body
    });
  }
});

// Formulario para editar un cursor existente
router.get('/:id/editar', async (req, res) => {
  try {
    const cursor = await Cursor.findById(req.params.id);
    if (!cursor) {
      return res.status(404).render('error', { 
        message: 'Cursor no encontrado'
      });
    }
    res.render('cursores/editar', { cursor });
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: 'Error al obtener el cursor',
      error
    });
  }
});

// Actualizar un cursor existente
router.put('/:id', async (req, res) => {
  try {
    const { nombre, edad, ciudad } = req.body;
    const cursor = await Cursor.findByIdAndUpdate(
      req.params.id, 
      { nombre, edad, ciudad },
      { new: true, runValidators: true }
    );
    
    if (!cursor) {
      return res.status(404).render('error', { 
        message: 'Cursor no encontrado'
      });
    }
    
    res.redirect('/cursores');
  } catch (error) {
    console.error(error);
    res.status(400).render('cursores/editar', { 
      error: 'Error al actualizar el cursor',
      cursor: { ...req.body, _id: req.params.id }
    });
  }
});

// Eliminar un cursor
router.delete('/:id', async (req, res) => {
  try {
    const cursor = await Cursor.findByIdAndDelete(req.params.id);
    
    if (!cursor) {
      return res.status(404).render('error', { 
        message: 'Cursor no encontrado'
      });
    }
    
    res.redirect('/cursores');
  } catch (error) {
    console.error(error);
    res.status(500).render('error', { 
      message: 'Error al eliminar el cursor',
      error
    });
  }
});

module.exports = router; 