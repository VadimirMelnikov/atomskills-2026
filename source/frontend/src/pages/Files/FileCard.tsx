import React from 'react'
import { Card } from 'antd'
import { FileWordOutlined } from '@ant-design/icons'

import type { FileItem } from '../../types/file.type'

interface FileCardProps {
  file: FileItem
  onClick?: () => void
  onDoubleClick?: () => void
}

export const FileCard: React.FC<FileCardProps> = ({ file, onClick, onDoubleClick }) => (
  <Card
    key={file.id}
    hoverable
    onClick={onClick}
    onDoubleClick={onDoubleClick}
    style={{ width: 160, cursor: 'pointer' }}
    cover={
      <div style={{ padding: 24, textAlign: 'center' }}>
        <FileWordOutlined style={{ fontSize: 48, color: '#1890ff' }} />
      </div>
    }
  >
    <Card.Meta title={file.name} />
  </Card>
)