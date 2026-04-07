export type SuperUserRole = 'superuser' | 'admin' | 'user'
export type SuperUserStatus = 'active' | 'inactive' | 'pending'

export interface SuperUser {
	id: string
	name: string
	email: string
	role: SuperUserRole
	registrationDate: string
	lastLogin: string
	status: SuperUserStatus
	department: string
	phone: string
}
