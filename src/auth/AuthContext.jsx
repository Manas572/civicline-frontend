import { useCallback, useEffect, useMemo, useState } from 'react'
import { authClient, getAccessToken } from './neonAuth.js'
import { api } from '../lib/api.js'
import { AuthContext } from './context.js'

export function AuthProvider({ children }) {
  if (!authClient) {
    return <AuthContext.Provider value={{ configured: false, loading: false, user: null, role: null }}>
      {children}
    </AuthContext.Provider>
  }
  return <NeonSessionProvider>{children}</NeonSessionProvider>
}

function NeonSessionProvider({ children }) {
  const sessionState = authClient.useSession()
  const sessionUser = sessionState.data?.user ?? null
  const [sessionExpired, setSessionExpired] = useState(false)
  const [signedOut, setSignedOut] = useState(false)
  const [loginUser, setLoginUser] = useState(null)
  const user = sessionExpired || signedOut ? null : (sessionUser ?? loginUser)
  const [roleIdentity, setRoleIdentity] = useState(null)
  const [roleErrorState, setRoleErrorState] = useState(null)
  const userId = user?.id

  useEffect(() => {
    if (!userId) return undefined
    let active = true
    api('/api/auth/me')
      .then((identity) => {
        if (!active) return
        if (identity.user_id !== userId) throw new Error('The authenticated identity did not match the API session.')
        setRoleIdentity({ userId, role: identity.role })
        setRoleErrorState(null)
      })
      .catch((error) => { if (active) setRoleErrorState({ userId, message: error.message }) })
    return () => { active = false }
  }, [userId])

  useEffect(() => {
    const expire = () => {
      setLoginUser(null)
      setSignedOut(false)
      setSessionExpired(true)
      void authClient.signOut()
    }
    window.addEventListener('civic-auth-expired', expire)
    return () => window.removeEventListener('civic-auth-expired', expire)
  }, [])

  const login = useCallback(async ({ email, password }) => {
    setSessionExpired(false)
    setSignedOut(false)
    const result = await authClient.signIn.email({ email, password })
    if (result.error) throw new Error(result.error.message || 'Unable to sign in.')
    if (!(await getAccessToken())) throw new Error('Neon Auth did not return an access token for this session.')
    const current = await authClient.getSession()
    setLoginUser(current.data?.user ?? result.data?.user ?? null)
  }, [])

  const loginWithGoogle = useCallback(async () => {
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: `${window.location.origin}/dashboard`,
    })
    if (result?.error) throw new Error(result.error.message || 'Unable to continue with Google.')
  }, [])

  const signup = useCallback(async ({ name, email, password }) => {
    setSessionExpired(false)
    setSignedOut(false)
    const result = await authClient.signUp.email({ name, email, password })
    if (result.error) throw new Error(result.error.message || 'Unable to create the account.')
    const authenticated = Boolean(await getAccessToken())
    if (authenticated) {
      const current = await authClient.getSession()
      setLoginUser(current.data?.user ?? result.data?.user ?? null)
    }
    return {
      authenticated,
      verificationRequired: !authenticated && result.data?.user?.emailVerified !== true,
    }
  }, [])

  const verifyEmailCode = useCallback(async ({ email, otp }) => {
    const result = await authClient.emailOtp.verifyEmail({ email, otp })
    if (result.error) throw new Error(result.error.message || 'That verification code is invalid or expired.')
    return result.data
  }, [])

  const resendVerificationCode = useCallback(async ({ email }) => {
    const result = await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' })
    if (result.error) throw new Error(result.error.message || 'Unable to send a new verification code.')
    return result.data
  }, [])

  const logout = useCallback(async () => {
    const result = await authClient.signOut()
    if (result?.error) throw new Error(result.error.message || 'Unable to sign out.')
    setLoginUser(null)
    setRoleIdentity(null)
    setRoleErrorState(null)
    setSessionExpired(false)
    setSignedOut(true)
  }, [])

  const role = user && roleIdentity?.userId === user.id ? roleIdentity.role : null
  const roleError = user && roleErrorState?.userId === user.id ? roleErrorState.message : ''
  const roleLoading = Boolean(user && role === null && !roleError)

  const value = useMemo(() => ({
    configured: true,
    loading: Boolean(sessionState.isPending || (user && roleLoading)),
    user,
    role,
    roleError,
    sessionExpired,
    login,
    loginWithGoogle,
    signup,
    verifyEmailCode,
    resendVerificationCode,
    logout,
  }), [sessionState.isPending, user, roleLoading, role, roleError, sessionExpired, login, loginWithGoogle, signup, verifyEmailCode, resendVerificationCode, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

