import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Typography, message, Spin, Button, Modal, Form, Input } from 'antd'
import { SaveOutlined, ShareAltOutlined, TeamOutlined, SendOutlined, HistoryOutlined, RightOutlined, DownOutlined, CheckCircleOutlined, StopOutlined, ArrowLeftOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import ShareDocumentModal from '../components/ShareDocumentModal/ShareDocumentModal'
import VersionCompareModal from '../components/VersionCompareModal'
import DocumentCoauthorsBlock from '../components/DocumentCoauthorsBlock'
import DocumentApproversBlock from '../components/DocumentApproversBlock'
import DocumentVersionHistoryBlock from '../components/DocumentVersionHistoryBlock'
import MoveToApprovalForm from '../components/MoveToApprovalForm'
import {
    useGetDocumentEditorConfigQuery,
    useCreateNewVersionMutation,
    useGetDocumentVersionsQuery,
    useGetDocumentMembersQuery,
    useGetDocumentApproversQuery,
    useApproveDocumentMutation,
    type DocumentVersion,
} from '../store/api/documentApi'
import { useAuth } from '../hooks/useAuth'
import { versionStatusTag } from '../components/documentPanelHelpers'

const { Title, Text, Paragraph } = Typography

// В проде браузер не должен обращаться к localhost:8082.
// nginx проксирует /onlyoffice/* в контейнер OnlyOffice.
const ONLYOFFICE_API_URL = '/onlyoffice/web-apps/apps/api/documents/api.js'
const ONLYOFFICE_LOAD_TIMEOUT_MS = 90_000
const RETRY_INTERVAL_MS = 3_000
const DOCUMENT_STATUS_POLL_INTERVAL_MS = 5_000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const loadOnlyOfficeApi = async () => {
    if (window.DocsAPI) return

    const startedAt = Date.now()
    while (Date.now() - startedAt < ONLYOFFICE_LOAD_TIMEOUT_MS) {
        try {
            await new Promise<void>((resolve, reject) => {
                const existing = document.querySelector(`script[src="${ONLYOFFICE_API_URL}"]`)
                if (existing) {
                    existing.remove()
                }

                const script = document.createElement('script')
                script.src = `${ONLYOFFICE_API_URL}?t=${Date.now()}`
                script.async = true
                script.onload = () => resolve()
                script.onerror = () => reject(new Error('Не удалось загрузить ONLYOFFICE api.js'))
                document.body.appendChild(script)
            })
            if (window.DocsAPI) return
        } catch {
            await sleep(RETRY_INTERVAL_MS)
        }
    }
    throw new Error('Не удалось загрузить ONLYOFFICE api.js: сервис еще запускается, попробуйте через минуту')
}

type SideSection = 'coauthors' | 'approval' | 'history' | null

const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    cursor: 'pointer',
    userSelect: 'none',
    fontWeight: 600,
    fontSize: 14,
    borderBottom: '1px solid #f0f0f0',
    background: '#fafafa',
    transition: 'background .15s',
}

const sectionBodyStyle: React.CSSProperties = {
    padding: 16,
    borderBottom: '1px solid #f0f0f0',
}

