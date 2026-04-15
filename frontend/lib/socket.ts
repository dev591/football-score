import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function initSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000')
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
