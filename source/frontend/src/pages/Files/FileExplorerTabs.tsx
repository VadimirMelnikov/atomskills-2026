import React, { useEffect, useState } from 'react'
import { Tabs } from 'antd'
import type { FileItem } from '../../types/file.type'
import type { FileCategory } from '../../store/slices/fileExplorerSlice'

import { FileViewToggle } from '../../pages/Files/FileViewToggle'

export type { FileCategory }

interface FileExplorerTabsProps {
    files: Record<FileCategory, FileItem[]>
    onFileClick?: (file: FileItem) => void
    onCreateFile?: () => void
    onImportFile?: () => void
    activeCategory?: FileCategory
    onCategoryChange?: (cat: FileCategory) => void
    onFileDoubleClick?: (file: FileItem) => void
    search?: string
    onSearch?: (value: string) => void
}

export const FileExplorerTabs: React.FC<FileExplorerTabsProps> = ({
    files,
    onFileClick,
    onCreateFile,
    onImportFile,
    activeCategory,
    onCategoryChange,
    onFileDoubleClick,
    search: externalSearch,
    onSearch: externalOnSearch,
}) => {
    const [activeTab, setActiveTab] = useState<FileCategory>(
        activeCategory || 'my',
    )
    const [internalSearch, setInternalSearch] = useState('')

    useEffect(() => {
        if (activeCategory) setActiveTab(activeCategory)
    }, [activeCategory])
    
    const searchValue = externalSearch !== undefined ? externalSearch : internalSearch
    const handleSearch = externalOnSearch || setInternalSearch

    const getFilteredFiles = (category: FileCategory) => {
        const categoryFiles = files[category] || []
        if (!searchValue) return categoryFiles
        return categoryFiles.filter(f => 
            f.name.toLowerCase().includes(searchValue.toLowerCase())
        )
    }

    const tabItems = [
        {
            key: 'shared',
            label: 'Общие документы',
            children: (
                <FileViewToggle
                    files={getFilteredFiles('shared').filter(f => f.status === 'approved')}
                    onFileClick={onFileClick}
                    onFileDoubleClick={onFileDoubleClick}
                    search={searchValue}
                    onSearch={handleSearch}
                />
            ),
        },
        {
            key: 'my',
            label: 'Мои документы',
            children: (
                <FileViewToggle
					files={getFilteredFiles('my').filter(f => f.owner === 'me')}
					onFileClick={onFileClick}
					onFileDoubleClick={onFileDoubleClick}
					search={searchValue}
					onSearch={handleSearch}
					onCreate={onCreateFile}
					onImport={onImportFile}
				/>
            ),
        },
        {
            key: 'available',
            label: 'Доступные мне',
            children: (
                <FileViewToggle
                    files={getFilteredFiles('available').filter(f => f.permissions?.canView)}
                    onFileClick={onFileClick}
                    onFileDoubleClick={onFileDoubleClick}
                    search={searchValue}
                    onSearch={handleSearch}
                />
            ),
        },
        {
            key: 'to_be_approved',
            label: 'На согласовании',
            children: (
                <FileViewToggle
                    mode="approval"
                    files={getFilteredFiles('to_be_approved')}
                    onFileClick={onFileClick}
                    onFileDoubleClick={onFileDoubleClick}
                    search={searchValue}
                    onSearch={handleSearch}
                />
            ),
        },
    ]

    return (
        <div style={{ padding: 24 }}>
            <Tabs
                activeKey={activeTab}
                onChange={key => {
                    const cat = key as FileCategory
                    setActiveTab(cat)
                    onCategoryChange?.(cat)
                }}
                items={tabItems}
                tabBarStyle={{ marginBottom: 0 }}
            />
        </div>
    )
}