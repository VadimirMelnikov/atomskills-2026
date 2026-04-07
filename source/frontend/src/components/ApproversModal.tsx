// src/components/ApproversModal.tsx
import React from 'react'
import { Modal } from 'antd'
import MoveToApprovalForm from './MoveToApprovalForm'

interface ApproversModalProps {
    visible: boolean
    documentId: number
    onClose: () => void
    onSuccess?: () => void
}

const ApproversModal: React.FC<ApproversModalProps> = ({ visible, documentId, onClose, onSuccess }) => {
    return (
        <Modal
            title="Отправить документ на согласование"
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
            destroyOnClose
        >
            <MoveToApprovalForm
                documentId={documentId}
                onSuccess={() => {
                    onSuccess?.()
                    onClose()
                }}
            />
        </Modal>
    )
}

export default ApproversModal