const DocumentEditorPage: React.FC = () => {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const documentIdParam = searchParams.get('documentId')
    const urlDocumentId =
        documentIdParam != null && documentIdParam !== '' ? parseInt(documentIdParam, 10) : NaN
    const hasUrlDocumentId = Number.isInteger(urlDocumentId) && urlDocumentId > 0
    const versionParam = searchParams.get('version')
    const urlVersion =
        versionParam != null && versionParam !== '' ? parseInt(versionParam, 10) : NaN
    const hasUrlVersion = Number.isInteger(urlVersion) && urlVersion > 0

    const editorRef = useRef<OOEditorInstance | null>(null)
    const editorKeyRef = useRef<string | null>(null)
    const statusPollInFlightRef = useRef(false)
    const [editorReloadNonce, setEditorReloadNonce] = useState(0)
    const [isSaving, setIsSaving] = useState(false)
    const [shareModalVisible, setShareModalVisible] = useState(false)
    const [compareVersionId, setCompareVersionId] = useState<number | null>(null)
    const [openSection, setOpenSection] = useState<SideSection>('history')
    const [refuseModalOpen, setRefuseModalOpen] = useState(false)
    const [refuseForm] = Form.useForm<{ reason: string }>()
    const [createNewVersion] = useCreateNewVersionMutation()
    const [approveDocument, { isLoading: isApproving }] = useApproveDocumentMutation()
    const { getUserId } = useAuth()
    const currentUserId = getUserId()

    const editorDocumentId = hasUrlDocumentId ? urlDocumentId : null
    const editorVersion = hasUrlVersion ? urlVersion : undefined
    const editorConfigArg = editorDocumentId
        ? editorVersion != null
            ? { docId: editorDocumentId, version: editorVersion }
            : editorDocumentId
        : 0

    const { data: config, isLoading: isConfigLoading, error: configError, refetch: refetchEditorConfig } = useGetDocumentEditorConfigQuery(editorConfigArg, {
        skip: !editorDocumentId,
    })

    const isAccessDenied =
        !isConfigLoading && Boolean(configError) && (configError as any)?.status === 403

    const {
        data: versions = [],
        isLoading: versionsLoading,
        refetch: refetchVersions,
    } = useGetDocumentVersionsQuery(editorDocumentId!, {
        skip: !editorDocumentId,
    })

    const { data: approvers = [], refetch: refetchApprovers } = useGetDocumentApproversQuery(editorDocumentId!, {
        skip: !editorDocumentId,
    })

    // Роли (permissions) членов документа: нужны для обновления UI при изменениях на сервере.
    const { data: members = [], refetch: refetchMembers } = useGetDocumentMembersQuery(editorDocumentId!, {
        skip: !editorDocumentId,
    })

    const latestVersion: DocumentVersion | null =
        versions.length > 0
            ? versions.reduce(
                  (max: DocumentVersion, v: DocumentVersion) => (v.version > max.version ? v : max),
                  versions[0]
              )
            : null

    const docTitle = (config?.document?.title as string | undefined) ?? 'Документ'

    const isDocumentOwner = Boolean((config as { is_owner?: boolean } | undefined)?.is_owner)
    const showSaveVersionButton =
        isDocumentOwner &&
        !versionsLoading &&
        latestVersion !== null &&
        latestVersion.status === 'refusal'

    const myApproverRow = currentUserId
        ? approvers.find(a => a.user_id === currentUserId)
        : undefined
    const myMemberRow = currentUserId
        ? members.find(m => m.user_id === currentUserId)
        : undefined
    const showApproveButton =
        Boolean(editorDocumentId) &&
        !versionsLoading &&
        latestVersion?.status === 'under_approval' &&
        myApproverRow !== undefined &&
        myApproverRow.approved === null
    const accessSnapshot = useMemo(
        () =>
            JSON.stringify({
                userId: currentUserId ?? null,
                docId: editorDocumentId ?? null,
                latestVersionStatus: latestVersion?.status ?? null,
                myMemberRole: myMemberRow?.user_role ?? null,
                myApproverDecision: myApproverRow?.approved ?? null,
                isOwner: Boolean((config as { is_owner?: boolean } | undefined)?.is_owner),
                canEdit: Boolean((config as { document?: { permissions?: { edit?: boolean } } } | undefined)?.document?.permissions?.edit),
                canComment: Boolean((config as { document?: { permissions?: { comment?: boolean } } } | undefined)?.document?.permissions?.comment),
            }),
        [currentUserId, editorDocumentId, latestVersion?.status, myMemberRow?.user_role, myApproverRow?.approved, config],
    )
    const previousAccessSnapshotRef = useRef<string | null>(null)

    const refusalFooterLines = useMemo(() => {
        if (latestVersion?.status !== 'refusal') return null
        const fromVersions = latestVersion.refusal_entries
        if (fromVersions != null) {
            if (fromVersions.length === 0) {
                return [{ name: '', reason: null as string | null }]
            }
            return fromVersions.map(e => ({
                name: e.reviewer_name,
                reason:
                    e.reason != null && String(e.reason).trim() !== ''
                        ? String(e.reason).trim()
                        : null,
            }))
        }
        const rejected = approvers.filter(a => a.approved === false)
        if (rejected.length === 0) {
            return [{ name: '', reason: null as string | null }]
        }
        return rejected.map(a => ({
            name: a.name,
            reason:
                a.reason_for_refusal != null && String(a.reason_for_refusal).trim() !== ''
                    ? String(a.reason_for_refusal).trim()
                    : null,
        }))
    }, [latestVersion, approvers])

    const toggleSection = (key: Exclude<SideSection, null>) => {
        setOpenSection((prev: SideSection) => (prev === key ? null : key))
    }

    useEffect(() => {
        let cancelled = false
        const init = async () => {
            if (!editorDocumentId || !config) return

            try {
                await loadOnlyOfficeApi()
                if (cancelled) return

                const editorConfig = {
                    ...config,
                    width: '100%',
                    height: '920px',
                }

                editorKeyRef.current = config?.document?.key || null
                editorRef.current?.destroyEditor?.()
                editorRef.current = new window.DocsAPI!.DocEditor('onlyoffice-editor', editorConfig)
            } catch (err) {
                if (!cancelled) message.error((err as Error).message || 'Ошибка инициализации редактора')
            }
        }

        init()

        return () => {
            cancelled = true
            editorRef.current?.destroyEditor?.()
            editorRef.current = null
        }
    }, [editorDocumentId, config, editorReloadNonce])

    // Периодическая проверка статуса документа:
    // - версии: чтобы актуальный статус (черновик/на согласовании/одобрено/отклонено) не устаревал
    // - роли членов/апруверы: чтобы кнопки и списки участников корректно обновлялись
    useEffect(() => {
        if (!editorDocumentId) return

        const tick = async () => {
            if (statusPollInFlightRef.current) return
            statusPollInFlightRef.current = true
            try {
                await Promise.allSettled([refetchVersions(), refetchMembers(), refetchApprovers()])
            } finally {
                statusPollInFlightRef.current = false
            }
        }

        const intervalId = window.setInterval(() => {
            void tick()
        }, DOCUMENT_STATUS_POLL_INTERVAL_MS)

        return () => {
            window.clearInterval(intervalId)
        }
    }, [editorDocumentId, refetchVersions, refetchMembers, refetchApprovers])

    useEffect(() => {
        if (!editorDocumentId) return

        if (previousAccessSnapshotRef.current == null) {
            previousAccessSnapshotRef.current = accessSnapshot
            return
        }

        if (previousAccessSnapshotRef.current !== accessSnapshot) {
            previousAccessSnapshotRef.current = accessSnapshot
            void refetchEditorConfig()
            setEditorReloadNonce(prev => prev + 1)
            return
        }

        previousAccessSnapshotRef.current = accessSnapshot
    }, [editorDocumentId, accessSnapshot, refetchEditorConfig])

    if (isAccessDenied) {
        return (
            <div style={{ padding: '20px 24px' }}>
                <Paragraph type="secondary">Для получения прав обратитесь к владельцу документа</Paragraph>
            </div>
        )
    }

    const handleSave = async () => {
        if (!editorRef.current || !editorDocumentId) {
            message.warning('Редактор не загружен')
            return
        }
        setIsSaving(true)
        const loadingKey = 'onlyoffice-save-status'
        message.loading({
            content: 'Сохранение и создание новой версии...',
            key: loadingKey,
            duration: 0,
        })
        try {
            const forceSaveWithKey = async (editorKey?: string | null) => {
                const keyParam = editorKey
                    ? `?editor_key=${encodeURIComponent(editorKey)}`
                    : ''
                const res = await fetch(`/api/document/${editorDocumentId}/force-save${keyParam}`, {
                    method: 'POST',
                    credentials: 'include',
                })
                if (!res.ok) {
                    const text = await res.text()
                    throw new Error(text || 'Не удалось сохранить документ')
                }
            }

            let activeEditorKey = editorKeyRef.current
            try {
                await forceSaveWithKey(activeEditorKey)
            } catch (error) {
                const detail = (error as Error).message || ''
                const isInvalidOnlyOfficeKey = detail.includes(`'error': 3`) || detail.includes(`"error": 3`)
                if (!isInvalidOnlyOfficeKey) throw error

                // key мог устареть после пересоздания editor-сессии: пробуем взять свежий config и повторить.
                const refreshed = await refetchEditorConfig()
                const refreshedKey = (refreshed as { data?: { document?: { key?: string } } })?.data?.document?.key
                activeEditorKey = refreshedKey ?? activeEditorKey
                editorKeyRef.current = activeEditorKey ?? null
                await forceSaveWithKey(activeEditorKey)
            }

            await sleep(3000)
            const createdVersion = await createNewVersion(editorDocumentId).unwrap()

            if (createdVersion?.version != null) {
                // После создания версии переинициализируем editor на конкретную версию.
                navigate(`/document?documentId=${editorDocumentId}&version=${createdVersion.version}`, { replace: true })
            }

            message.success({
                content: 'Новая версия создана',
                key: loadingKey,
            })
        } catch (error) {
            message.error({
                content: 'Ошибка при сохранении: ' + (error as Error).message,
                key: loadingKey,
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleCompareVersion = (versionId: number) => {
        setCompareVersionId(versionId)
    }

    const handleApproveDocument = async () => {
        if (!editorDocumentId) return
        try {
            await approveDocument({ docId: editorDocumentId, approved: true }).unwrap()
            message.success('Документ согласован')
        } catch (error) {
            const detail = (error as { data?: { detail?: string } })?.data?.detail
            message.error(detail || 'Не удалось согласовать документ')
        }
    }

    const handleRefuseSubmit = async (values: { reason: string }) => {
        if (!editorDocumentId) return
        const reason = values.reason?.trim() ?? ''
        if (!reason) {
            message.warning('Укажите причину отказа')
            return
        }
        try {
            await approveDocument({
                docId: editorDocumentId,
                approved: false,
                reason_for_refusal: reason,
            }).unwrap()
            message.success('Документ отклонён')
            setRefuseModalOpen(false)
            refuseForm.resetFields()
        } catch (error) {
            const detail = (error as { data?: { detail?: string } })?.data?.detail
            message.error(detail || 'Не удалось отклонить документ')
        }
    }

    const isEditorLoading = Boolean(editorDocumentId) && isConfigLoading

    return (
        <div style={{ padding: '20px 24px' }}>
            {!editorDocumentId ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
                            Назад
                        </Button>
                    </div>
                    <Paragraph type="secondary" style={{ marginTop: 0 }}>
                        Документ не выбран. Откройте его из раздела <Link to="/files/my">«Мои файлы»</Link>
                    </Paragraph>
                </>
            ) : (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
                            <Button
                                type="text"
                                icon={<ArrowLeftOutlined />}
                                onClick={() => navigate(-1)}
                                style={{ flexShrink: 0, marginTop: 2 }}
                            >
                                Назад
                            </Button>
                            <div style={{ minWidth: 0 }}>
                            <Title level={4} style={{ margin: 0 }}>
                                {docTitle}
                            </Title>
                            <div style={{ marginTop: 6 }}>
                                {versionsLoading ? (
                                    <Spin size="small" />
                                ) : latestVersion ? (
                                    versionStatusTag(latestVersion.status)
                                ) : (
                                    <Text type="secondary">Нет данных о версиях</Text>
                                )}
                            </div>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' }}>
                            {showApproveButton && (
                                <>
                                    <Button
                                        type="primary"
                                        onClick={handleApproveDocument}
                                        loading={isApproving}
                                        disabled={isEditorLoading}
                                        icon={<CheckCircleOutlined />}
                                    >
                                        Согласовать
                                    </Button>
                                    <Button
                                        danger
                                        onClick={() => setRefuseModalOpen(true)}
                                        loading={isApproving}
                                        disabled={isEditorLoading}
                                        icon={<StopOutlined />}
                                    >
                                        Отказать
                                    </Button>
                                </>
                            )}
                            {showSaveVersionButton && (
                                <Button
                                    type="primary"
                                    onClick={handleSave}
                                    loading={isSaving}
                                    disabled={isEditorLoading}
                                    icon={<SaveOutlined />}
                                >
                                    Создать версию
                                </Button>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 20 }}>
                        {/* Editor */}
                        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                            {isEditorLoading ? (
                                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }}>
                                    <Spin size="large" tip="Загрузка редактора..." />
                                </div>
                            ) : (
                                <div
                                    id="onlyoffice-editor"
                                    style={{
                                        width: '100%',
                                        height: 920,
                                        border: '2px solid #1677ff',
                                        borderRadius: 8,
                                        overflow: 'hidden',
                                    }}
                                />
                            )}
                        </div>

                        {/* Right panel — VS Code style accordion */}
                        <div
                            style={{
                                width: 360,
                                flexShrink: 0,
                                border: '1px solid #d9d9d9',
                                borderRadius: 8,
                                overflow: 'hidden',
                                alignSelf: 'flex-start',
                            }}
                        >
                            {/* --- Соавторы --- */}
                            <div
                                style={sectionHeaderStyle}
                                onClick={() => toggleSection('coauthors')}
                            >
                                {openSection === 'coauthors' ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                <TeamOutlined />
                                Соавторы
                            </div>
                            {openSection === 'coauthors' && editorDocumentId && (
                                <div style={sectionBodyStyle}>
                                    <DocumentCoauthorsBlock
                                        documentId={editorDocumentId}
                                        canManageAccess={isDocumentOwner}
                                    />
                                    {isDocumentOwner && (
                                        <Button
                                            block
                                            icon={<ShareAltOutlined />}
                                            style={{ marginTop: 12 }}
                                            onClick={() => setShareModalVisible(true)}
                                        >
                                            Поделиться доступом
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* --- Согласование --- */}
                            <div
                                style={sectionHeaderStyle}
                                onClick={() => toggleSection('approval')}
                            >
                                {openSection === 'approval' ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                <SendOutlined />
                                Согласование
                            </div>
                            {openSection === 'approval' && editorDocumentId && (
                                <div style={sectionBodyStyle}>
                                    <DocumentApproversBlock documentId={editorDocumentId} />
                                    <div style={{ margin: '16px 0 8px', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
                                        <Text strong style={{ fontSize: 13 }}>Отправить на согласование</Text>
                                    </div>
                                    {versionsLoading ? (
                                        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                                            <Spin />
                                        </div>
                                    ) : (
                                        <MoveToApprovalForm
                                            documentId={editorDocumentId}
                                            canSetApprovers={latestVersion?.status === 'draft'}
                                        />
                                    )}
                                </div>
                            )}

                            {/* --- История изменений --- */}
                            <div
                                style={{ ...sectionHeaderStyle, borderBottom: openSection === 'history' ? '1px solid #f0f0f0' : 'none' }}
                                onClick={() => toggleSection('history')}
                            >
                                {openSection === 'history' ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
                                <HistoryOutlined />
                                История изменений
                            </div>
                            {openSection === 'history' && editorDocumentId && (
                                <div style={{ ...sectionBodyStyle, borderBottom: 'none' }}>
                                    <DocumentVersionHistoryBlock
                                        documentId={editorDocumentId}
                                        onCompareVersion={handleCompareVersion}
                                    />
                                </div>
                            )}

                            {refusalFooterLines && refusalFooterLines.length > 0 && (
                                <div
                                    style={{
                                        padding: '14px 16px',
                                        borderTop: '1px solid #ffccc7',
                                        background: '#fff2f0',
                                    }}
                                >
                                    <Text strong style={{ display: 'block', marginBottom: 8, color: '#cf1322' }}>
                                        Причина отказа
                                    </Text>
                                    {refusalFooterLines.map((line, i) => (
                                        <Paragraph
                                            key={`refusal-line-${i}`}
                                            style={{
                                                marginBottom: i < refusalFooterLines.length - 1 ? 10 : 0,
                                                fontSize: 13,
                                                whiteSpace: 'pre-wrap',
                                            }}
                                        >
                                            {line.name ? (
                                                <>
                                                    <Text type="secondary">{line.name}: </Text>
                                                    {line.reason ?? 'Не указана'}
                                                </>
                                            ) : (
                                                <>{line.reason ?? 'Причина отказа не указана.'}</>
                                            )}
                                        </Paragraph>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {isDocumentOwner && (
                <ShareDocumentModal
                    visible={shareModalVisible}
                    documentId={editorDocumentId || 0}
                    onClose={() => setShareModalVisible(false)}
                />
            )}

            {editorDocumentId && (
                <VersionCompareModal
                    open={compareVersionId !== null}
                    docId={editorDocumentId}
                    baseVersionId={compareVersionId}
                    editorKey={editorKeyRef.current}
                    onClose={() => setCompareVersionId(null)}
                />
            )}

            <Modal
                title="Отказать в согласовании"
                open={refuseModalOpen}
                onCancel={() => {
                    setRefuseModalOpen(false)
                    refuseForm.resetFields()
                }}
                footer={null}
                destroyOnClose
            >
                <Form form={refuseForm} layout="vertical" onFinish={handleRefuseSubmit}>
                    <Form.Item
                        name="reason"
                        label="Причина отказа"
                        rules={[{ required: true, message: 'Укажите причину отказа' }]}
                    >
                        <Input.TextArea rows={4} placeholder="Опишите причину отказа" maxLength={2000} showCount />
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                        <Button
                            onClick={() => {
                                setRefuseModalOpen(false)
                                refuseForm.resetFields()
                            }}
                        >
                            Отмена
                        </Button>
                        <Button
                            type="primary"
                            danger
                            htmlType="submit"
                            loading={isApproving}
                            style={{ marginLeft: 8 }}
                        >
                            Отказать
                        </Button>
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}

export default DocumentEditorPage
