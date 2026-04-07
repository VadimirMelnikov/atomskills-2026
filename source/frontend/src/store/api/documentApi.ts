import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export interface ExtendedDocumentResponse {
    id: number
    name: string
    status?: 'draft' | 'approved' | 'under_approval' | 'refusal' | 'archived'
    owner_id?: string
    is_owner?: boolean
    can_edit?: boolean
    can_comment?: boolean
    file_size?: number
    updated_at?: string
}

/** Ответ GET /api/document?type=to_be_approved */
export interface DocumentToApproveResponse {
    id: number
    name: string
    version: number
    /** id строки versions — стабильный уникальный ключ для списка */
    version_id: number
    status: string
    approved: boolean | null
    owner_id?: string
}

// Типы для пользователей
export interface User {
  id: string
  name: string
}

export interface DocumentMember {
  user_id: string
  name: string
  user_role: string
}

export interface DocumentApprover {
  user_id: string
  name: string
  approved: boolean | null
  reason_for_refusal: string | null
}

export interface ShareDocumentRequest {
  user_id: string
  user_role: string
}

export interface MoveToApprovalRequest {
  approve_method: 'simple' | 'strict'
  approvers: string[]
}

export interface ApproveDocumentRequest {
  approved: boolean
  reason_for_refusal?: string | null
}

export interface DocumentVersionRefusalEntry {
  reviewer_name: string
  reason: string | null
}

export interface DocumentVersion {
  id: number
  version: number
  status: string
  s3_url: string
  created_at: string
  /** Заполняется для версий со статусом refusal — видно всем, кто запрашивает историю версий */
  refusal_entries?: DocumentVersionRefusalEntry[] | null
}

// 🔹 Добавляем типы для создания и импорта документов
export interface CreateDocumentRequest {
  name: string
}

export interface ImportDocumentRequest {
  name: string
  file: File
}

export interface DocumentResponseScheme {
  id: number
  name: string
}

type GetDocumentEditorConfigArg = number | { docId: number; version?: number }

const baseQuery = fetchBaseQuery({
  baseUrl: '',
  credentials: 'include',
  prepareHeaders: headers => {
    headers.set('Content-Type', 'application/json')
    return headers
  },
})

const baseQueryWithReauth = async (args: any, api: any, extraOptions: any) => {
  const result = await baseQuery(args, api, extraOptions)

  const url = typeof args === 'string' ? args : args?.url || ''

  const isAuthCheckEndpoint =
    url.includes('/me') || url.includes('/login')

  if (result.error?.status === 401 && !isAuthCheckEndpoint) {
    window.location.href = '/auth'
  }

  return result
}

