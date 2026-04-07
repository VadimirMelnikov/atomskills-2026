import React, { useEffect, useState } from 'react'
import { FileExplorerTabs, type FileCategory } from './FileExplorerTabs'
import type { FileItem } from '../../types/file.type'
import { Modal, Form, Input, message, Breadcrumb, Upload } from 'antd'
import Button from '../../components/Universal/Button/Button'
import { PlusOutlined, UploadOutlined, InboxOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import { setCategory, navigateToFolder, selectCurrentCategory, selectFileExplorer } from '../../store/slices/fileExplorerSlice'
import {
    useCreateDocumentMutation,
    useImportDocumentMutation,
    useGetDocumentsQuery,
    type DocumentToApproveResponse,
} from '../../store/api/documentApi'
import { useAuth } from '../../hooks/useAuth'
import { useLocation, useNavigate } from 'react-router-dom'

const { Dragger } = Upload

const mapDocumentToFileItem = (doc: any, currentUserId?: string): FileItem => {
    const name = doc.name.toLowerCase()
    const typeMap: Record<string, FileItem['type']> = {
        pdf: 'pdf', docx: 'doc', doc: 'doc', xlsx: 'xlsx', xls: 'xlsx',
        txt: 'txt', ppt: 'ppt', pptx: 'ppt', zip: 'zip', rar: 'zip'
    }
    let fileType: FileItem['type'] = 'doc'
    for (const [ext, type] of Object.entries(typeMap)) {
        if (name.endsWith(ext)) { fileType = type; break }
    }
    if (name.match(/\.(jpg|jpeg|png|gif|bmp)$/)) fileType = 'image'

    const formatSize = (bytes: number) => {
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(1024))
        return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
    }

    let status: FileItem['status'] = 'draft'
    if (doc.status) {
        switch (doc.status) {
            case 'approved':
                status = 'approved'
                break
            case 'under_approval':
                status = 'review'
                break
            case 'refusal':
                status = 'refusal'
                break
            case 'archived':
                status = 'archived'
                break
            case 'draft':
            default:
                status = 'draft'
                break
        }
    }

    const isOwner = doc.owner_id === currentUserId || doc.is_owner === true

    return {
        id: String(doc.id),
        name: doc.name,
        type: fileType,
        size: doc.file_size != null ? formatSize(Number(doc.file_size)) : '',
        updatedAt: doc.updated_at ?? '',
        owner: isOwner ? 'me' : 'other',
        status: status,
        permissions: { 
            canView: true, 
            canEdit: doc.can_edit ?? isOwner,
            canComment: doc.can_comment ?? true 
        }
    }
}

function categoryFromPathname(pathname: string): FileCategory {
    const segment = pathname.split('/').filter(Boolean)[1]
    if (segment === 'shared') return 'shared'
    if (segment === 'available') return 'available'
    if (segment === 'to_be_approved') return 'to_be_approved'
    return 'my'
}

const mapToApproveDocToFileItem = (
    doc: DocumentToApproveResponse,
    currentUserId?: string,
): FileItem => {
    const nameLower = doc.name.toLowerCase()
    const typeMap: Record<string, FileItem['type']> = {
        pdf: 'pdf', docx: 'doc', doc: 'doc', xlsx: 'xlsx', xls: 'xlsx',
        txt: 'txt', ppt: 'ppt', pptx: 'ppt', zip: 'zip', rar: 'zip',
    }
    let fileType: FileItem['type'] = 'doc'
    for (const [ext, t] of Object.entries(typeMap)) {
        if (nameLower.endsWith(ext)) {
            fileType = t
            break
        }
    }
    if (nameLower.match(/\.(jpg|jpeg|png|gif|bmp)$/)) fileType = 'image'

    let status: FileItem['status'] = 'draft'
    switch (doc.status) {
        case 'approved':
            status = 'approved'
            break
        case 'under_approval':
            status = 'review'
            break
        case 'refusal':
            status = 'refusal'
            break
        case 'draft':
        default:
            status = 'draft'
            break
    }

    const isOwner = doc.owner_id === currentUserId

    return {
        id: String(doc.id),
        name: doc.name,
        type: fileType,
        // Вкладка «На согласовании» не отображает size/updatedAt, поэтому не подставляем моковые значения.
        size: '',
        updatedAt: '',
        owner: isOwner ? 'me' : 'other',
        status,
        version: doc.version,
        versionId: doc.version_id,
        approverApproved: doc.approved ?? null,
        permissions: { canView: true, canEdit: false, canComment: false },
    }
}

