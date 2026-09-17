import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Hook for managing biometric authentication using WebAuthn API
 * Based on main app implementation - local WebAuthn with password storage
 */

function base64UrlToUint8Array(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

function uint8ArrayToBase64Url(arr) {
  let binary = ''
  for (let i = 0; i < arr.byteLength; i++) {
    binary += String.fromCharCode(arr[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function useBiometricAuth() {
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const abortControllerRef = useRef(null)

  // Check if device supports biometric authentication
  const checkBiometricSupport = useCallback(async () => {
    try {
      if (!window.PublicKeyCredential) {
        setBiometricAvailable(false)
        return false
      }

      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      setBiometricAvailable(available)

      // Check if user has biometric enabled for this email
      const email = 'mehtaportfolio28@gmail.com'
      const normalizedEmail = email.toLowerCase()
      const enabled = localStorage.getItem(`biometric_enabled_${normalizedEmail}`) === 'true'
      setBiometricEnabled(enabled && available)

      return available
    } catch (error) {
      console.error('Biometric support check failed:', error)
      setBiometricAvailable(false)
      return false
    }
  }, [])

  // Register biometric credential
  const registerBiometric = useCallback(async (userEmail, password) => {
    try {
      const normalizedEmail = userEmail.toLowerCase()

      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn not supported on this device')
      }

      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      const publicKey = {
        challenge,
        rp: {
          name: 'Portfolio Tracker',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode(normalizedEmail),
          name: normalizedEmail,
          displayName: normalizedEmail,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' }, // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      }

      const credential = await navigator.credentials.create({ publicKey })

      if (!credential) {
        throw new Error('Biometric registration cancelled')
      }

      if (!credential.id) {
        throw new Error('Invalid credential received')
      }

      // Store credential ID (already a string from browser)
      const credentialId = credential.id
      localStorage.setItem(`biometric_credential_${normalizedEmail}`, credentialId)
      localStorage.setItem(`biometric_password_${normalizedEmail}`, password)
      localStorage.setItem(`biometric_enabled_${normalizedEmail}`, 'true')

      setBiometricEnabled(true)
      return true
    } catch (error) {
      console.error('Biometric registration error:', error)
      const normalizedEmail = userEmail.toLowerCase()
      localStorage.removeItem(`biometric_credential_${normalizedEmail}`)
      localStorage.removeItem(`biometric_password_${normalizedEmail}`)
      localStorage.removeItem(`biometric_enabled_${normalizedEmail}`)
      throw error
    }
  }, [])

  // Authenticate with biometric
  const authenticateWithBiometric = useCallback(async (userEmail) => {
    try {
      const normalizedEmail = userEmail.toLowerCase()

      // Prevent concurrent requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      setIsAuthenticating(true)

      const storedCredentialId = localStorage.getItem(`biometric_credential_${normalizedEmail}`)
      if (!storedCredentialId || storedCredentialId.trim() === '') {
        throw new Error('Biometric not registered for this account')
      }

      if (!window.PublicKeyCredential) {
        throw new Error('WebAuthn not supported')
      }

      // Convert stored credential ID to Uint8Array
      const credentialId = base64UrlToUint8Array(storedCredentialId)

      const challenge = new Uint8Array(32)
      crypto.getRandomValues(challenge)

      const publicKey = {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
        allowCredentials: [
          {
            id: credentialId,
            type: 'public-key',
            transports: ['internal'],
          },
        ],
      }

      let assertion
      try {
        assertion = await navigator.credentials.get({
          publicKey,
          signal: abortControllerRef.current.signal,
        })
      } catch (err) {
        // Fallback: retry without allowCredentials
        if (err.name === 'NotAllowedError') {
          console.warn('Retrying biometric without allowCredentials')
          assertion = await navigator.credentials.get({
            publicKey: { ...publicKey, allowCredentials: undefined },
            signal: abortControllerRef.current.signal,
          })
        } else {
          throw err
        }
      }

      if (!assertion) {
        throw new Error('Biometric authentication failed')
      }

      // Get stored password for auto-login
      const storedPassword = localStorage.getItem(`biometric_password_${normalizedEmail}`)
      if (!storedPassword) {
        throw new Error('Biometric setup incomplete - password missing')
      }

      // Create session token
      const sessionToken = `biometric_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 days

      sessionStorage.setItem(`biometric_session_${normalizedEmail}`, sessionToken)
      localStorage.setItem(
        `biometric_session_${normalizedEmail}`,
        JSON.stringify({
          token: sessionToken,
          expiresAt,
          email: normalizedEmail,
          lastUsed: Date.now(),
        })
      )

      localStorage.setItem(`biometric_last_auth_${normalizedEmail}`, Date.now().toString())

      setIsAuthenticating(false)
      return { success: true, sessionToken, email: normalizedEmail, password: storedPassword }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Biometric authentication cancelled')
      } else {
        console.error('Biometric authentication error:', error)
      }
      setIsAuthenticating(false)
      throw error
    }
  }, [])

  // Check if session is valid
  const isSessionValid = useCallback((userEmail, inactivityTimeoutMs = 15 * 60 * 1000) => {
    try {
      const normalizedEmail = userEmail.toLowerCase()
      const sessionData = localStorage.getItem(`biometric_session_${normalizedEmail}`)
      if (!sessionData) {
        return false
      }

      const { expiresAt, lastUsed } = JSON.parse(sessionData)
      const now = Date.now()

      if (now > expiresAt) {
        clearBiometricSession(normalizedEmail)
        return false
      }

      if (now - lastUsed > inactivityTimeoutMs) {
        clearBiometricSession(normalizedEmail)
        return false
      }

      // Update last used time
      const updated = JSON.parse(sessionData)
      updated.lastUsed = now
      localStorage.setItem(`biometric_session_${normalizedEmail}`, JSON.stringify(updated))

      return true
    } catch (error) {
      console.error('Session validation error:', error)
      return false
    }
  }, [])

  // Clear biometric session
  const clearBiometricSession = useCallback((userEmail) => {
    const normalizedEmail = userEmail.toLowerCase()
    localStorage.removeItem(`biometric_session_${normalizedEmail}`)
    localStorage.removeItem(`biometric_last_auth_${normalizedEmail}`)
    sessionStorage.removeItem(`biometric_session_${normalizedEmail}`)
  }, [])

  // Disable biometric
  const disableBiometric = useCallback((userEmail) => {
    try {
      const normalizedEmail = userEmail.toLowerCase()
      localStorage.removeItem(`biometric_credential_${normalizedEmail}`)
      localStorage.removeItem(`biometric_enabled_${normalizedEmail}`)
      localStorage.removeItem(`biometric_password_${normalizedEmail}`)
      localStorage.removeItem(`biometric_session_${normalizedEmail}`)
      sessionStorage.removeItem(`biometric_session_${normalizedEmail}`)
      clearBiometricSession(normalizedEmail)

      setBiometricEnabled(false)
      return true
    } catch (error) {
      console.error('Error disabling biometric:', error)
      return false
    }
  }, [clearBiometricSession])

  // Initialize on mount
  useEffect(() => {
    checkBiometricSupport()
  }, [checkBiometricSupport])

  return {
    biometricAvailable,
    biometricEnabled,
    isAuthenticating,
    checkBiometricSupport,
    registerBiometric,
    authenticateWithBiometric,
    isSessionValid,
    disableBiometric,
    clearBiometricSession,
  }
}
