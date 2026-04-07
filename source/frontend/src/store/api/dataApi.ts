import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'

export const dataApi = createApi({
	reducerPath: 'dataApi',
	baseQuery: fetchBaseQuery({
		baseUrl: '',
		credentials: 'include',
	}),
	tagTypes: ['Data'],
	endpoints: builder => ({
		getList: builder.query<number[], void>({
			query: () => '/api/data/list',
			providesTags: ['Data'],
		}),
		getText: builder.query<string, void>({
			query: () => ({
				url: '/api/data/text',
				responseHandler: 'text',
			}),
			providesTags: ['Data'],
		}),
		getJson: builder.query<Record<string, unknown>, void>({
			query: () => '/api/data/json',
			providesTags: ['Data'],
		}),
	}),
})

export const { useGetListQuery, useGetTextQuery, useGetJsonQuery } = dataApi
