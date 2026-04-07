// src/components/OnlyOffice/DocumentSidebar.tsx
import React from 'react'
import { Card, Space, Typography, Empty } from 'antd'
import { TeamOutlined, CheckCircleOutlined, HistoryOutlined } from '@ant-design/icons'
import DocumentCoauthorsBlock from './DocumentCoauthorsBlock'
import DocumentApproversBlock from './DocumentApproversBlock'
import DocumentVersionHistoryBlock from './DocumentVersionHistoryBlock'

const { Title } = Typography

interface DocumentSidebarProps {
    documentId: number | null
    onCompareVersion?: (versionId: number) => void
}

const DocumentSidebar: React.FC<DocumentSidebarProps> = ({ documentId, onCompareVersion }) => {
    if (!documentId) {
        return (
            <Card style={{ height: '100%' }}>
                <Empty description="Документ не выбран" />
            </Card>
        )
    }

    return (
        <Card style={{ height: '100%', overflow: 'auto' }}>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                    <Title level={5}>
                        <TeamOutlined /> Участники
                    </Title>
                    <DocumentCoauthorsBlock documentId={documentId} hideTitle />
                </div>

                <div>
                    <Title level={5}>
                        <CheckCircleOutlined /> Апруверы
                    </Title>
                    <DocumentApproversBlock documentId={documentId} hideTitle />
                </div>

                <div>
                    <Title level={5}>
                        <HistoryOutlined /> Версии
                    </Title>
                    <DocumentVersionHistoryBlock documentId={documentId} onCompareVersion={onCompareVersion} hideTitle />
                </div>
            </Space>
        </Card>
    )
}

export default DocumentSidebar
