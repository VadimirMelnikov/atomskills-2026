// src/store/api/userApi.ts (добавляем поиск)
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { User } from '../../types/user.types'
import type { AuthRequest, AuthResponse } from '../../types/auth.interface'

// Добавляем тип для поиска
export interface SearchUser {
  id: string
  name: string
}

/** Ответ POST /api/users (импорт Excel) — единый вид для UI */
export type ExcelImportResult = {
	success: boolean
	message: string
	importedCount: number
	failedCount: number
}

/** Совмещает новый ответ API и старый (created/updated/errors). */
function normalizeExcelImportResponse(raw: unknown): ExcelImportResult {
	if (!raw || typeof raw !== 'object') {
		return {
			success: false,
			message: 'Некорректный ответ сервера',
			importedCount: 0,
			failedCount: 0,
		}
	}
	const r = raw as Record<string, unknown>
	if (
		typeof r.success === 'boolean' &&
		typeof r.importedCount !== 'undefined' &&
		typeof r.failedCount !== 'undefined'
	) {
		return {
			success: r.success,
			message: typeof r.message === 'string' ? r.message : '',
			importedCount: Number(r.importedCount),
			failedCount: Number(r.failedCount),
		}
	}
	const created = Number(r.created ?? 0)
	const updated = Number(r.updated ?? 0)
	const skipped = Number(r.skipped ?? 0)
	const errors = Array.isArray(r.errors) ? r.errors : []
	const importedCount = created + updated
	const failedCount = errors.length
	const success = failedCount === 0
	const parts: string[] = []
	if (importedCount > 0) {
		parts.push(`Создано: ${created}, обновлено: ${updated}`)
	} else {
		parts.push('Нет импортированных строк сотрудников')
	}
	if (skipped > 0) parts.push(`Пропущено строк: ${skipped}`)
	if (failedCount > 0) parts.push(`Ошибок при разборе: ${failedCount}`)
	return {
		success,
		message: parts.length > 0 ? parts.join('. ') : 'Импорт завершён',
		importedCount,
		failedCount,
	}
}

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
		window.dispatchEvent(new CustomEvent('unauthorized'))
	}

	return result
}

// src/store/api/userApi.ts - добавьте этот эндпоинт в endpoints

export const userApi = createApi({
  reducerPath: 'userApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: ['Users', 'User', 'Me'],
  endpoints: builder => ({
    getCurrentUser: builder.query<User, void>({
      query: () => '/api/users/me',
      providesTags: ['Me'],
    }),

    getUsers: builder.query<User[], void>({
      query: () => '/api/users/',
      providesTags: ['Users'],
    }),

    searchUsers: builder.query<SearchUser[], string>({
      query: (query) => `/api/users/?name=${encodeURIComponent(query)}`,
      providesTags: ['Users'],
    }),

    // 📤 Загрузка пользователей из Excel
    uploadUsersExcel: builder.mutation<ExcelImportResult, { file: File }>({
      query: ({ file }) => {
        const formData = new FormData()
        formData.append('file', file)
        return {
          url: '/api/users',
          method: 'POST',
          body: formData,
          // Не устанавливаем Content-Type, браузер сам установит multipart/form-data
        }
      },
      transformResponse: normalizeExcelImportResponse,
      invalidatesTags: ['Users'],
    }),

    login: builder.mutation<AuthResponse, AuthRequest>({
      query: credentials => ({
        url: '/api/users/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Users', 'Me'],
    }),

    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/api/users/logout',
        method: 'POST',
      }),
      invalidatesTags: ['Users', 'Me'],
    }),

    updateUser: builder.mutation<User, { id: string; name: string }>({
      query: ({ id, name }) => ({
        url: `/api/users/${encodeURIComponent(id)}`,
        method: 'PUT',
        body: { name },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'Users',
        { type: 'User', id },
        'Me',
      ],
    }),

    deleteUser: builder.mutation<void, string>({
      query: id => ({
        url: `/api/users/${encodeURIComponent(id)}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Users'],
    }),
  }),
})

// Не забудьте экспортировать новый хук
export const {
  useGetUsersQuery,
  useGetCurrentUserQuery,
  useSearchUsersQuery,
  useUploadUsersExcelMutation, // ← добавить
  useLoginMutation,
  useLogoutMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} = userApi