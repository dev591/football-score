const express = require('express')
const router = express.Router()

router.post('/login', async (req, res) => {
  const { password } = req.body
  
  if (!password) {
    return res.status(400).json({ error: 'Password required' })
  }
  
  if (password === process.env.ADMIN_PASSWORD) {
    return res.json({ success: true })
  } else {
    return res.status(401).json({ error: 'Invalid password' })
  }
})

module.exports = router
