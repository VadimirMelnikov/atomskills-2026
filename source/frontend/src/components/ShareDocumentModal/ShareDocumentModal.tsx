// src/components/OnlyOffice/ShareDocumentModal.tsx
import React, { useState } from 'react'
import { Modal, Form, Select, message, Alert, Space, Tag } from 'antd'
import { useShareDocumentMutation } from '../../store/api/documentApi'
import UserSearch from '../Search/Search'

interface User {
    id: string
    name: string
}

interface ShareDocumentModalProps {
    visible: boolean
    documentId: number
    onClose: () => void
    onSuccess?: () => void
}

const { Option } = Select

const ShareDocumentModal: React.FC<ShareDocumentModalProps> = ({
    visible,
    documentId,
    onClose,
    onSuccess
}) => {
    const [form] = Form.useForm()
    const [selectedUsers, setSelectedUsers] = useState<User[]>([])
    const [shareDocument, { isLoading }] = useShareDocumentMutation()

    const handleSubmit = async () => {
        try {
            const values = await form.validateFields()
            
            if (selectedUsers.length === 0) {
                message.warning('Выберите хотя бы одного пользователя')
                return
            }

            // Отправляем запросы для каждого пользователя последовательно
            for (const user of selectedUsers) {
                await shareDocument({
                    docId: documentId,
                    data: {
                        user_id: user.id,
                        user_role: values.role
                    }
                }).unwrap()
            }

            message.success(`Права успешно добавлены ${selectedUsers.length} пользователям`)
            form.resetFields()
            setSelectedUsers([])
            onSuccess?.()
            onClose()
        } catch (error) {
            message.error((error as any)?.data?.detail || 'Ошибка при добавлении прав')
        }
    }

    return (
        <Modal
            title="Добавить доступ к документу"
            open={visible}
            onCancel={onClose}
            onOk={handleSubmit}
            okText="Поделиться доступом"
            confirmLoading={isLoading}
            width={600}
        >
            <Form form={form} layout="vertical" initialValues={{ role: 'commenter' }}>
                <Form.Item
                    label="Пользователи"
                    required
                    help="Введите имя или табельный номер для поиска"
                >
                    <UserSearch
                        onSelect={setSelectedUsers}
                        value={selectedUsers}
                        placeholder="Поиск пользователей..."
                    />
                    {selectedUsers.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                            <Space wrap>
                                {selectedUsers.map(user => (
                                    <Tag key={user.id} closable onClose={() => {
                                        setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))
                                    }}>
                                        {user.name}
                                    </Tag>
                                ))}
                            </Space>
                        </div>
                    )}
                </Form.Item>

                <Form.Item
                    name="role"
                    label="Роль"
                    required
                    tooltip="Определяет уровень доступа к документу"
                >
                    <Select>
                        <Option value="reader">Только чтение</Option>
                        <Option value="commenter">Комментатор (только комментарии)</Option>
                        <Option value="writer">Редактор (может редактировать)</Option>
                    </Select>
                </Form.Item>

                <Alert
                    message="Информация о ролях"
                    description={
                        <ul style={{ margin: 0, paddingLeft: 20 }}>
                            <li><strong>Чтение:</strong> только просмотр документа</li>
                            <li><strong>Комментатор:</strong> может просматривать и оставлять комментарии</li>
                            <li><strong>Редактор:</strong> полный доступ к редактированию</li>
                        </ul>
                    }
                    type="info"
                    showIcon
                />
            </Form>
        </Modal>
    )
}

export default ShareDocumentModal