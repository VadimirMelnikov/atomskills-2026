// src/App.tsx
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import ruRU from 'antd/locale/ru_RU'

import Auth from './pages/Auth/Auth'
import Users from './pages/Users'
import DocumentEditorPage from './pages/DocumentEditorPage'
import Profile_true from './pages/Profile_true'
import Superuser from './pages/Superuser/Superuser'
import { PrivateLayout } from './components/Layouts/PrivateLayout'
import { useAuth } from './hooks/useAuth'

// Импорт страниц проводника
import FilesPage from './pages/Files/FilesPage'

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { isLoading, isAuthenticated } = useAuth()
	if (isLoading) {
		return (
			<div style={{ padding: 100, textAlign: 'center' }}>
				<Spin size='large' description='Загрузка...' />
			</div>
		)
	}
	if (!isAuthenticated) {
		return <Navigate to='/auth' replace />
	}
	return <PrivateLayout>{children}</PrivateLayout>
}

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const { isLoading, isAuthenticated, user } = useAuth()
	if (isLoading) {
		return (
			<div style={{ padding: 100, textAlign: 'center' }}>
				<Spin size='large' description='Загрузка...' />
			</div>
		)
	}
	if (isAuthenticated) {
		return <Navigate to={user?.is_superuser ? '/superuser' : '/files/shared'} replace />
	}
	return (
		<div style={{ minHeight: '100vh', background: '#e6f7ff' }}>
			{children}
		</div>
	)
}

/** Главная и неизвестные пути: обычный пользователь — общие документы, суперпользователь — панель. */
const HomeRedirect: React.FC = () => {
	const { isLoading, isAuthenticated, user } = useAuth()
	if (isLoading) {
		return (
			<div style={{ padding: 100, textAlign: 'center' }}>
				<Spin size='large' description='Загрузка...' />
			</div>
		)
	}
	if (!isAuthenticated) {
		return <Navigate to='/auth' replace />
	}
	if (user?.is_superuser) {
		return <Navigate to='/superuser' replace />
	}
	return <Navigate to='/files/shared' replace />
}

function App() {
	return (
		<ConfigProvider locale={ruRU}>
			<Routes>
				<Route path='/' element={<HomeRedirect />} />

				<Route path='/auth' element={<PublicRoute><Auth /></PublicRoute>} />

				{/* --- Маршруты Проводника (3 категории) --- */}
				<Route path='/files' element={<Navigate to='/files/shared' replace />} />
				
				<Route path='/files/my' element={
					<ProtectedRoute><FilesPage /></ProtectedRoute>
				} />
				
				<Route path='/files/shared' element={
					<ProtectedRoute><FilesPage /></ProtectedRoute>
				} />
				
				<Route path='/files/available' element={
					<ProtectedRoute><FilesPage /></ProtectedRoute>
				} />

				<Route path='/files/to_be_approved' element={
					<ProtectedRoute><FilesPage /></ProtectedRoute>
				} />

				{/* --- Старые маршруты --- */}
				<Route path='/users' element={<ProtectedRoute><Users /></ProtectedRoute>} />
				<Route path='/document' element={<ProtectedRoute><DocumentEditorPage /></ProtectedRoute>} />
				<Route path='/profile_true' element={<ProtectedRoute><Profile_true /></ProtectedRoute>} />
				<Route path='/superuser' element={<ProtectedRoute><Superuser /></ProtectedRoute>} />
				
				<Route path='*' element={<HomeRedirect />} />
			</Routes>
		</ConfigProvider>
	)
}

export default App