import React, { useState } from 'react'
import { Form, message, Alert, Tag, Space, Radio, Button } from 'antd'
import { useMoveToApprovalMutation } from '../store/api/documentApi'
import UserSearch from './Search/Search'
import { useAuth } from '../hooks/useAuth'

interface User {
    id: string
    name: string
}

interface MoveToApprovalFormProps {
    documentId: number
    onSuccess?: () => void
    /** Только для статуса черновика можно выбрать согласующих и отправить на согласование */
    canSetApprovers?: boolean
}

const MoveToApprovalForm: React.FC<MoveToApprovalFormProps> = ({
    documentId,
    onSuccess,
    canSetApprovers = true,
}) => {
    const { getUserId } = useAuth()
    const currentUserId = getUserId()
    const [form] = Form.useForm()
    const [selectedUsers, setSelectedUsers] = useState<User[]>([])
    const [approveMethod, setApproveMethod] = useState<'simple' | 'strict'>('simple')
    const [moveToApproval, { isLoading }] = useMoveToApprovalMutation()

    const handleSubmit = async () => {
        if (!canSetApprovers) return
        if (selectedUsers.length === 0) {
            message.warning('Выберите хотя бы одного согласующего')
            return
        }

        try {
            await moveToApproval({
                docId: documentId,
                data: {
                    approve_method: approveMethod,
                    approvers: selectedUsers.map(u => u.id),
                },
            }).unwrap()

            message.success(`Документ отправлен на согласование (${selectedUsers.length})`)
            form.resetFields()
            setSelectedUsers([])
            onSuccess?.()
        } catch (error) {
            message.error((error as { data?: { detail?: string } })?.data?.detail || 'Ошибка при отправке на согласование')
        }
    }

    if (!canSetApprovers) {
        return (
            <Alert
                type="info"
                showIcon
                message="Согласующих нельзя изменить"
                description="Назначение доступно только для «Черновика»."
            />
        )
    }

    return (
        <>
            <Form form={form} layout="vertical">
                <Form.Item
                    label="Согласующие"
                    required
                    help="Выберите пользователей, которые будут согласовывать документ"
                >
                    <UserSearch
                        onSelect={setSelectedUsers}
                        value={selectedUsers}
                        placeholder="Поиск согласующих..."
                    />
                    {selectedUsers.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <Space wrap>
                                {selectedUsers.map(user => (
                                    <Tag
                                        key={user.id}
                                        closable
                                        onClose={() => {
                                            setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))
                                        }}
                                        color={currentUserId && user.id === currentUserId ? 'blue' : undefined}
                                        style={
                                            currentUserId && user.id === currentUserId
                                                ? { border: '1px solid #1677ff', background: '#e6f4ff' }
                                                : undefined
                                        }
                                    >
                                        {user.name}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    )}
                </Form.Item>

                <Form.Item name="approve_method" label="Метод согласования" initialValue="simple">
                    <Radio.Group onChange={e => setApproveMethod(e.target.value)}>
                        <Radio value="simple">Простое (любой может одобрить)</Radio>
                        <Radio value="strict">Строгое (по порядку)</Radio>
                    </Radio.Group>
                </Form.Item>

                <Alert
                    message="Информация о согласовании"
                    description={
                        <div>
                            <p>
                                <strong>Согласующие</strong> могут комментировать документ, но не редактировать его.
                            </p>
                            {approveMethod === 'strict' && (
                                <p style={{ marginTop: 8 }}>
                                    <strong>Строгое согласование:</strong> одобрение в указанном порядке.
                                </p>
                            )}
                        </div>
                    }
                    type="info"
                    showIcon
                />
            </Form>
            <Button type="primary" block style={{ marginTop: 16 }} onClick={handleSubmit} loading={isLoading}>
                Отправить на согласование
            </Button>
        </>
    )
}

export default MoveToApprovalForm
