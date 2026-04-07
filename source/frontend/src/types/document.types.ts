export interface DocumentRequest {
	name: string
}

export interface DocumentResponse {
	id: number
	name: string
}

export interface Document {
	id: number
	name: string
	createdAt?: string
	updatedAt?: string
	ownerId?: string
	status?: 'draft' | 'approved' | 'review' | 'archived'
	version?: number
	approved?: boolean
}