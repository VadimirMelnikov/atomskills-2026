import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface DocState {
	content: string
	title: string
}

export const initialState: DocState = {
	content: '<p>Привет! Начни печатать здесь...</p>',
	title: 'Новый документ',
}

const docSlice = createSlice({
	name: 'doc',
	initialState,
	reducers: {
		setContent: (state, action: PayloadAction<string>) => {
			state.content = action.payload
		},
		setTitle: (state, action: PayloadAction<string>) => {
			state.title = action.payload
		},
		resetDoc: () => initialState,
	},
})

export const { setContent, setTitle, resetDoc } = docSlice.actions
export const docReducer = docSlice.reducer