export const documentApi = createApi({
  reducerPath: 'documentApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Documents', 'DocumentMembers', 'DocumentApprovers', 'DocumentVersions'],
  endpoints: builder => ({
    // 🔹 Получение документов - ИСПРАВЛЕНО: /api/document вместо /api/documents
    getDocuments: builder.query<ExtendedDocumentResponse[], string>({
        query: (type) => `/api/document?type=${type}`,
        providesTags: ['Documents'],
    }),

    // 🔹 Создание документа
    createDocument: builder.mutation<DocumentResponseScheme, CreateDocumentRequest>({
      query: (data) => ({
        url: '/api/document',  // ← правильно
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Documents'],
    }),

    // 🔹 Импорт документа (загрузка файла)
    importDocument: builder.mutation<DocumentResponseScheme, ImportDocumentRequest>({
      query: ({ name, file }) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('name', name)
        
        return {
          url: '/api/document',  // ← правильно (PUT метод)
          method: 'PUT',
          body: formData,
        }
      },
      invalidatesTags: ['Documents'],
    }),

    // 🔹 Получение конфига редактора
    getDocumentEditorConfig: builder.query<any, GetDocumentEditorConfigArg>({
      query: (arg) => {
        if (typeof arg === 'number') return `/api/document/${arg}`
        const versionPart =
          arg.version != null && Number.isFinite(arg.version) ? `?version=${encodeURIComponent(String(arg.version))}` : ''
        return `/api/document/${arg.docId}${versionPart}`
      }, // ← backend принимает Query параметр `version`
      providesTags: ['Documents'],
    }),

    // 🔹 Получение участников документа
    getDocumentMembers: builder.query<DocumentMember[], number>({
      query: (docId) => `/api/document/${docId}/members`,  // ← правильно
      providesTags: (result, _error, docId) => 
        result ? [{ type: 'DocumentMembers', id: docId }] : [],
    }),

    // 🔹 Получение апруверов документа
    getDocumentApprovers: builder.query<DocumentApprover[], number>({
      query: (docId) => `/api/document/${docId}/approvers`,  // ← правильно
      providesTags: (result, _error, docId) => 
        result ? [{ type: 'DocumentApprovers', id: docId }] : [],
    }),

    // 🔹 Добавление доступа к документу
    shareDocument: builder.mutation<void, { docId: number; data: ShareDocumentRequest }>({
      query: ({ docId, data }) => ({
        url: `/api/document/${docId}/share`,  // ← правильно
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { docId }) => [
        { type: 'DocumentMembers', id: docId }
      ],
    }),

    // 🔹 Массовое добавление доступа
    shareDocumentBatch: builder.mutation<void, { docId: number; users: ShareDocumentRequest[] }>({
      query: ({ docId, users }) => ({
        url: `/api/document/${docId}/share/batch`,  // ← правильно
        method: 'POST',
        body: { users },
      }),
      invalidatesTags: (_result, _error, { docId }) => [
        { type: 'DocumentMembers', id: docId }
      ],
    }),

    // 🔹 Удаление доступа
    unshareDocument: builder.mutation<void, { docId: number; userId: string }>({
      query: ({ docId, userId }) => ({
        url: `/api/document/${docId}/share/${userId}`,  // ← правильно
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { docId }) => [
        { type: 'DocumentMembers', id: docId }
      ],
    }),

    // 🔹 Обновление роли пользователя
    updateDocumentMember: builder.mutation<void, { docId: number; data: ShareDocumentRequest }>({
      query: ({ docId, data }) => ({
        url: `/api/document/${docId}/share`,  // ← правильно
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (_result, _error, { docId }) => [
        { type: 'DocumentMembers', id: docId }
      ],
    }),

    getDocumentVersions: builder.query<DocumentVersion[], number>({
      query: (docId) => `/api/document/${docId}/versions`,
      providesTags: (_result, _error, docId) =>
        [{ type: 'DocumentVersions', id: docId }],
    }),

    createNewVersion: builder.mutation<DocumentVersion, number>({
      query: (docId) => ({
        url: `/api/document/${docId}/version`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, docId) => [
        { type: 'DocumentVersions', id: docId },
      ],
    }),

    moveToApproval: builder.mutation<void, { docId: number; data: MoveToApprovalRequest }>({
      query: ({ docId, data }) => ({
        url: `/api/document/${docId}/move_to_approval`,  // ← правильно
        method: 'POST',
        body: data,
      }),
      invalidatesTags: (_result, _error, { docId }) => [
        { type: 'DocumentApprovers', id: docId },
        { type: 'DocumentVersions', id: docId },
        { type: 'Documents' },
      ],
    }),

    approveDocument: builder.mutation<void, { docId: number } & ApproveDocumentRequest>({
      query: ({ docId, approved, reason_for_refusal }) => ({
        url: `/api/document/${docId}/approve`,
        method: 'POST',
        body: { approved, reason_for_refusal: reason_for_refusal ?? null },
      }),
      invalidatesTags: (_result, _error, { docId }) => [
        { type: 'DocumentApprovers', id: docId },
        { type: 'DocumentVersions', id: docId },
        'Documents',
      ],
    }),
  }),
})

export const {
  useGetDocumentsQuery,
  useCreateDocumentMutation,
  useImportDocumentMutation,
  useGetDocumentEditorConfigQuery,
  useGetDocumentVersionsQuery,
  useCreateNewVersionMutation,
  useGetDocumentMembersQuery,
  useGetDocumentApproversQuery,
  useShareDocumentMutation,
  useShareDocumentBatchMutation,
  useUnshareDocumentMutation,
  useUpdateDocumentMemberMutation,
  useMoveToApprovalMutation,
  useApproveDocumentMutation,
} = documentApi