import { create } from 'zustand'
import client from '../api/client'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  refreshToken: localStorage.getItem('refresh_token'),
  isAuthenticated: !!localStorage.getItem('access_token'),
  isLoading: false,

  login: async (username, password) => {
    set({ isLoading: true })
    try {
      const { data } = await client.post('/auth/login', { username, password })
      localStorage.setItem('access_token', data.access_token)
      localStorage.setItem('refresh_token', data.refresh_token)

      // Fetch user info
      const { data: user } = await client.get('/auth/me')

      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user,
        isAuthenticated: true,
        isLoading: false,
      })
      return { success: true }
    } catch (error) {
      set({ isLoading: false })
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      }
    }
  },

  logout: () => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
    })
  },

  fetchUser: async () => {
    if (!get().accessToken) return
    try {
      const { data } = await client.get('/auth/me')
      set({ user: data, isAuthenticated: true })
    } catch {
      get().logout()
    }
  },

  setTheme: (theme) => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  },

  toggleTheme: () => {
    const current = document.documentElement.getAttribute('data-theme')
    const next = current === 'dark' ? 'light' : 'dark'
    get().setTheme(next)
  },
}))

export default useAuthStore
