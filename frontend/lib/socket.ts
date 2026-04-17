import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function initSocket() {
  if (!socket) {
    // Dynamically derive the socket URL from the API_BASE_URL if NEXT_PUBLIC_SOCKET_URL is not set
    // This handles production environments where the domain can't be localhost
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://football-score-production.up.railway.app/api'
    const defaultSocketUrl = API_BASE_URL.replace(/\/api$/, '')
    
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || defaultSocketUrl)
  }
  return socket
}

export function getSocket() {
  return socket || initSocket()
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
