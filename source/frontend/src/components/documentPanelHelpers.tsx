import React from 'react'
import { Tag } from 'antd'

export function versionStatusTag(status: string): React.ReactNode {
    switch (status) {
        case 'draft':
            return <Tag>Черновик</Tag>
        case 'under_approval':
            return <Tag color="processing">На согласовании</Tag>
        case 'approved':
            return <Tag color="success">Одобрено</Tag>
        case 'refusal':
            return <Tag color="error">Отклонено</Tag>
        default:
            return <Tag>{status}</Tag>
    }
}

export function memberRoleColor(role: string): string {
    switch (role) {
        case 'writer':
            return 'blue'
        case 'commenter':
            return 'green'
        case 'reader':
            return 'default'
        default:
            return 'default'
    }
}

export function memberRoleLabel(role: string): string {
    switch (role) {
        case 'writer':
            return 'Редактор'
        case 'commenter':
            return 'Комментатор'
        case 'reader':
            return 'Читатель'
        default:
            return role
    }
}
