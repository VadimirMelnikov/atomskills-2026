export type FileType = 'doc' | 'folder' | 'pdf' | 'xlsx' | 'image' | 'txt' | 'ppt' | 'zip' | 'other'

export interface FileItem {
  id: string
  name: string
  type: FileType
  updatedAt: string
  size: string
  status: 'draft' | 'approved' | 'review' | 'refusal' | 'archived'
  owner?: string
  permissions?: {
    canView: boolean
    canEdit: boolean
    canComment: boolean
  }
  version?: number
  /** id версии в БД; для «На согласовании» — уникальный ключ строки (несколько версий одного документа) */
  versionId?: number
  /** Для списка «На согласовании»: решение текущего пользователя (null — ещё не голосовал) */
  approverApproved?: boolean | null
  parentId?: string | null
  category?: 'shared' | 'my' | 'available' | 'to_be_approved'
  author?: string
  path?: string
}