// src/slices/fileExplorerSlice.ts
import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

// 👇 Тип импортируем через 'type', чтобы избежать ошибки verbatimModuleSyntax
import type { RootState } from '../index'
import type { FileItem } from '../../types/file.type'

export type FileCategory = 'shared' | 'my' | 'available' | 'to_be_approved'

export interface FileSystemItem extends FileItem {
  parentId: string | null
  category: FileCategory
  author?: string
}

interface FileExplorerState {
  currentCategory: FileCategory
  currentFolderId: string | null
  items: FileSystemItem[]
  selectedItemId: string | null
  isLoading: boolean
  breadcrumb: { id: string | null; name: string }[]
  searchQuery: string
}

const initialState: FileExplorerState = {
  currentCategory: 'my',
  currentFolderId: 'root',
  items: [],
  selectedItemId: null,
  isLoading: false,
  breadcrumb: [{ id: null, name: 'Корень' }],
  searchQuery: '',
}

const fileExplorerSlice = createSlice({
  name: 'fileExplorer',
  initialState,
  reducers: {
    setCategory: (state, action: PayloadAction<FileCategory>) => {
      state.currentCategory = action.payload
      state.currentFolderId = 'root'
      state.selectedItemId = null
      state.breadcrumb = [{ id: null, name: getCategoryName(action.payload) }]
      // Items will be populated by API call in component
      state.items = []
    },
    setItems: (state, action: PayloadAction<FileSystemItem[]>) => {
      state.items = action.payload
    },
    navigateToFolder: (state, action: PayloadAction<string>) => {
      state.currentFolderId = action.payload
      state.selectedItemId = null
      const folder = state.items.find(i => i.id === action.payload)
      if (folder) {
        state.breadcrumb.push({ id: folder.id, name: folder.name })
      }
      // For now, we don't have nested folders in real data
      // In a real implementation, you would fetch folder contents from API
    },
    goBack: (state) => {
      if (state.breadcrumb.length > 1) {
        state.breadcrumb.pop()
        const prevFolder = state.breadcrumb[state.breadcrumb.length - 1]
        state.currentFolderId = prevFolder.id
        // In a real implementation, you would fetch folder contents from API
      }
    },
    selectItem: (state, action: PayloadAction<string | null>) => {
      state.selectedItemId = action.payload
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload
      // Search will be handled by API in component
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

function getCategoryName(category: FileCategory): string {
  switch (category) {
    case 'shared': return 'Общие файлы'
    case 'my': return 'Мои документы'
    case 'available': return 'Доступные файлы'
    case 'to_be_approved': return 'На согласовании'
  }
}

export const { setCategory, setItems, navigateToFolder, goBack, selectItem, setSearchQuery, setLoading } = fileExplorerSlice.actions
export default fileExplorerSlice.reducer

// Селекторы
export const selectFileExplorer = (state: RootState) => state.fileExplorer
export const selectCurrentCategory = (state: RootState) => state.fileExplorer.currentCategory
export const selectItems = (state: RootState) => state.fileExplorer.items
export const selectSelectedItemId = (state: RootState) => state.fileExplorer.selectedItemId