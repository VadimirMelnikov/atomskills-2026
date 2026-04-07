import type { FormInstance } from 'antd'

export interface AuthState {
	isAuthenticated: boolean
	isRestoring: boolean
	isLoading: boolean
	error: string | null
	user: {
		id: string
		name: string
		login: string
		first_name: string | null
		second_name: string | null
		surname: string | null
		is_superuser: boolean
	} | null
	refreshUser: () => void
	logout: () => void
	getUserName: () => string
	getUserId: () => string | null
}

export interface AuthRequest {
	name: string
}

export interface AuthResponse {
	access_token?: string
	id: string
	name: string
}

export interface LoginFormProps {
	form: FormInstance
	onFinish: (values: { name: string }) => void
	isActive: boolean
}

export interface AuthRightPanelProps {
	loginForm: FormInstance
	onLoginFinish: (values: { name: string }) => void
}
