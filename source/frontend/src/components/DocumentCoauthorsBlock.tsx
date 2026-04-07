import React, { useMemo, useState } from 'react'
import { List, Tag, Avatar, Button, Empty, Spin, Modal, Select, message } from 'antd'
import { UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import {
    useGetDocumentMembersQuery,
    useUnshareDocumentMutation,
    useUpdateDocumentMemberMutation,
} from '../store/api/documentApi'
import { memberRoleColor, memberRoleLabel } from './documentPanelHelpers'

const { Option } = Select

interface DocumentCoauthorsBlockProps {
    documentId: number
    /** Скрыть заголовок «Участники» (например, в аккордеоне уже есть название секции) */
    hideTitle?: boolean
    /** Изменять и отзывать права может только владелец документа */
    canManageAccess?: boolean
}

const DocumentCoauthorsBlock: React.FC<DocumentCoauthorsBlockProps> = ({
    documentId,
    hideTitle,
    canManageAccess = false,
}) => {
    const [editModalVisible, setEditModalVisible] = useState(false)
    const [editingMember, setEditingMember] = useState<{ user_id: string; name: string; user_role: string } | null>(
        null
    )
    const [newRole, setNewRole] = useState<string>('')

    const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useGetDocumentMembersQuery(
        documentId,
        { skip: !documentId }
    )

    const [unshareDocument] = useUnshareDocumentMutation()
    const [updateDocumentMember] = useUpdateDocumentMemberMutation()

    const sortedMembers = useMemo(() => {
        const rolePriority: Record<string, number> = {
            writer: 0,
            commenter: 1,
            reader: 2,
        }

        return [...members].sort((a, b) => {
            const prA = rolePriority[a.user_role] ?? 999
            const prB = rolePriority[b.user_role] ?? 999
            if (prA !== prB) return prA - prB
            return (a.name ?? '').localeCompare(b.name ?? '', 'ru')
        })
    }, [members])

    const handleRemoveMember = async (userId: string) => {
        Modal.confirm({
            title: 'Удалить доступ',
            content: 'Вы уверены, что хотите удалить доступ к документу для этого пользователя?',
            onOk: async () => {
                try {
                    await unshareDocument({ docId: documentId, userId }).unwrap()
                    message.success('Доступ удален')
                    refetchMembers()
                } catch {
                    message.error('Не удалось удалить доступ')
                }
            },
        })
    }

    const handleEditRole = async () => {
        if (!editingMember || !newRole) return

        try {
            await updateDocumentMember({
                docId: documentId,
                data: {
                    user_id: editingMember.user_id,
                    user_role: newRole,
                },
            }).unwrap()

            message.success('Роль обновлена')
            setEditModalVisible(false)
            refetchMembers()
        } catch {
            message.error('Не удалось обновить роль')
        }
    }

    return (
        <>
            {!hideTitle && <div style={{ marginBottom: 8, fontWeight: 600 }}>Соавторы ({members.length})</div>}
            {membersLoading ? (
                <Spin />
            ) : members.length === 0 ? (
                <Empty description="Нет соавторов" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
                <List
                    size="small"
                    dataSource={sortedMembers}
                    renderItem={member => (
                        <List.Item
                            actions={
                                canManageAccess
                                    ? [
                                          <Button
                                              key="edit"
                                              type="text"
                                              size="small"
                                              icon={<EditOutlined />}
                                              onClick={() => {
                                                  setEditingMember(member)
                                                  setNewRole(member.user_role)
                                                  setEditModalVisible(true)
                                              }}
                                          />,
                                          <Button
                                              key="delete"
                                              type="text"
                                              size="small"
                                              danger
                                              icon={<DeleteOutlined />}
                                              onClick={() => handleRemoveMember(member.user_id)}
                                          />,
                                      ]
                                    : undefined
                            }
                        >
                            <List.Item.Meta
                                avatar={<Avatar size="small" icon={<UserOutlined />} />}
                                title={member.name}
                                description={
                                    <Tag color={memberRoleColor(member.user_role)}>{memberRoleLabel(member.user_role)}</Tag>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}

            <Modal title="Изменить роль" open={editModalVisible} onOk={handleEditRole} onCancel={() => setEditModalVisible(false)}>
                <Select value={newRole} onChange={setNewRole} style={{ width: '100%' }}>
                    <Option value="reader">Только чтение</Option>
                    <Option value="commenter">Комментатор</Option>
                    <Option value="writer">Редактор</Option>
                </Select>
            </Modal>
        </>
    )
}

export default DocumentCoauthorsBlock
