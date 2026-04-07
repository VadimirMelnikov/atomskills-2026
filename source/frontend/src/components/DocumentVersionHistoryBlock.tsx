import React from 'react'
import { List, Tag, Button, Empty, Spin, Space, Typography, Tooltip } from 'antd'
import { DiffOutlined } from '@ant-design/icons'
import { useGetDocumentVersionsQuery } from '../store/api/documentApi'
import { versionStatusTag } from './documentPanelHelpers'

const { Text } = Typography

interface DocumentVersionHistoryBlockProps {
    documentId: number
    onCompareVersion?: (versionId: number) => void
    hideTitle?: boolean
}

const DocumentVersionHistoryBlock: React.FC<DocumentVersionHistoryBlockProps> = ({
    documentId,
    onCompareVersion,
    hideTitle,
}) => {
    const { data: versions = [], isLoading: versionsLoading } = useGetDocumentVersionsQuery(documentId, {
        skip: !documentId,
    })

    const latestVersion =
        versions.length > 0 ? versions.reduce((max, v) => (v.version > max.version ? v : max), versions[0]) : null

    const sortedVersions = [...versions].sort((a, b) => b.version - a.version)

    return (
        <>
            {!hideTitle && <div style={{ marginBottom: 8, fontWeight: 600 }}>Версии ({versions.length})</div>}
            {versionsLoading ? (
                <Spin />
            ) : versions.length === 0 ? (
                <Empty description="Нет версий" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : (
                <List
                    size="small"
                    dataSource={sortedVersions}
                    renderItem={ver => {
                        const isLatest = latestVersion?.id === ver.id
                        return (
                            <List.Item
                                actions={
                                    !isLatest && onCompareVersion
                                        ? [
                                              <Tooltip key="compare" title="Сравнить с текущей версией">
                                                  <Button
                                                      type="link"
                                                      size="small"
                                                      icon={<DiffOutlined />}
                                                      onClick={() => onCompareVersion(ver.id)}
                                                  >
                                                      Сравнить
                                                  </Button>
                                              </Tooltip>,
                                          ]
                                        : undefined
                                }
                            >
                                <List.Item.Meta
                                    title={
                                        <Space size={6} wrap>
                                            <Text strong>v{ver.version}</Text>
                                            {isLatest && <Tag color="blue">текущая</Tag>}
                                        </Space>
                                    }
                                    description={
                                        <Space direction="vertical" size={0}>
                                            {versionStatusTag(ver.status)}
                                            <Text type="secondary" style={{ fontSize: 12 }}>
                                                {new Date(ver.created_at).toLocaleString('ru-RU')}
                                            </Text>
                                        </Space>
                                    }
                                />
                            </List.Item>
                        )
                    }}
                />
            )}
        </>
    )
}

export default DocumentVersionHistoryBlock
