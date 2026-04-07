import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Spin } from 'antd'

interface AuthWrapperProps {
	children: React.ReactNode
	requireAuth?: boolean
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({
	children,
	requireAuth = true,
}) => {
	const { isAuthenticated, isRestoring, isLoading } = useAuth()
	const location = useLocation()

	if (isRestoring || isLoading) {
		return (
			<div
				style={{
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					height: '100vh',
					backgroundColor: '#f0f2f5',
				}}
			>
				<Spin size='large' description='Загрузка...' />
			</div>
		)
	}

	if (requireAuth && !isAuthenticated) {
		return <Navigate to='/auth' state={{ from: location }} replace />
	}

	if (!requireAuth && isAuthenticated) {
		return <Navigate to='/users' replace />
	}

	return <>{children}</>
}

export default AuthWrapper
