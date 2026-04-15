require('dotenv').config()
const express = require('express')
const http = require('http')
const socketIo = require('socket.io')
const cors = require('cors')

// Import routes
const authRoutes = require('./routes/auth')
const teamsRoutes = require('./routes/teams')
const playersRoutes = require('./routes/players')
const matchesRoutes = require('./routes/matches')
const eventsRoutes = require('./routes/events')
const standingsRoutes = require('./routes/standings')
const importRoutes = require('./routes/importResults')
const lineupsRoutes = require('./routes/lineups')

const app = express()
const server = http.createServer(app)
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

const PORT = process.env.PORT || 4000

// Middleware
app.use(cors())
app.use(express.json())

// Make io available to routes
app.set('io', io)

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/teams', teamsRoutes)
app.use('/api/players', playersRoutes)
app.use('/api/matches', matchesRoutes)
app.use('/api/standings', standingsRoutes)
app.use('/api/import', importRoutes)
app.use('/api/lineups', lineupsRoutes)

// Health check
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'STRIKER API' })
})

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id)
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id)
  })
})

server.listen(PORT, () => {
  console.log(`STRIKER API server running on port ${PORT}`)
})