const FilesPage: React.FC = () => {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const location = useLocation()
    const { getUserId } = useAuth()
    const currentUserId = getUserId()
    const currentCategory = useSelector(selectCurrentCategory)
    const [search, setSearch] = useState('')
    const [createDocument, { isLoading: isCreating }] = useCreateDocumentMutation()
    const [importDocument, { isLoading: isImporting }] = useImportDocumentMutation()
    
    const { data: myDocsData, refetch: refetchMyDocs, error: _myDocsError } = useGetDocumentsQuery('my_docs')
    // «Общие документы» — показываем всем только утверждённые (approved) версии
    const { data: publicApprovedData } = useGetDocumentsQuery('public', {
        refetchOnFocus: true,
        pollingInterval: 10_000,
    })
    // «Доступные мне» — документы, расшаренные конкретному пользователю
    const { data: sharedWithMeData } = useGetDocumentsQuery('shared', {
        refetchOnFocus: true,
        pollingInterval: 10_000,
    })
    const { data: toBeApprovedData } = useGetDocumentsQuery('to_be_approved')

    const toFileItems = (data: any) => {
        if (!Array.isArray(data)) {
            return []
        }
        return data.map(doc => mapDocumentToFileItem(doc, currentUserId || undefined))
    }

    const toApproveFileItems = (data: unknown): FileItem[] => {
        if (!Array.isArray(data)) return []
        return data.map(doc =>
            mapToApproveDocToFileItem(doc as DocumentToApproveResponse, currentUserId || undefined),
        )
    }
    
    const files: Record<FileCategory, FileItem[]> = {
        my: toFileItems(myDocsData),
        shared: toFileItems(publicApprovedData),
        available: toFileItems(sharedWithMeData),
        to_be_approved: toApproveFileItems(toBeApprovedData),
    }

    const breadcrumbItems = useSelector(selectFileExplorer)?.breadcrumb || []
    const [createModal, setCreateModal] = useState({ open: false })
    const [importModal, setImportModal] = useState<{ open: boolean; file?: File }>({ open: false })
    const [createForm] = Form.useForm()
    const [importForm] = Form.useForm()

    useEffect(() => {
        dispatch(setCategory(categoryFromPathname(location.pathname)))
    }, [dispatch, location.pathname])

    const handleCreateDocument = async (values: { name: string }) => {
        try {
            await createDocument({ name: values.name }).unwrap()
            message.success('Документ создан')
            setCreateModal({ open: false })
            createForm.resetFields()
            await refetchMyDocs()
            setTimeout(() => {
                refetchMyDocs()
            }, 500)
        } catch (error: any) {
            message.error(error?.data?.detail || 'Ошибка создания')
        }
    }

    const handleImportDocument = async (values: { name: string }) => {
        if (!importModal.file) return message.error('Выберите файл')
        try {
            await importDocument({ name: values.name, file: importModal.file }).unwrap()
            message.success('Документ импортирован')
            setImportModal({ open: false, file: undefined })
            importForm.resetFields()
            await refetchMyDocs()
            setTimeout(() => {
                refetchMyDocs()
            }, 500)
        } catch (error: any) {
            message.error(error?.data?.detail || 'Ошибка импорта')
        }
    }

    const handleFileUpload = (file: File) => {
        if (!file.name.match(/\.(docx|doc)$/i)) {
            message.error('Поддерживаются только .docx и .doc')
            return false
        }
        setImportModal(prev => ({ ...prev, file }))
        return false
    }

    const openCollaborativeEditor = (file: FileItem) => {
        if (file.type === 'folder') return
        if (file.type !== 'doc') {
            message.info('Совместное редактирование доступно для документов Word (.docx, .doc)')
            return
        }
        navigate(`/document?documentId=${encodeURIComponent(file.id)}`)
    }

    return (
        <>
            <Breadcrumb 
                style={{ marginBottom: 12 }} 
                items={breadcrumbItems.filter(b => b.id).map(b => ({ title: b.name }))} 
            />
            
            <FileExplorerTabs
                files={files}
                activeCategory={currentCategory as FileCategory}
                onCategoryChange={cat => {
                    dispatch(setCategory(cat))
                    navigate(`/files/${cat}`, { replace: true })
                }}
                onFileClick={openCollaborativeEditor}
                onFileDoubleClick={file => {
                    if (file.type === 'folder') {
                        dispatch(navigateToFolder(file.id))
                    } else {
                        openCollaborativeEditor(file)
                    }
                }}
                onCreateFile={() => setCreateModal({ open: true })}
                onImportFile={() => setImportModal({ open: true, file: undefined })}
                search={search}
                onSearch={setSearch}
            />

            <Modal 
                title="Создать документ" 
                open={createModal.open} 
                onCancel={() => setCreateModal({ open: false })} 
                footer={null} 
                destroyOnClose
            >
                <Form form={createForm} onFinish={handleCreateDocument} layout="vertical">
                    <Form.Item 
                        name="name" 
                        rules={[{ required: true, message: 'Введите название' }]}
                    >
                        <Input placeholder="Название документа" />
                    </Form.Item>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button onClick={() => setCreateModal({ open: false })} title="Отмена" />
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                icon={<PlusOutlined />} 
                                title="Создать" 
                                loading={isCreating} 
                            />
                        </div>
                    </Form.Item>
                </Form>
            </Modal>

            <Modal 
                title="Импортировать документ" 
                open={importModal.open} 
                onCancel={() => setImportModal({ open: false, file: undefined })} 
                footer={null} 
                width={600}
            >
                <Form form={importForm} onFinish={handleImportDocument} layout="vertical">
                    <Form.Item 
                        name="name" 
                        rules={[{ required: true, message: 'Введите название' }]}
                    >
                        <Input placeholder="Название документа" />
                    </Form.Item>
                    <Form.Item label="Файл (.docx, .doc)" required>
                        <Dragger 
                            beforeUpload={handleFileUpload} 
                            onRemove={() => setImportModal(prev => ({ ...prev, file: undefined }))} 
                            fileList={importModal.file ? [{ uid: '1', name: importModal.file.name, size: importModal.file.size }] : []} 
                            accept=".docx,.doc"
                            maxCount={1}
                        >
                            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                            <p className="ant-upload-text">Нажмите или перетащите файл</p>
                            <p className="ant-upload-hint">Поддерживаются файлы .docx и .doc</p>
                        </Dragger>
                    </Form.Item>
                    <Form.Item>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <Button onClick={() => setImportModal({ open: false, file: undefined })} title="Отмена" />
                            <Button 
                                type="primary" 
                                htmlType="submit" 
                                icon={<UploadOutlined />} 
                                title="Импортировать" 
                                loading={isImporting} 
                                disabled={!importModal.file} 
                            />
                        </div>
                    </Form.Item>
                </Form>
            </Modal>
        </>
    )
}

export default FilesPage