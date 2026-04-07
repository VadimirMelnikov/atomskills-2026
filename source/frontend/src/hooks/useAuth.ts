import { useEffect, useState, useCallback } from 'react'
import { useGetCurrentUserQuery, useLogoutMutation } from '../store/api/userApi'
import { documentApi } from '../store/api/documentApi'
import { dataApi } from '../store/api/dataApi'
import { userApi } from '../store/api/userApi'
import { store } from '../store'
import type { AuthState } from '../types/auth.interface'

export const useAuth = (): AuthState => {
	const [isRestoring, setIsRestoring] = useState(true)
	const [logoutApi] = useLogoutMutation()

	const {
		data: user,
		isLoading,
		isError,
		error: apiError,
		refetch,
	} = useGetCurrentUserQuery(undefined)

	const isAuthenticated = !!user && !isError

	useEffect(() => {
		if (user !== undefined || isError) {
			setIsRestoring(false)
		}
	}, [user, isError])

	const refreshUser = useCallback(() => refetch(), [refetch])

	const logout = useCallback(async () => {
		try {
			await logoutApi().unwrap()
		} catch {
		} finally {
			// Clear RTK Query cache for all APIs
			store.dispatch(documentApi.util.resetApiState())
			store.dispatch(dataApi.util.resetApiState())
			store.dispatch(userApi.util.resetApiState())
			
			document.cookie = 'access_token=; Max-Age=0; path=/'
			document.cookie = 'csrf_access_token=; Max-Age=0; path=/'
			window.location.href = '/auth'
		}
	}, [logoutApi])

	const getUserDisplayName = useCallback(() => {
		if (!user) return ''
		const parts = [user.first_name, user.second_name, user.surname].filter(Boolean)
		return parts.join(' ') || user.login
	}, [user])

	return {
		isAuthenticated,
		isRestoring,
		isLoading,
		error: apiError
			? (apiError as any)?.message || 'Ошибка аутентификации'
			: null,
		user: user ? {
			id: user.id,
			name: getUserDisplayName(),
			login: user.login,
			first_name: user.first_name,
			second_name: user.second_name,
			surname: user.surname,
			is_superuser: Boolean(user.is_superuser),
		} : null,
		refreshUser,
		logout,
		getUserName: getUserDisplayName,
		getUserId: () => user?.id || null,
	}
}
