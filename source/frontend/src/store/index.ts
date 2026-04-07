import { configureStore } from '@reduxjs/toolkit'
import { userApi } from './api/userApi'
import { dataApi } from './api/dataApi'
import { documentApi } from './api/documentApi'
import { setupListeners } from '@reduxjs/toolkit/query'
import { docReducer } from './slices/docSlice'
import fileExplorerReducer from './slices/fileExplorerSlice'

export const store = configureStore({
	reducer: {
		[userApi.reducerPath]: userApi.reducer,
		[dataApi.reducerPath]: dataApi.reducer,
		[documentApi.reducerPath]: documentApi.reducer,
		doc: docReducer,
		fileExplorer: fileExplorerReducer,
	},
	middleware: getDefaultMiddleware =>
		getDefaultMiddleware().concat(
			userApi.middleware,
			dataApi.middleware,
			documentApi.middleware
		),
})

setupListeners(store.dispatch)

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch