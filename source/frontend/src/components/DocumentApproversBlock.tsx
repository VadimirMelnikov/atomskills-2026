import React from 'react'
import { List, Tag, Avatar, Empty, Spin, Space, Typography } from 'antd'
import { UserOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { useGetDocumentApproversQuery } from '../store/api/documentApi'
import { useAuth } from '../hooks/useAuth'

const { Text } = Typography

interface DocumentApproversBlockProps {
    documentId: number
    hideTitle?: boolean
}

const DocumentApproversBlock: React.FC<DocumentApproversBlockProps> = ({ documentId, hideTitle }) => {
    const { data: approvers = [], isLoading } = useGetDocumentApproversQuery(documentId, { skip: !documentId })
    const { getUserId } = useAuth()
    const currentUserId = getUserId()

    return (
        <>
            {!hideTitle && (
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Согласующие ({approvers.length})</div>
            )}
            {isLoading ? (
                <Spin />
            ) : approvers.length === 0 ? (
                <Empty description="Нет активного процесса согласования" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
                <List
                    size="small"
                    dataSource={approvers}
                    renderItem={approver => (
                        <List.Item>
                            <List.Item.Meta
                                avatar={<Avatar size="small" icon={<UserOutlined />} />}
                                title={
                                    <Text
                                        ellipsis
                                        style={
                                            currentUserId && approver.user_id === currentUserId
                                                ? { color: '#1677ff', fontWeight: 600 }
                                                : undefined
                                        }
                                    >
                                        {approver.name}
                                    </Text>
                                }
                                description={
                                    <Space size={4} wrap>
                                        {currentUserId && approver.user_id === currentUserId && (
                                            <Tag color="blue">Вы</Tag>
                                        )}
                                        {approver.approved === true && (
                                            <Tag color="success" icon={<CheckCircleOutlined />}>
                                                Одобрено
                                            </Tag>
                                        )}
                                        {approver.approved === false && (
                                            <Tag color="error" icon={<CloseCircleOutlined />}>
                                                Отклонено
                                            </Tag>
                                        )}
                                        {approver.approved === null && <Tag color="processing">Ожидает</Tag>}
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </>
    )
}

export default DocumentApproversBlock
