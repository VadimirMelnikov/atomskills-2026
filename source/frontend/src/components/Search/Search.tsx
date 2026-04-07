// src/components/OnlyOffice/UserSearch.tsx
import React, { useState, useEffect } from 'react'
import { Select, Spin, message } from 'antd'
import { useSearchUsersQuery } from '../../store/api/userApi'

interface User {
    id: string
    name: string
}

interface UserSearchProps {
    placeholder?: string
    mode?: 'multiple' | 'tags'
    onSelect: (users: User[]) => void
    value?: User[]
    disabled?: boolean
}

const UserSearch: React.FC<UserSearchProps> = ({
    placeholder = 'Поиск пользователей...',
    mode = 'multiple',
    onSelect,
    value = [],
    disabled = false
}) => {
    const [searchValue, setSearchValue] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const { data: users = [], isLoading, isError } = useSearchUsersQuery(debouncedSearch, {
        skip: debouncedSearch.length < 2,
    })

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchValue)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchValue])

    useEffect(() => {
        if (isError) {
            message.error('Не удалось загрузить пользователей')
        }
    }, [isError])

    const handleChange = (selectedIds: string[]) => {
        const prevById = new Map(value.map(u => [u.id, u]))
        const next: User[] = []
        for (const id of selectedIds) {
            const existing = prevById.get(id)
            if (existing) {
                next.push(existing)
            } else {
                const found = users.find(u => u.id === id)
                if (found) next.push(found)
            }
        }
        onSelect(next)
    }

    return (
        <Select
            mode={mode}
            placeholder={placeholder}
            loading={isLoading}
            disabled={disabled}
            value={value.map(u => u.id)}
            onChange={handleChange}
            onSearch={setSearchValue}
            filterOption={false}
            notFoundContent={isLoading ? <Spin size="small" /> : searchValue.length >= 2 ? 'Пользователи не найдены' : 'Введите минимум 2 символа'}
            style={{ width: '100%' }}
            showSearch
        >
            {users.map(user => (
                <Select.Option key={user.id} value={user.id}>
                    {user.name} ({user.id})
                </Select.Option>
            ))}
        </Select>
    )
}

export default UserSearch